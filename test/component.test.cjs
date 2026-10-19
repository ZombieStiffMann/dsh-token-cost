// Render-path test for the cost pill's client half.
//
// Loads the real client.js through a fake module loader with a minimal React
// stub (no DOM renderer), then exercises the states the pill and its breakdown
// dialog must handle: normal cost, missing projection, zero usage,
// unpriced-only, mixed unpriced, malformed view, currency totals, the
// per-model tab strip (keyboard switching, tab clamping when the models list
// shrinks), K/M token counts, two-decimal money, dividers, per-model official
// price links, locale key resolution, and the settings panel (UI language
// override + persistence, display currency conversion with a user-editable
// USD->CNY rate, native mode, and localStorage-absent safety).
//
// Run: node test/component.test.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(dir, 'client.js'), 'utf8');

// ---- DOM-less environment --------------------------------------------------
const styleTags = [];

function makeElement() {
  return {
    dataset: {},
    textContent: '',
    removed: false,
    remove() {
      this.removed = true;
    },
  };
}

global.document = {
  body: {},
  head: { appendChild: (node) => styleTags.push(node) },
  createElement: makeElement,
  addEventListener() {},
  removeEventListener() {},
};
global.window = {
  __ModuleLoader__: { load: (definition) => { global.__captured = definition; } },
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
  setTimeout: () => 0,
  clearTimeout() {},
};

// ---- deterministic localStorage stub ---------------------------------------
// Node may expose a non-functional localStorage getter; replace it with an
// inspectable in-memory store before anything renders.
const SETTINGS_KEY = 'dsh-token-cost.settings.v1';
let storageWrites = [];

function makeStorage(initial) {
  const map = new Map();
  if (initial !== undefined) map.set(SETTINGS_KEY, typeof initial === 'string' ? initial : JSON.stringify(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
      storageWrites.push({ key, value: String(value) });
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

function resetStorage(initial) {
  delete globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: makeStorage(initial), configurable: true, writable: true });
  storageWrites = [];
}

/** Simulate a browser without localStorage at all. */
function clearStorage() {
  delete globalThis.localStorage;
}

function storedSettings() {
  if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === null) return null;
  const raw = globalThis.localStorage.getItem(SETTINGS_KEY);
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

resetStorage();
vm.runInThisContext(code, { filename: 'client.js' });

const captured = global.__captured;
if (!captured) throw new Error('client.js did not call window.__ModuleLoader__.load');
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
if (captured.id !== pkg.name) throw new Error('client module id must equal the package name: ' + captured.id + ' != ' + pkg.name);
if (typeof captured.factory !== 'function') throw new Error('module definition must expose a factory(require)');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

// ---- minimal React stub with deterministic hooks ---------------------------
// Components are invoked manually while the element tree is walked, so hook
// state is stored per component type and a cursor is reset on every invocation.
// Setters mutate the stored cell, which makes tab switching observable on the
// next walk of the same tree.
const noop = () => {};
const hookStore = new Map();
let hookType = null;
let hookCursor = 0;

function hookCell() {
  if (typeof hookType !== 'function') throw new Error('hook used outside a component render');
  let store = hookStore.get(hookType);
  if (store === undefined) {
    store = { cells: [] };
    hookStore.set(hookType, store);
  }
  const index = hookCursor;
  hookCursor += 1;
  return { store, index };
}

const ReactStub = {
  // Real React stores children on props; DetailRow reads props.children.
  createElement: (type, props, ...children) => ({
    type,
    props: Object.assign({}, props, children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children }),
    children,
  }),
  Fragment: Symbol('Fragment'),
  useState: (init) => {
    const cell = hookCell();
    if (!(cell.index in cell.store.cells)) {
      // Match React: a function initializer is called lazily on first mount.
      cell.store.cells[cell.index] = { value: typeof init === 'function' ? init() : init };
    }
    const stored = cell.store.cells[cell.index];
    const setValue = (next) => {
      stored.value = typeof next === 'function' ? next(stored.value) : next;
    };
    return [stored.value, setValue];
  },
  useRef: (init) => {
    const cell = hookCell();
    if (!(cell.index in cell.store.cells)) cell.store.cells[cell.index] = { ref: { current: init } };
    return cell.store.cells[cell.index].ref;
  },
  useEffect: noop,
  useLayoutEffect: noop,
};

const ReactDomStub = {
  createPortal: (element, container) => ({ portal: element, container }),
};
const requireStub = (name) => {
  if (name === 'react') return ReactStub;
  if (name === 'react-dom') return ReactDomStub;
  throw new Error('unexpected require(' + JSON.stringify(name) + ')');
};

/** Run one function component with a fresh hook cursor (no nested renders here). */
function invoke(type, props) {
  const previousType = hookType;
  const previousCursor = hookCursor;
  hookType = type;
  hookCursor = 0;
  try {
    return type(props);
  } finally {
    hookType = previousType;
    hookCursor = previousCursor;
  }
}

// ---- plugin registration contract -----------------------------------------
const plugin = captured.factory(requireStub);
if (typeof plugin !== 'object' || typeof plugin.apply !== 'function') throw new Error('factory must return an apply() plugin');
if (!Array.isArray(plugin.inject) || !plugin.inject.includes('slots') || !plugin.inject.includes('locale')) {
  throw new Error('plugin must inject slots and locale');
}

let dictionaries = null;
let localeNamespace = null;
const registrations = [];
const disposers = [];
const ctx = {
  effect(fn) {
    disposers.push(fn());
    return noop;
  },
  locale: {
    register(namespace, dicts) {
      localeNamespace = namespace;
      dictionaries = dicts;
      return noop;
    },
  },
  slots: {
    inject(key, callback) {
      callback();
      return noop;
    },
    register(options, component) {
      registrations.push({ options, component });
      return noop;
    },
  },
};
plugin.apply(ctx);

if (registrations.length !== 1) throw new Error('expected one slot registration, got ' + registrations.length);
const { options, component: CostPill } = registrations[0];
check(options.name === 'conversation.composer.dock', 'slot name must stay conversation.composer.dock, got ' + options.name);
check(options.id === 'cost', 'slot id must stay cost, got ' + options.id);
check(options.order === 2, 'slot order must stay 2, got ' + options.order);
check(options.locale === 'token-cost', 'slot locale namespace must stay token-cost, got ' + options.locale);
check(localeNamespace === 'token-cost', 'locale.register must use the token-cost namespace, got ' + localeNamespace);
check(dictionaries !== null && typeof dictionaries.zh === 'object' && typeof dictionaries.en === 'object', 'apply() must register zh + en dictionaries');
check(!code.includes('@deepseek-ai/'), 'client.js must not import @deepseek-ai packages');
check(!/\bfetch\s*\(/.test(code) && !/XMLHttpRequest/.test(code), 'client.js must not perform network requests');

// Style tag: exactly one, plugin-scoped, theme-token-only, disposed on unload.
check(styleTags.length === 1, 'apply() must inject exactly one style tag, got ' + styleTags.length);
const styleTag = styleTags[0];
check(styleTag.dataset.plugin === 'dsh-token-cost', 'style tag must be plugin-scoped, got ' + styleTag.dataset.plugin);
check(styleTag.dataset.pluginCss === 'dsh-token-cost/composer-cost.css', 'style tag needs a stable plugin CSS id');
const css = styleTag.textContent;
check(css.includes('var(--dsw-'), 'styles must use theme tokens');
check(!css.includes('#'), 'styles must not hard-code hex colors');
check(!css.includes('@import'), 'styles must not import external CSS');
check(css.includes('overflow-x:auto'), 'tab strip must scroll horizontally');
check(css.includes('text-overflow:ellipsis'), 'tab labels must ellipsize');
check(css.includes('[aria-selected'), 'the selected tab must be styled');
check(css.includes('[aria-pressed'), 'the selected settings choice must be styled');
check(css.includes('@media (width<=480px)'), 'responsive label hiding must be kept');
for (const dispose of disposers) if (typeof dispose === 'function') dispose();
check(styleTag.removed === true, 'style effect cleanup must remove the style tag');
check(!code.includes('document.body.'), 'client.js must not write to document.body outside the portal');

// ---- render helpers --------------------------------------------------------
const missingKeys = new Set();
const usedKeys = new Set();

function makeT(locale) {
  return (key, params) => {
    usedKeys.add(locale + ':' + key);
    const dict = dictionaries[locale] || {};
    const template = dict[key];
    if (template === undefined) {
      missingKeys.add(locale + ':' + key);
      return key;
    }
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  };
}

/**
 * Mount the slot component for a projection view. Hook state is reset per
 * scenario unless `resetHooks: false`, which re-renders a new view while
 * keeping the dialog's open / tab / screen / settings state.
 */
function render(view, settings) {
  const config = settings || {};
  if (config.resetHooks !== false) hookStore.clear();
  let element = invoke(CostPill, {
    useProjection: (key) => (key === 'tokenCost' ? view : undefined),
    t: makeT(config.locale || 'zh'),
  });
  if (element !== null && typeof element === 'object' && typeof element.type === 'function') {
    element = invoke(element.type, element.props);
  }
  return element;
}

/** Re-render the mounted tree while preserving hook state (React update). */
function rerender(view, locale) {
  return render(view, { locale: locale || 'zh', resetHooks: false });
}

/** Open the dialog the way a user does (click the pill), then rebuild the tree. */
function openDialog(view, locale) {
  const first = render(view, { locale: locale || 'zh' });
  if (first === null || first === undefined) return null;
  const trigger = findNode(first, (node) => node.type === 'button' && node.props !== undefined && node.props['aria-haspopup'] === 'dialog');
  if (trigger === undefined) return null;
  trigger.props.onClick();
  return rerender(view, locale || 'zh');
}

// ---- tree walkers (invoke function components as real React would) ---------
function findText(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(findText).join(' ');
  if (typeof node === 'object') {
    if (node.portal !== undefined) return findText(node.portal);
    if (typeof node.type === 'function') return findText(invoke(node.type, node.props));
    return findText(node.children);
  }
  return '';
}

function findNode(node, predicate) {
  if (node === null || node === undefined || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNode(child, predicate);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (node.portal !== undefined) return findNode(node.portal, predicate);
  if (predicate(node)) return node;
  if (typeof node.type === 'function') return findNode(invoke(node.type, node.props), predicate);
  return findNode(node.children, predicate);
}

function findNodes(node, predicate, found) {
  const out = found || [];
  if (node === null || node === undefined || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) findNodes(child, predicate, out);
    return out;
  }
  if (node.portal !== undefined) {
    findNodes(node.portal, predicate, out);
    return out;
  }
  if (predicate(node)) out.push(node);
  if (typeof node.type === 'function') findNodes(invoke(node.type, node.props), predicate, out);
  else findNodes(node.children, predicate, out);
  return out;
}

function findPortal(node) {
  if (node === null || node === undefined || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findPortal(child);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (node.portal !== undefined) return node;
  if (typeof node.type === 'function') return findPortal(invoke(node.type, node.props));
  return findPortal(node.children);
}

/** Collect dt labels of every dl carrying `marker`. */
function collectRows(node, marker) {
  const rows = [];
  (function walk(child) {
    if (child === null || child === undefined || typeof child !== 'object') return;
    if (Array.isArray(child)) {
      child.forEach(walk);
      return;
    }
    if (child.portal !== undefined) {
      walk(child.portal);
      return;
    }
    if (typeof child.type === 'function') {
      walk(invoke(child.type, child.props));
      return;
    }
    if (child.type === 'dl' && child.props && child.props[marker] === true) {
      (function collect(row) {
        if (row === null || row === undefined || typeof row !== 'object') return;
        if (Array.isArray(row)) {
          row.forEach(collect);
          return;
        }
        if (typeof row.type === 'function') {
          collect(invoke(row.type, row.props));
          return;
        }
        if (row.type === 'dt') {
          rows.push(findText(row));
          return;
        }
        collect(row.children);
      })(child.children);
      return;
    }
    walk(child.children);
  })(node);
  return rows;
}

function countDividers(node) {
  let count = 0;
  (function walk(child) {
    if (child === null || child === undefined || typeof child !== 'object') return;
    if (Array.isArray(child)) {
      child.forEach(walk);
      return;
    }
    if (child.portal !== undefined) {
      walk(child.portal);
      return;
    }
    if (typeof child.type === 'function') {
      walk(invoke(child.type, child.props));
      return;
    }
    if (typeof child.type === 'string' && child.props && typeof child.props.className === 'string' && child.props.className.endsWith('_divider')) {
      count += 1;
    }
    walk(child.children);
  })(node);
  return count;
}

const tablistOf = (element) => findNode(element, (node) => node.props !== undefined && node.props.role === 'tablist');
const tabsOf = (element) => findNodes(element, (node) => node.props !== undefined && node.props.role === 'tab');
const tabpanelOf = (element) => findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-tabpanel'] === true);
const anchorsOf = (node) => findNodes(node, (child) => child.type === 'a');
const settingsToggleOf = (element) => findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-settings-toggle'] === true);
const settingsPanelOf = (element) => findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-settings'] === true);
const settingsBackOf = (element) => findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-settings-back'] === true);
const fxInputOf = (element) => findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-fx-input'] === true);
const fxLineOf = (element) => findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-fx'] === true);
const titleValueOf = (element) => findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-title-value'] === true);
const settingChoiceOf = (element, marker, value) =>
  findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-' + marker] === value);
const pillTextOf = (element) => {
  const trigger = findNode(element, (node) => node.type === 'button' && node.props !== undefined && node.props['aria-haspopup'] === 'dialog');
  return trigger === undefined ? '' : findText(trigger).trim();
};

/** Open the in-dialog settings panel and return it. */
function openSettings(element) {
  const toggle = settingsToggleOf(element);
  if (toggle === undefined) return undefined;
  toggle.props.onClick();
  return settingsPanelOf(element);
}

// ---- frozen `tokenCost` view fixture --------------------------------------
const BASE_TOKENS = { input: 273974, cacheRead: 31034624, cacheWrite: 0, output: 144423, reasoning: 0 };
const BASE_MICROS = { input: 273974, cacheRead: 620692, cacheWrite: 0, output: 577692 };
const BASE_TOTAL = 31453021;
const SOURCE = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';

function makeCurrency(overrides) {
  const extra = overrides || {};
  return Object.assign(
    {},
    {
      code: 'CNY',
      symbol: '¥',
      micro: 1472358,
      tokens: Object.assign({}, BASE_TOKENS, extra.tokens),
      micros: Object.assign({}, BASE_MICROS, extra.micros),
      peakMicro: 0,
      offPeakMicro: 1472358,
      saving: 1472363,
    },
    extra,
    {
      tokens: Object.assign({}, BASE_TOKENS, extra.tokens),
      micros: Object.assign({}, BASE_MICROS, extra.micros),
    },
  );
}

function makeModel(overrides) {
  const extra = overrides || {};
  return Object.assign(
    {},
    {
      key: 'deepseek-official\u0000deepseek-flash',
      provider: 'deepseek-official',
      model: 'deepseek-flash',
      name: 'DeepSeek-V4.1-Flash',
      vendor: 'deepseek',
      vendorName: 'DeepSeek',
      priced: true,
      currency: { code: 'CNY', symbol: '¥' },
      micro: 1472358,
      tokens: Object.assign({}, BASE_TOKENS, extra.tokens),
      tokensTotal: BASE_TOTAL,
      micros: Object.assign({}, BASE_MICROS, extra.micros),
      peakMicro: 0,
      offPeakMicro: 1472358,
      source: SOURCE,
      asOf: '2026-10-19',
    },
    extra,
    {
      tokens: Object.assign({}, BASE_TOKENS, extra.tokens),
      micros: Object.assign({}, BASE_MICROS, extra.micros),
    },
  );
}

function makeUnpricedModel(overrides) {
  return Object.assign(
    {
      key: 'xiaomi\u0000mimo-v2.6-pro',
      provider: 'xiaomi',
      model: 'mimo-v2.6-pro',
      name: 'MiMo-V2.6-Pro',
      vendor: 'xiaomi',
      vendorName: 'Xiaomi',
      priced: false,
      currency: null,
      micro: 0,
      tokens: { input: 100, cacheRead: 0, cacheWrite: 0, output: 20, reasoning: 0 },
      tokensTotal: 120,
      micros: null,
      peakMicro: null,
      offPeakMicro: null,
      source: null,
      asOf: null,
    },
    overrides || {},
  );
}

function makeView(overrides) {
  return Object.assign(
    {
      currencies: [makeCurrency()],
      tokens: Object.assign({}, BASE_TOKENS),
      tokensTotal: BASE_TOTAL,
      models: [makeModel()],
      unpricedTokens: 0,
      unpricedModels: [],
      lastUpdated: 1760000000000,
    },
    overrides || {},
  );
}

/** Two priced models, one billed in CNY and one in USD. */
function makeMultiCurrencyView() {
  const cnyTokens = { input: 100000, cacheRead: 200000, cacheWrite: 0, output: 50000, reasoning: 0 };
  const usdTokens = { input: 10000, cacheRead: 0, cacheWrite: 0, output: 5000, reasoning: 0 };
  const cnyMicros = { input: 1200000, cacheRead: 220000, cacheWrite: 0, output: 900000 };
  const usdMicros = { input: 90000, cacheRead: 0, cacheWrite: 0, output: 50000 };
  return {
    currencies: [
      { code: 'CNY', symbol: '¥', micro: 2320000, tokens: cnyTokens, micros: cnyMicros, peakMicro: 1000000, offPeakMicro: 1320000, saving: 0 },
      { code: 'USD', symbol: '$', micro: 140000, tokens: usdTokens, micros: usdMicros, peakMicro: 40000, offPeakMicro: 100000, saving: 0 },
    ],
    tokens: { input: 110000, cacheRead: 200000, cacheWrite: 0, output: 55000, reasoning: 0 },
    tokensTotal: 365000,
    models: [
      {
        key: 'cny-model',
        provider: 'deepseek-official',
        model: 'deepseek-flash',
        name: 'DeepSeek-V4.1-Flash',
        vendor: 'deepseek',
        vendorName: 'DeepSeek',
        priced: true,
        currency: { code: 'CNY', symbol: '¥' },
        micro: 2320000,
        tokens: cnyTokens,
        tokensTotal: 350000,
        micros: cnyMicros,
        peakMicro: 1000000,
        offPeakMicro: 1320000,
        source: 'https://example.test/cny-pricing',
        asOf: '2026-10-19',
      },
      {
        key: 'usd-model',
        provider: 'openai',
        model: 'gpt-x',
        name: 'GPT-X',
        vendor: 'openai',
        vendorName: 'OpenAI',
        priced: true,
        currency: { code: 'USD', symbol: '$' },
        micro: 140000,
        tokens: usdTokens,
        tokensTotal: 15000,
        micros: usdMicros,
        peakMicro: 40000,
        offPeakMicro: 100000,
        source: 'https://example.test/usd-pricing',
        asOf: '2026-10-19',
      },
    ],
    unpricedTokens: 0,
    unpricedModels: [],
    lastUpdated: 1760000000001,
  };
}

function makeUnpricedView() {
  const tokens = { input: 100, cacheRead: 0, cacheWrite: 0, output: 20, reasoning: 0 };
  return {
    currencies: [],
    tokens,
    tokensTotal: 120,
    models: [makeUnpricedModel()],
    unpricedTokens: 120,
    unpricedModels: ['mimo-v2.6-pro'],
    lastUpdated: null,
  };
}

function makeMixedView() {
  const tokens = { input: 274074, cacheRead: 31034624, cacheWrite: 0, output: 144443, reasoning: 0 };
  return makeView({
    tokens,
    tokensTotal: 31453141,
    models: [makeModel(), makeUnpricedModel()],
    unpricedTokens: 120,
    unpricedModels: ['mimo-v2.6-pro'],
  });
}

function makeCacheWriteView() {
  const tokens = { input: 273974, cacheRead: 31034624, cacheWrite: 5000, output: 144423, reasoning: 0 };
  const micros = { input: 273974, cacheRead: 620692, cacheWrite: 30000, output: 577692 };
  return makeView({
    tokens,
    tokensTotal: 31458021,
    currencies: [makeCurrency({ tokens, micro: 1502358, micros })],
    models: [makeModel({ tokens, tokensTotal: 31458021, micro: 1502358, micros })],
  });
}

/**
 * Mixed CNY + USD view sized so the frozen CNY conversion example holds:
 * the USD model costs 14,000,000 micro = $14.00 -> ¥100.80 at 7.2.
 */
function makeFxView() {
  const cnyTokens = { input: 100000, cacheRead: 200000, cacheWrite: 0, output: 50000, reasoning: 0 };
  const cnyMicros = { input: 1200000, cacheRead: 220000, cacheWrite: 0, output: 900000 };
  const usdTokens = { input: 50000, cacheRead: 20000, cacheWrite: 0, output: 80000, reasoning: 0 };
  const usdMicros = { input: 6000000, cacheRead: 2000000, cacheWrite: 0, output: 6000000 };
  return {
    currencies: [
      { code: 'CNY', symbol: '¥', micro: 2320000, tokens: cnyTokens, micros: cnyMicros, peakMicro: 1000000, offPeakMicro: 1320000, saving: 0 },
      { code: 'USD', symbol: '$', micro: 14000000, tokens: usdTokens, micros: usdMicros, peakMicro: 5000000, offPeakMicro: 9000000, saving: 0 },
    ],
    tokens: { input: 150000, cacheRead: 220000, cacheWrite: 0, output: 130000, reasoning: 0 },
    tokensTotal: 500000,
    models: [
      {
        key: 'cny-model',
        provider: 'deepseek-official',
        model: 'deepseek-flash',
        name: 'DeepSeek-V4.1-Flash',
        vendor: 'deepseek',
        vendorName: 'DeepSeek',
        priced: true,
        currency: { code: 'CNY', symbol: '¥' },
        micro: 2320000,
        tokens: cnyTokens,
        tokensTotal: 350000,
        micros: cnyMicros,
        peakMicro: 1000000,
        offPeakMicro: 1320000,
        source: 'https://example.test/cny-pricing',
        asOf: '2026-10-19',
      },
      {
        key: 'usd-model',
        provider: 'openai',
        model: 'gpt-x',
        name: 'GPT-X',
        vendor: 'openai',
        vendorName: 'OpenAI',
        priced: true,
        currency: { code: 'USD', symbol: '$' },
        micro: 14000000,
        tokens: usdTokens,
        tokensTotal: 150000,
        micros: usdMicros,
        peakMicro: 5000000,
        offPeakMicro: 9000000,
        source: 'https://example.test/usd-pricing',
        asOf: '2026-10-19',
      },
    ],
    unpricedTokens: 0,
    unpricedModels: [],
    lastUpdated: 1760000000002,
  };
}

/**
 * Single CNY model sized for the frozen USD conversion example:
 * 14,723,580 micro / 7.2 = 2,044,941.7 -> $2.04 (rounded).
 */
function makeUsdTargetView() {
  const tokens = { input: 400000, cacheRead: 200000, cacheWrite: 0, output: 100000, reasoning: 0 };
  const micros = { input: 5000000, cacheRead: 2000000, cacheWrite: 0, output: 7723580 };
  return makeView({
    tokens,
    tokensTotal: 700000,
    currencies: [
      makeCurrency({ tokens, micro: 14723580, micros, peakMicro: 4000000, offPeakMicro: 10723580 }),
    ],
    models: [
      makeModel({ tokens, tokensTotal: 700000, micro: 14723580, micros, peakMicro: 4000000, offPeakMicro: 10723580 }),
    ],
  });
}

// ---- 1) pill: single currency, two decimals, aria -------------------------
for (const locale of ['zh', 'en']) {
  const element = render(makeView(), { locale });
  check(element !== null && element !== undefined, locale + ': pill must render');
  if (element === null) continue;
  const text = findText(element);
  check(text.includes('¥1.47'), locale + ': pill must show two-decimal CNY, got ' + JSON.stringify(text));
  check(!/¥1\.47\d/.test(text), locale + ': pill must not show more than two decimals');
  const button = findNode(element, (node) => node.type === 'button');
  check(button !== undefined, locale + ': missing trigger button');
  check(button !== undefined && button.props['aria-haspopup'] === 'dialog', locale + ': trigger must set aria-haspopup');
  check(button !== undefined && button.props['aria-expanded'] === false, locale + ': trigger must be closed initially');
  check(button !== undefined && typeof button.props['aria-label'] === 'string' && button.props['aria-label'] !== '', locale + ': trigger needs aria-label');
  check(
    button !== undefined && button.props['aria-label'].includes('¥1.47'),
    locale + ': aria-label must include the amount, got ' + (button && button.props['aria-label']),
  );
  const anchor = findNode(element, (node) => node.props !== undefined && node.props['data-composer-cost'] === 'cost');
  check(anchor !== undefined, locale + ': pill must keep the data-composer-cost=cost anchor');
}

// ---- 2) pill: multiple currencies are joined ------------------------------
const multiPill = render(makeMultiCurrencyView(), { locale: 'zh' });
check(multiPill !== null, 'multi-currency view must render a pill');
const multiPillText = findText(multiPill);
check(multiPillText.includes('¥2.32'), 'multi-currency pill must show the CNY total, got ' + JSON.stringify(multiPillText));
check(multiPillText.includes('$0.14'), 'multi-currency pill must show the USD total, got ' + JSON.stringify(multiPillText));
check(
  multiPillText.includes('¥2.32 · $0.14'),
  'multi-currency pill must join amounts with a separator, got ' + JSON.stringify(multiPillText),
);

// ---- 3) pill: unpriced-only usage ----------------------------------------
for (const locale of ['zh', 'en']) {
  const element = render(makeUnpricedView(), { locale });
  check(element !== null && element !== undefined, locale + ': unpriced-only view must render a pill');
  if (element === null) continue;
  const text = findText(element);
  check(text.includes(locale === 'zh' ? '未定价' : 'Unpriced'), locale + ': unpriced-only pill must say unpriced, got ' + JSON.stringify(text));
  const button = findNode(element, (node) => node.type === 'button');
  check(button !== undefined && typeof button.props.className === 'string' && button.props.className.includes('_pillUnpriced'), locale + ': unpriced-only pill needs the warning class');
}

// ---- 4) pill/dialog hidden on missing or malformed views ------------------
check(render(undefined) === null, 'missing projection must render null');
check(render(null) === null, 'null projection must render null');
// A legacy (pre-tab) single-currency view is upgraded in place rather than
// hidden, so a tab that stayed open across an upgrade keeps its pill.
const legacyView = render({
  currency: { code: 'CNY', symbol: '¥' },
  micro: 1472358,
  tokens: BASE_TOKENS,
  tokensTotal: BASE_TOTAL,
  models: [],
});
check(legacyView !== null, 'legacy single-currency view must be upgraded, not hidden');
check(
  legacyView !== null && findText(legacyView).includes('¥1.47'),
  'legacy single-currency view must render its amount after upgrading',
);
check(render({ currencies: 'CNY' }) === null, 'non-array currencies must render null');
check(render({ currencies: [null, {}] }) === null, 'currencies without a code must not render');
check(
  render(
    makeView({
      currencies: [],
      models: [],
      tokens: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 },
      tokensTotal: 0,
      unpricedTokens: 0,
    }),
  ) === null,
  'zero usage must render null',
);
const tolerant = render(makeView({ models: [null, 42, makeModel()] }), { locale: 'zh' });
check(tolerant !== null && tolerant !== undefined, 'malformed model entries must be skipped, not crash the pill');

// ---- 5) dialog: one tab per model, DeepSeek dimensions, both locales ------
for (const locale of ['zh', 'en']) {
  const element = openDialog(makeView(), locale);
  const portal = findPortal(element);
  check(portal !== undefined, locale + ': open state must portal a panel');
  if (portal === undefined) continue;
  check(portal.container === global.document.body, locale + ': panel must portal to document.body');
  check(portal.portal.props.role === 'dialog', locale + ': panel must be role=dialog');
  check(
    portal.portal.props['aria-label'] === (locale === 'zh' ? 'Token 费用' : 'Token cost'),
    locale + ': panel aria-label must use the locale title, got ' + portal.portal.props['aria-label'],
  );
  const trigger = findNode(element, (node) => node.type === 'button' && node.props !== undefined && node.props['aria-haspopup'] === 'dialog');
  check(trigger !== undefined && trigger.props['aria-expanded'] === true, locale + ': open trigger must set aria-expanded=true');

  const tablist = tablistOf(element);
  check(tablist !== undefined, locale + ': dialog must render a tablist');
  if (tablist === undefined) continue;
  check(
    tablist.props['aria-label'] === (locale === 'zh' ? '费用明细视图' : 'Cost breakdown views'),
    locale + ': tablist needs a localized aria-label, got ' + tablist.props['aria-label'],
  );

  // No aggregate tab: the session total lives in the title, details are per model.
  const tabs = tabsOf(element);
  check(tabs.length === 1, locale + ': one model must produce exactly one tab, got ' + tabs.length);
  check(tabs[0].props['aria-selected'] === true, locale + ': the only model tab must be selected initially');
  check(findText(tabs[0]).includes('DeepSeek-V4.1-Flash'), locale + ': tab must show the model name, got ' + JSON.stringify(findText(tabs[0])));
  check(findText(tabs[0]).includes('¥1.47'), locale + ': priced tab must append its cost, got ' + JSON.stringify(findText(tabs[0])));

  const tokenRows = collectRows(element, 'data-token-cost-tokens');
  const expectedRows =
    locale === 'zh' ? ['未命中缓存输入', '缓存命中输入', '输出', 'Token 合计'] : ['Uncached input', 'Cache-hit input', 'Output', 'Total tokens'];
  for (const label of expectedRows) check(tokenRows.includes(label), locale + ': missing token row ' + label + ' in ' + JSON.stringify(tokenRows));
  const bandRows = collectRows(element, 'data-token-cost-bands');
  const expectedBands = locale === 'zh' ? ['高峰时段费用', '空闲时段费用'] : ['Peak-band cost', 'Off-peak cost'];
  for (const label of expectedBands) check(bandRows.includes(label), locale + ': missing band row ' + label + ' in ' + JSON.stringify(bandRows));

  const text = findText(element);
  check(/274K/.test(text), locale + ': expected 274K input tokens, got ' + JSON.stringify(text));
  check(/31M/.test(text), locale + ': expected 31M cache-read tokens, got ' + JSON.stringify(text));
  check(/144\.4K/.test(text), locale + ': expected 144.4K output tokens, got ' + JSON.stringify(text));
  check(/31\.5M/.test(text), locale + ': expected 31.5M total tokens, got ' + JSON.stringify(text));
  for (const amount of ['¥0.27', '¥0.62', '¥0.58', '¥1.47']) {
    check(text.includes(amount), locale + ': expected two-decimal amount ' + amount + ' in ' + JSON.stringify(text));
  }
  for (const removed of ['全部', '差额', '估算', '每百万', '价格依据', '节省']) {
    check(!text.includes(removed), locale + ': removed content reappeared: ' + removed);
  }
  if (locale === 'zh') check(!text.includes('Uncached'), 'zh dialog leaked English dictionary text');
  else check(!text.includes('未定价') && !text.includes('全部') && !text.includes('高峰'), 'en dialog leaked Chinese dictionary text');
  check(countDividers(element) >= 2, locale + ': expected section dividers, got ' + countDividers(element));

  // DeepSeek has time bands, so the tab shows them and no "flat price" note.
  check(
    findNode(element, (node) => node.props !== undefined && node.props['data-token-cost-flat'] === true) === undefined,
    locale + ': banded model must not render the flat-price note',
  );
  const panel = tabpanelOf(element);
  check(panel !== undefined, locale + ': dialog must render a tabpanel');
  if (panel !== undefined) {
    const link = findNode(panel, (node) => node.type === 'a');
    check(link !== undefined && link.props.href === SOURCE, locale + ': model tab must link its official price page');
    check(findText(panel).includes(locale === 'zh' ? '官方价格' : 'Official pricing'), locale + ': link needs its localized label');
    check(
      findText(panel).includes(locale === 'zh' ? '数据日期 2026-10-19' : 'Data as of 2026-10-19'),
      locale + ': link row must disclose the price data date, got ' + JSON.stringify(findText(panel)),
    );
  }
}

// ---- 6) dialog: cache-write row only when it has tokens -------------------
for (const locale of ['zh', 'en']) {
  const element = openDialog(makeCacheWriteView(), locale);
  const tokenRows = collectRows(element, 'data-token-cost-tokens');
  check(tokenRows.includes(locale === 'zh' ? '缓存写入' : 'Cache write'), locale + ': cache-write row missing in ' + JSON.stringify(tokenRows));
  const text = findText(element);
  check(text.includes('¥0.03'), locale + ': cache-write bucket cost must be two-decimal, got ' + JSON.stringify(text));
  check(text.includes('¥1.50'), locale + ': cache-write total must be two-decimal, got ' + JSON.stringify(text));
}

// ---- 7) dialog: switching between models keeps each model's own dimensions -
/** One banded DeepSeek model plus one flat-price vendor model. */
function makeTwoModelView() {
  const glmTokens = { input: 100000, cacheRead: 200000, cacheWrite: 0, output: 50000, reasoning: 0 };
  const glmMicros = { input: 400000, cacheRead: 160000, cacheWrite: 0, output: 480000 };
  return makeView({
    models: [
      makeModel(),
      makeModel({
        key: 'zai\u0000glm-4.6',
        provider: 'zai',
        model: 'glm-4.6',
        name: 'GLM-4.6',
        vendor: 'zhipu',
        vendorName: '智谱 AI',
        micro: 1040000,
        tokens: glmTokens,
        tokensTotal: 350000,
        micros: glmMicros,
        peakMicro: null,
        offPeakMicro: null,
        source: 'https://docs.bigmodel.cn/cn/guide/start/pricing',
      }),
    ],
  });
}

for (const locale of ['zh', 'en']) {
  const element = openDialog(makeTwoModelView(), locale);
  const initialTabs = tabsOf(element);
  check(initialTabs.length === 2, locale + ': two models must produce two tabs, got ' + initialTabs.length);
  if (initialTabs.length < 2) continue;
  check(initialTabs[0].props['aria-selected'] === true, locale + ': first model tab must be selected initially');
  check(initialTabs[1].props['aria-selected'] === false, locale + ': second model tab must not be selected initially');
  check(findText(initialTabs[0]).includes('¥1.47'), locale + ': DeepSeek tab must append its cost');
  check(findText(initialTabs[1]).includes('GLM-4.6') && findText(initialTabs[1]).includes('¥1.04'), locale + ': flat model tab needs name + cost');

  initialTabs[1].props.onClick();
  const tabs = tabsOf(element);
  check(tabs[1].props['aria-selected'] === true, locale + ': clicking a model tab must select it');
  check(tabs[0].props['aria-selected'] === false, locale + ': the other tab must be deselected');

  const panel = tabpanelOf(element);
  check(panel !== undefined, locale + ': selected model tab must render a tabpanel');
  if (panel === undefined) continue;
  const panelText = findText(panel);
  check(panelText.includes('zai') && panelText.includes('智谱 AI'), locale + ': flat model tab needs provider/vendor meta, got ' + JSON.stringify(panelText));
  check(/100K/.test(panelText) && /200K/.test(panelText) && /50K/.test(panelText) && /350K/.test(panelText), locale + ': flat model token rows must use K/M');
  for (const amount of ['¥0.40', '¥0.16', '¥0.48']) {
    check(panelText.includes(amount), locale + ': flat model tab missing two-decimal amount ' + amount + ' in ' + JSON.stringify(panelText));
  }
  // A flat-price vendor has no time bands: no band rows, and the tab says so.
  check(collectRows(element, 'data-token-cost-bands').length === 0, locale + ': flat model must not render peak/off-peak rows');
  check(
    findNode(panel, (node) => node.props !== undefined && node.props['data-token-cost-flat'] === true) !== undefined,
    locale + ': flat model tab must explain that it has no peak/off-peak bands',
  );
  check(
    panelText.includes(locale === 'zh' ? '该模型按厂商统一单价计费' : 'No peak/off-peak bands'),
    locale + ': flat-price note must be localized, got ' + JSON.stringify(panelText),
  );
  const flatLink = findNode(panel, (node) => node.type === 'a');
  check(flatLink !== undefined && flatLink.props.href === 'https://docs.bigmodel.cn/cn/guide/start/pricing', locale + ': flat model must link its own official page');

  tabsOf(element)[0].props.onClick();
  const deepseekPanel = tabpanelOf(element);
  check(deepseekPanel !== undefined, locale + ': switching back must render the DeepSeek panel');
  if (deepseekPanel !== undefined) {
    check(collectRows(element, 'data-token-cost-bands').length === 2, locale + ': DeepSeek tab must show peak + off-peak rows');
    check(
      findNode(deepseekPanel, (node) => node.props !== undefined && node.props['data-token-cost-flat'] === true) === undefined,
      locale + ': DeepSeek tab must not render the flat-price note',
    );
    const deepseekLink = findNode(deepseekPanel, (node) => node.type === 'a');
    check(deepseekLink !== undefined && deepseekLink.props.href === SOURCE, locale + ': DeepSeek tab must link its own page');
  }
}

// ---- 8) dialog: keyboard Left/Right/Home/End on the tablist --------------
{
  const element = openDialog(makeTwoModelView(), 'zh');
  const press = (key) => tablistOf(element).props.onKeyDown({ key, preventDefault() {} });
  press('ArrowRight');
  check(tabsOf(element)[1].props['aria-selected'] === true, 'ArrowRight must select the next tab');
  press('ArrowLeft');
  check(tabsOf(element)[0].props['aria-selected'] === true, 'ArrowLeft must select the previous tab');
  press('ArrowLeft');
  check(tabsOf(element)[1].props['aria-selected'] === true, 'ArrowLeft must wrap to the last tab');
  press('End');
  check(tabsOf(element)[1].props['aria-selected'] === true, 'End must select the last tab');
  press('Home');
  check(tabsOf(element)[0].props['aria-selected'] === true, 'Home must select the first tab');
}

// ---- 9) dialog: unpriced model tab shows tokens + 未定价, no link --------
for (const locale of ['zh', 'en']) {
  const element = openDialog(makeMixedView(), locale);
  const tabs = tabsOf(element);
  check(tabs.length === 2, locale + ': mixed view must have one tab per model, got ' + tabs.length);
  if (tabs.length < 2) continue;
  const unpricedLabel = findText(tabs[1]);
  check(unpricedLabel.includes('MiMo-V2.6-Pro'), locale + ': unpriced model tab must show its name, got ' + JSON.stringify(unpricedLabel));
  check(!unpricedLabel.includes('¥'), locale + ': unpriced model tab must not append a cost, got ' + JSON.stringify(unpricedLabel));
  tabs[1].props.onClick();
  const panel = tabpanelOf(element);
  if (panel === undefined) {
    check(false, locale + ': unpriced model tab must render a panel');
    continue;
  }
  const panelText = findText(panel);
  check(panelText.includes(locale === 'zh' ? '未定价' : 'Unpriced'), locale + ': unpriced model tab must say unpriced, got ' + JSON.stringify(panelText));
  check(/\b120\b/.test(panelText), locale + ': unpriced model tab must show its token count, got ' + JSON.stringify(panelText));
  check(panelText.includes('xiaomi') && panelText.includes('Xiaomi'), locale + ': unpriced model tab should show provider/vendor');
  check(
    findNode(panel, (node) => node.props !== undefined && node.props['data-token-cost-unpriced'] === true) !== undefined,
    locale + ': unpriced model tab needs the unpriced marker',
  );
  check(anchorsOf(panel).length === 0, locale + ': unpriced model tab must not render a price link');
  check(
    findNode(panel, (node) => node.props !== undefined && node.props['data-token-cost-flat'] === true) === undefined,
    locale + ': unpriced model must not render the flat-price note',
  );
}

// Unpriced-only dialog: its one model tab renders tokens, no bands/link.
for (const locale of ['zh', 'en']) {
  const element = openDialog(makeUnpricedView(), locale);
  const text = findText(element);
  check(text.includes(locale === 'zh' ? '未定价' : 'Unpriced'), locale + ': unpriced-only dialog title must say unpriced');
  const tabs = tabsOf(element);
  check(tabs.length === 1, locale + ': unpriced-only view must have a single model tab, got ' + tabs.length);
  if (tabs.length === 1) check(tabs[0].props['aria-selected'] === true, locale + ': unpriced model tab must be selected');
  check(collectRows(element, 'data-token-cost-tokens').length > 0, locale + ': unpriced-only dialog must still render token rows');
  check(collectRows(element, 'data-token-cost-bands').length === 0, locale + ': unpriced-only dialog has no band data to show');
  check(anchorsOf(element).length === 0, locale + ': unpriced-only dialog must not render a price link');
}

// ---- 10) dialog: each currency model keeps its own symbol and dimensions --
{
  const element = openDialog(makeMultiCurrencyView(), 'zh');
  const text = findText(element);
  check(text.includes('¥2.32') && text.includes('$0.14'), 'multi-currency dialog title must show every currency total');
  check(text.includes('¥2.32 · $0.14'), 'multi-currency dialog total must join amounts, got ' + JSON.stringify(text));
  const tabs = tabsOf(element);
  check(tabs.length === 2, 'multi-currency dialog must have one tab per model, got ' + tabs.length);
  if (tabs.length === 2) {
    check(findText(tabs[0]).includes('¥2.32'), 'CNY model tab must append its CNY amount');
    check(findText(tabs[1]).includes('$0.14'), 'USD model tab must append its USD amount');
  }

  // The selected CNY model tab shows CNY costs and its own band rows.
  const cnyPanel = tabpanelOf(element);
  check(cnyPanel !== undefined, 'CNY model tab must render a panel');
  if (cnyPanel !== undefined) {
    const cnyText = findText(cnyPanel);
    check(cnyText.includes('¥1.20') && cnyText.includes('¥0.22') && cnyText.includes('¥0.90'), 'CNY model tab must show CNY bucket costs, got ' + JSON.stringify(cnyText));
    check(!cnyText.includes('$'), 'CNY model tab must not mix in the USD symbol');
    const cnyBands = collectRows(element, 'data-token-cost-bands');
    check(cnyBands.length === 2 && cnyBands.includes('高峰时段费用') && cnyBands.includes('空闲时段费用'), 'CNY model tab must show its band rows, got ' + JSON.stringify(cnyBands));
    const cnyLink = findNode(cnyPanel, (node) => node.type === 'a');
    check(cnyLink !== undefined && cnyLink.props.href === 'https://example.test/cny-pricing', 'CNY model tab must link its own source');
  }

  tabsOf(element)[1].props.onClick();
  const panel = tabpanelOf(element);
  check(panel !== undefined, 'USD model tab must render a panel');
  if (panel !== undefined) {
    const panelText = findText(panel);
    check(panelText.includes('$0.09') && panelText.includes('$0.05'), 'USD model tab must use its own currency symbol, got ' + JSON.stringify(panelText));
    check(!panelText.includes('¥'), 'USD model tab must not mix in the CNY symbol');
    const usdBands = collectRows(element, 'data-token-cost-bands');
    check(usdBands.length === 2, 'USD model tab must show its own band rows, got ' + JSON.stringify(usdBands));
    const link = findNode(panel, (node) => node.type === 'a');
    check(link !== undefined && link.props.href === 'https://example.test/usd-pricing', 'USD model tab must link its own source');
  }
}

// ---- 11) dialog: bands only when reported, link only when present --------
for (const locale of ['zh', 'en']) {
  const plain = openDialog(makeView({ models: [makeModel({ peakMicro: null, offPeakMicro: null, source: null })] }), locale);
  const plainPanel = tabpanelOf(plain);
  check(plainPanel !== undefined, locale + ': flat model tab must render a panel');
  if (plainPanel === undefined) continue;
  check(collectRows(plain, 'data-token-cost-bands').length === 0, locale + ': null model peak/off-peak must not render band rows');
  check(anchorsOf(plainPanel).length === 0, locale + ': priced model without a source must not render a link');
  check(findText(plainPanel).includes('¥0.27'), locale + ': model costs must still render without a source');
  check(
    findNode(plainPanel, (node) => node.props !== undefined && node.props['data-token-cost-flat'] === true) !== undefined,
    locale + ': flat model without bands must render the flat-price note',
  );
}
{
  const partial = openDialog(makeView({ models: [makeModel({ peakMicro: null, offPeakMicro: 0 })] }), 'zh');
  const partialBands = collectRows(partial, 'data-token-cost-bands');
  check(partialBands.length === 1 && partialBands[0] === '空闲时段费用', 'only the non-null band row must render, got ' + JSON.stringify(partialBands));
  check(
    findNode(partial, (node) => node.props !== undefined && node.props['data-token-cost-flat'] === true) === undefined,
    'a model with any reported band must not render the flat-price note',
  );
}

// ---- 12) dialog: tab index clamps when the models list shrinks -----------
{
  const trioView = makeView({
    models: [
      makeModel({ key: 'm1', model: 'model-1', name: 'Model One' }),
      makeModel({ key: 'm2', model: 'model-2', name: 'Model Two' }),
      makeModel({ key: 'm3', model: 'model-3', name: 'Model Three' }),
    ],
  });
  const element = openDialog(trioView, 'zh');
  const tabs = tabsOf(element);
  check(tabs.length === 3, 'three-model view needs three model tabs, got ' + tabs.length);
  if (tabs.length === 3) {
    tabs[2].props.onClick();
    check(tabsOf(element)[2].props['aria-selected'] === true, 'last model tab must be selectable');
  }
  // Re-render the same dialog with fewer models while the third tab is
  // selected: the index must clamp to the only remaining tab, never throw.
  const shrunk = render(makeView(), { locale: 'zh', resetHooks: false });
  const shrunkTabs = tabsOf(shrunk);
  check(shrunkTabs.length === 1, 'shrunk view must rebuild the tab strip, got ' + shrunkTabs.length);
  check(shrunkTabs[0].props['aria-selected'] === true, 'stale tab index must clamp to the remaining tab');
  check(tabpanelOf(shrunk) !== undefined, 'clamped tab must render a panel');
  check(findText(tabpanelOf(shrunk)).includes('¥1.47'), 'clamped model tab must render the new model content');
}

// ---- 14) settings panel: localized controls, selected state, back --------
for (const locale of ['zh', 'en']) {
  resetStorage();
  const element = openDialog(makeView(), locale);
  const toggle = settingsToggleOf(element);
  check(toggle !== undefined, locale + ': dialog title row must render the settings button');
  if (toggle === undefined) continue;
  check(toggle.props['aria-label'] === (locale === 'zh' ? '设置' : 'Settings'), locale + ': settings button aria-label must be localized, got ' + toggle.props['aria-label']);
  check(toggle.props['aria-expanded'] === false, locale + ': settings button must start collapsed');
  const titleRow = findNode(
    element,
    (node) => typeof node.type === 'string' && node.props !== undefined && typeof node.props.className === 'string' && node.props.className.endsWith('_title'),
  );
  check(
    titleRow !== undefined && findNode(titleRow, (node) => node.props !== undefined && node.props['data-token-cost-settings-toggle'] === true) !== undefined,
    locale + ': settings button must sit in the dialog title row',
  );

  const panel = openSettings(element);
  check(panel !== undefined, locale + ': settings button must open the settings panel');
  if (panel === undefined) continue;
  check(settingsToggleOf(element).props['aria-expanded'] === true, locale + ': settings button must be expanded while settings are open');
  check(tabsOf(element).length === 0, locale + ': settings screen must replace the breakdown tabs');
  const panelText = findText(panel);
  check(panelText.includes(locale === 'zh' ? '设置' : 'Settings'), locale + ': settings heading must be localized');
  check(panelText.includes(locale === 'zh' ? '界面语言' : 'Language'), locale + ': language row label must be localized');
  check(panelText.includes(locale === 'zh' ? '显示货币' : 'Display currency'), locale + ': currency row label must be localized');

  const languageLabels = locale === 'zh' ? ['跟随应用', '中文', 'English'] : ['Follow app', '中文', 'English'];
  const languageValues = ['auto', 'zh', 'en'];
  for (let i = 0; i < languageValues.length; i += 1) {
    const choice = settingChoiceOf(element, 'language', languageValues[i]);
    check(choice !== undefined, locale + ': missing language option ' + languageValues[i]);
    if (choice === undefined) continue;
    check(findText(choice) === languageLabels[i], locale + ': language option copy, got ' + JSON.stringify(findText(choice)));
    check(choice.props['aria-pressed'] === (i === 0), locale + ': language selected state must show on ' + languageValues[i]);
  }

  const currencyLabels = locale === 'zh' ? ['原币种', 'CNY ¥', 'USD $'] : ['Native', 'CNY ¥', 'USD $'];
  const currencyValues = ['native', 'CNY', 'USD'];
  for (let i = 0; i < currencyValues.length; i += 1) {
    const choice = settingChoiceOf(element, 'currency', currencyValues[i]);
    check(choice !== undefined, locale + ': missing currency option ' + currencyValues[i]);
    if (choice === undefined) continue;
    check(findText(choice) === currencyLabels[i], locale + ': currency option copy, got ' + JSON.stringify(findText(choice)));
    check(choice.props['aria-pressed'] === (i === 0), locale + ': currency selected state must show on ' + currencyValues[i]);
  }

  check(panelText.includes('1 USD = ¥'), locale + ': fx input label must be visible');
  const fx = fxInputOf(element);
  check(fx !== undefined, locale + ': missing fx rate input');
  if (fx !== undefined) {
    check(fx.props.type === 'number' && fx.props.step === 0.01, locale + ': fx input must be a number input with step 0.01');
    check(fx.props.value === '7.2', locale + ': fx input must show the current rate, got ' + JSON.stringify(fx.props.value));
    check(fx.props['aria-label'] === '1 USD = ¥', locale + ': fx input needs the localized label as aria-label');
  }
  check(panelText.includes(locale === 'zh' ? '自定义估算汇率' : 'User-set estimate'), locale + ': fx helper text must note the user-set estimate');
  check(panelText.includes(locale === 'zh' ? '返回明细' : 'Back to breakdown'), locale + ': settings needs a back control');

  const back = settingsBackOf(element);
  check(back !== undefined, locale + ': missing settings back control');
  if (back !== undefined) {
    back.props.onClick();
    check(settingsPanelOf(element) === undefined, locale + ': back control must leave the settings screen');
    check(tabsOf(element).length === 1, locale + ': back control must restore the breakdown tabs');
    check(settingsToggleOf(element).props['aria-expanded'] === false, locale + ': settings button must collapse after going back');
  }
}

// ---- 15) language override applies immediately and persists --------------
{
  resetStorage();
  const view = makeMixedView();
  let element = openDialog(view, 'zh');
  check(openSettings(element) !== undefined, 'language test: settings panel must open');
  settingChoiceOf(element, 'language', 'en').props.onClick();
  check(storedSettings() !== null && storedSettings().language === 'en', 'language change must persist, got ' + JSON.stringify(storedSettings()));
  check(storageWrites.length > 0 && storageWrites[storageWrites.length - 1].key === SETTINGS_KEY, 'language change must write the settings key');

  element = rerender(view, 'zh'); // app locale stays zh; the plugin override is en
  let panel = settingsPanelOf(element);
  check(panel !== undefined, 'language override: settings screen must stay open across the re-render');
  if (panel !== undefined) {
    check(findText(panel).includes('Settings'), 'language override must localize the settings panel immediately');
    check(!findText(panel).includes('设置'), 'language override must remove the app-provided Chinese copy');
  }
  check(settingsToggleOf(element).props['aria-label'] === 'Settings', 'language override must localize the settings button aria-label');
  settingsBackOf(element).props.onClick();
  check(collectRows(element, 'data-token-cost-tokens').includes('Uncached input'), 'language override must localize model rows');
  check(!collectRows(element, 'data-token-cost-tokens').includes('未命中缓存输入'), 'language override must not keep app-provided Chinese rows');
  tabsOf(element)[1].props.onClick();
  check(findText(tabpanelOf(element)).includes('Unpriced'), 'language override must localize the unpriced marker');

  // Back to auto: the app-provided translator applies again.
  check(openSettings(element) !== undefined, 'language test: settings panel must reopen');
  settingChoiceOf(element, 'language', 'auto').props.onClick();
  check(storedSettings().language === 'auto', 'switching back to auto must persist');
  element = rerender(view, 'zh');
  panel = settingsPanelOf(element);
  check(panel !== undefined, 'auto language: settings screen must stay open');
  if (panel !== undefined) {
    check(findText(panel).includes('设置'), 'auto language must restore the app-provided Chinese translator');
    check(!findText(panel).includes('Settings'), 'auto language must not keep the English override');
  }

  // The override also applies to strings outside the dialog (pill).
  resetStorage({ language: 'en', currency: 'native', fxRate: 7.2 });
  check(
    findText(render(makeUnpricedView(), { locale: 'zh' })).includes('Unpriced'),
    'language override must localize the unpriced pill outside the dialog',
  );
  resetStorage();
}

// ---- 16) CNY display mode converts a mixed CNY+USD view ------------------
for (const locale of ['zh', 'en']) {
  resetStorage({ language: 'auto', currency: 'CNY', fxRate: 7.2 });
  const element = openDialog(makeFxView(), locale);
  check(titleValueOf(element) !== undefined && findText(titleValueOf(element)) === '¥103.12', locale + ': converted title must be one CNY total, got ' + JSON.stringify(findText(titleValueOf(element))));
  check(pillTextOf(element) === '¥103.12', locale + ': converted pill must be one CNY total, got ' + JSON.stringify(pillTextOf(element)));
  const tabs = tabsOf(element);
  check(tabs.length === 2, locale + ': converted dialog must keep one tab per model, got ' + tabs.length);
  if (tabs.length === 2) {
    check(findText(tabs[0]).includes('¥2.32'), locale + ': CNY model tab must keep its amount');
    check(findText(tabs[1]).includes('¥100.80'), locale + ': USD model tab must convert to CNY, got ' + JSON.stringify(findText(tabs[1])));
    check(!findText(tabs[1]).includes('$'), locale + ': converted model tab must not show $');
  }
  const fx = fxLineOf(element);
  check(fx !== undefined, locale + ': conversion mode must show the FX line');
  if (fx !== undefined) {
    const expectedFx = locale === 'zh' ? '汇率 1 USD = ¥7.20（估算）' : 'FX 1 USD = ¥7.20 (estimate)';
    check(findText(fx) === expectedFx, locale + ': FX line copy, got ' + JSON.stringify(findText(fx)));
  }
  check(!findText(element).includes('$'), locale + ': converted dialog must not mix in any $ amount');
}
{
  // The selected USD model tab shows converted bucket and band amounts.
  resetStorage({ language: 'auto', currency: 'CNY', fxRate: 7.2 });
  const element = openDialog(makeFxView(), 'zh');
  tabsOf(element)[1].props.onClick();
  const panel = tabpanelOf(element);
  check(panel !== undefined, 'CNY mode: USD model tab must render a panel');
  if (panel !== undefined) {
    const panelText = findText(panel);
    for (const amount of ['¥43.20', '¥14.40', '¥36.00', '¥64.80']) {
      check(panelText.includes(amount), 'CNY mode: USD model tab missing converted amount ' + amount + ' in ' + JSON.stringify(panelText));
    }
    check(!panelText.includes('$'), 'CNY mode: converted model rows must not show $');
  }
}

// ---- 17) USD display mode converts a CNY view ----------------------------
{
  resetStorage({ language: 'auto', currency: 'USD', fxRate: 7.2 });
  const element = openDialog(makeUsdTargetView(), 'zh');
  const titleText = findText(titleValueOf(element));
  check(titleText === '$2.04', 'USD mode title must be the rounded converted total, got ' + JSON.stringify(titleText));
  check(pillTextOf(element) === '$2.04', 'USD mode pill must be one $ total, got ' + JSON.stringify(pillTextOf(element)));
  const tabs = tabsOf(element);
  check(tabs.length === 1, 'USD mode must keep the model tab');
  if (tabs.length === 1) {
    check(findText(tabs[0]).includes('$2.04'), 'USD mode model tab amount must convert, got ' + JSON.stringify(findText(tabs[0])));
    check(!findText(tabs[0]).includes('¥'), 'USD mode model tab must not show ¥');
  }
  const panel = tabpanelOf(element);
  check(panel !== undefined, 'USD mode must render the model panel');
  const panelText = panel === undefined ? '' : findText(panel);
  check(panelText.includes('$0.69') && panelText.includes('$0.28') && panelText.includes('$1.07'), 'USD mode model rows must convert with the $ symbol, got ' + JSON.stringify(panelText));
  check(panelText.includes('$0.56') && panelText.includes('$1.49'), 'USD mode band rows must convert with the $ symbol, got ' + JSON.stringify(panelText));
  check(!panelText.includes('¥'), 'USD mode model panel must not show ¥');
  const fx = fxLineOf(element);
  check(fx !== undefined && findText(fx).includes('¥7.20'), 'USD mode FX line must still show the USD->CNY rate');
}

// ---- 18) fx rate edit re-converts; invalid input is ignored --------------
{
  resetStorage({ language: 'auto', currency: 'CNY', fxRate: 7.2 });
  const view = makeFxView();
  let element = openDialog(view, 'zh');
  check(openSettings(element) !== undefined, 'fx test: settings panel must open');
  let input = fxInputOf(element);
  check(input !== undefined && input.props.value === '7.2', 'fx test: input must start at the stored rate');
  if (input === undefined) {
    check(false, 'fx test: missing input');
  } else {
    input.props.onChange({ target: { value: '8' } });
    check(storedSettings() !== null && storedSettings().fxRate === 8, 'valid fx edit must persist, got ' + JSON.stringify(storedSettings()));
    element = rerender(view, 'zh');
    check(findText(titleValueOf(element)) === '¥114.32', 'fx edit must re-convert the total, got ' + JSON.stringify(findText(titleValueOf(element))));
    const fx = fxLineOf(element);
    check(fx !== undefined && findText(fx).includes('¥8.00'), 'fx line must show the edited rate, got ' + JSON.stringify(fx === undefined ? undefined : findText(fx)));
    // Back to the breakdown to see the converted tab amount.
    settingsBackOf(element).props.onClick();
    const usdTab = tabsOf(element)[1];
    check(
      usdTab !== undefined && findText(usdTab).includes('¥112.00'),
      'fx edit must re-convert the model tab amount, got ' + JSON.stringify(usdTab === undefined ? undefined : findText(usdTab)),
    );

    // Invalid inputs stay in the field but are neither persisted nor converted.
    check(openSettings(element) !== undefined, 'fx test: settings must reopen');
    input = fxInputOf(element);
    const writesBefore = storageWrites.length;
    input.props.onChange({ target: { value: 'abc' } });
    check(storageWrites.length === writesBefore, 'invalid fx input must not write localStorage');
    input.props.onChange({ target: { value: '-3' } });
    input.props.onChange({ target: { value: '' } });
    input.props.onChange(null);
    check(storedSettings().fxRate === 8, 'invalid fx input must keep the stored rate, got ' + JSON.stringify(storedSettings()));
    element = rerender(view, 'zh');
    check(findText(titleValueOf(element)) === '¥114.32', 'invalid fx input must not change the conversion');
    // Out-of-range rates clamp to the sane bounds instead of breaking formatting.
    input = fxInputOf(element);
    input.props.onChange({ target: { value: '100000000' } });
    check(storedSettings().fxRate === 10000, 'out-of-range fx input must clamp, got ' + JSON.stringify(storedSettings()));
    check(fxLineOf(rerender(view, 'zh')) !== undefined, 'clamped fx rate must still render the FX line');
  }
}

// ---- 19) native mode keeps the mixed-currency display -------------------
{
  resetStorage({ language: 'auto', currency: 'native', fxRate: 7.2 });
  const view = makeMultiCurrencyView();
  let element = openDialog(view, 'zh');
  check(pillTextOf(element) === '¥2.32 · $0.14', 'native pill must join the mixed amounts, got ' + JSON.stringify(pillTextOf(element)));
  check(fxLineOf(element) === undefined, 'native mode must not render the FX line');
  check(openSettings(element) !== undefined, 'native test: settings panel must open');
  settingChoiceOf(element, 'currency', 'CNY').props.onClick();
  element = rerender(view, 'zh');
  const cnyPill = pillTextOf(element);
  check(cnyPill.includes('¥') && !cnyPill.includes('$'), 'CNY mode pill must be one ¥ total, got ' + JSON.stringify(cnyPill));
  check(fxLineOf(element) !== undefined, 'CNY mode must render the FX line');
  check(settingsPanelOf(element) !== undefined, 'settings must stay open after a currency change');
  settingChoiceOf(element, 'currency', 'native').props.onClick();
  element = rerender(view, 'zh');
  check(pillTextOf(element) === '¥2.32 · $0.14', 'switching back to native must restore the mixed pill, got ' + JSON.stringify(pillTextOf(element)));
  check(fxLineOf(element) === undefined, 'native mode must hide the FX line again');
  settingsBackOf(element).props.onClick();
  const nativeText = findText(element);
  check(
    !nativeText.includes('FX 1 USD') && !nativeText.includes('汇率 1 USD'),
    'native mode must not render conversion copy on the breakdown, got ' + JSON.stringify(nativeText),
  );
}

// ---- 20) preferences persist across a fresh mount -----------------------
{
  resetStorage();
  const view = makeFxView();
  const element = openDialog(view, 'zh');
  check(openSettings(element) !== undefined, 'persistence test: settings panel must open');
  settingChoiceOf(element, 'language', 'en').props.onClick();
  settingChoiceOf(element, 'currency', 'CNY').props.onClick();
  fxInputOf(element).props.onChange({ target: { value: '8' } });
  check(
    JSON.stringify(storedSettings()) === JSON.stringify({ language: 'en', currency: 'CNY', fxRate: 8 }),
    'all three preferences must persist together, got ' + JSON.stringify(storedSettings()),
  );
  // Fresh mount: hook state is dropped, storage is read again.
  const fresh = openDialog(view, 'zh');
  check(fresh !== null, 'fresh mount must render');
  check(pillTextOf(fresh) === '¥114.32', 'fresh mount must restore the converted currency, got ' + JSON.stringify(pillTextOf(fresh)));
  const freshFx = fxLineOf(fresh);
  check(freshFx !== undefined && findText(freshFx) === 'FX 1 USD = ¥8.00 (estimate)', 'fresh mount must restore language + fx rate, got ' + JSON.stringify(freshFx === undefined ? undefined : findText(freshFx)));
  check(settingsToggleOf(fresh).props['aria-label'] === 'Settings', 'fresh mount must restore the language override');
  check(
    findPortal(fresh).portal.props['aria-label'] === 'Token cost',
    'fresh mount must localize the dialog aria-label with the stored language',
  );
  check(
    findText(findPortal(fresh).portal).includes('Token cost'),
    'fresh mount must localize the dialog title with the stored language',
  );

  // Closing and reopening the dialog keeps the persisted preferences.
  findNode(fresh, (node) => node.type === 'button' && node.props !== undefined && node.props['aria-haspopup'] === 'dialog').props.onClick();
  const closedTree = rerender(view, 'zh');
  check(findPortal(closedTree) === undefined, 'closing the dialog must remove the portal');
  const closedTrigger = findNode(closedTree, (node) => node.type === 'button' && node.props !== undefined && node.props['aria-haspopup'] === 'dialog');
  check(
    closedTrigger !== undefined && closedTrigger.props['aria-label'].startsWith('Token cost'),
    'persisted language must survive closing the dialog, got ' + (closedTrigger === undefined ? 'no trigger' : closedTrigger.props['aria-label']),
  );
  closedTrigger.props.onClick();
  const reopened = rerender(view, 'zh');
  check(findPortal(reopened) !== undefined, 'reopening the dialog must restore the panel');
  check(findText(findPortal(reopened).portal).includes('Token cost'), 'reopened dialog must keep the persisted language');
}

// ---- 21) malformed storage and missing localStorage are safe ------------
{
  resetStorage('{not-json');
  check(findText(render(makeView(), { locale: 'zh' })).includes('¥1.47'), 'malformed stored JSON must fall back to defaults');
  resetStorage({ language: 'xx', currency: 'BTC', fxRate: -5 });
  const invalidFields = render(makeView(), { locale: 'zh' });
  check(findText(invalidFields).includes('¥1.47'), 'invalid stored fields must fall back to the native defaults');
  resetStorage({ language: 'auto', currency: 'native', fxRate: 1e9 });
  const clamped = openDialog(makeView(), 'zh');
  check(clamped !== null, 'out-of-range stored fx rate must not crash');
  if (openSettings(clamped) !== undefined) {
    const fx = fxInputOf(clamped);
    check(fx !== undefined && fx.props.value === '10000', 'stored fx rate must clamp to the sane maximum, got ' + (fx === undefined ? undefined : JSON.stringify(fx.props.value)));
  }

  // FX line numbers: up to 4 decimals, trimmed to at least 2.
  resetStorage({ language: 'auto', currency: 'CNY', fxRate: 7.2345 });
  check(
    findText(fxLineOf(openDialog(makeView(), 'zh'))).includes('¥7.2345'),
    'FX line must keep up to 4 meaningful decimals, got ' + JSON.stringify(findText(fxLineOf(render(makeView(), { locale: 'zh' })))),
  );
  resetStorage({ language: 'auto', currency: 'CNY', fxRate: 7.2 });
  check(
    findText(fxLineOf(openDialog(makeView(), 'zh'))).includes('¥7.20'),
    'FX line must trim trailing zeros but keep two decimals',
  );

  clearStorage(); // no localStorage global at all
  const noStoragePill = render(makeView(), { locale: 'zh' });
  check(noStoragePill !== null && findText(noStoragePill).includes('¥1.47'), 'missing localStorage must fall back to defaults');
  const noStorageDialog = openDialog(makeView(), 'zh');
  check(noStorageDialog !== null, 'missing localStorage must not break the dialog');
  if (openSettings(noStorageDialog) !== undefined) {
    settingChoiceOf(noStorageDialog, 'language', 'en').props.onClick();
    settingChoiceOf(noStorageDialog, 'currency', 'CNY').props.onClick();
  }
  const inMemory = rerender(makeView(), 'zh');
  check(inMemory !== null, 'missing localStorage must not break in-memory preference changes');
  const inMemoryFx = fxLineOf(inMemory);
  check(inMemoryFx !== undefined && findText(inMemoryFx) === 'FX 1 USD = ¥7.20 (estimate)', 'missing localStorage must still apply changes in memory, got ' + JSON.stringify(inMemoryFx === undefined ? undefined : findText(inMemoryFx)));
  resetStorage();
}

// ---- 22) locale dictionaries: parity, coverage and no unresolved keys ----
const zhKeys = Object.keys(dictionaries.zh);
const enKeys = Object.keys(dictionaries.en);
check(zhKeys.slice().sort().join('|') === enKeys.slice().sort().join('|'), 'zh and en dictionaries must define the same keys');
for (const key of zhKeys) {
  check(typeof dictionaries.zh[key] === 'string' && dictionaries.zh[key] !== '', 'zh locale key must be a non-empty string: ' + key);
  check(typeof dictionaries.en[key] === 'string' && dictionaries.en[key] !== '', 'en locale key must be a non-empty string: ' + key);
  check(usedKeys.has('zh:' + key), 'locale key never exercised in zh: ' + key);
  check(usedKeys.has('en:' + key), 'locale key never exercised in en: ' + key);
}
check(missingKeys.size === 0, 'unresolved locale keys: ' + JSON.stringify([...missingKeys]));

// ---- report --------------------------------------------------------------
if (failures.length > 0) {
  console.error('COMPONENT TEST FAILED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('COMPONENT TEST OK');
const reportPill = render(makeView(), { locale: 'zh' });
const reportDialog = openDialog(makeView(), 'zh');
console.log(
  JSON.stringify(
    {
      localeKeys: { zh: zhKeys.length, en: enKeys.length },
      pillText: findText(reportPill),
      tabs: tabsOf(reportDialog).map((tab) => findText(tab)),
      modelRows: collectRows(reportDialog, 'data-token-cost-tokens'),
      bandRows: collectRows(reportDialog, 'data-token-cost-bands'),
    },
    null,
    2,
  ),
);
