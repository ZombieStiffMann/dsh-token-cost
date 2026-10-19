// Render-path test for the cost pill's client half.
//
// Loads the real client.js through a fake module loader with a minimal React
// stub (no DOM renderer), then exercises the states the pill and its breakdown
// dialog must handle: normal cost, missing projection, zero usage,
// unpriced-only, mixed unpriced, malformed view, currency totals, the
// per-model tab strip (aggregate tab, model tabs, keyboard switching, tab
// clamping when the models list shrinks), K/M token counts, two-decimal money,
// dividers, per-model official price links and locale key resolution.
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
let pendingFirstState = null;

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
      let value = init;
      // The pill's first hook is its open/closed state; let a render request
      // ask for an already-open dialog without reaching into the component.
      if (pendingFirstState !== null) {
        value = pendingFirstState;
        pendingFirstState = null;
      }
      cell.store.cells[cell.index] = { value };
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
 * Render the pill (and, when `open`, its portal panel) for a projection view.
 * Hook state is reset per scenario unless `resetHooks: false`, which re-renders
 * a new view while keeping the dialog's tab selection.
 */
function render(view, settings) {
  const config = settings || {};
  if (config.resetHooks !== false) hookStore.clear();
  pendingFirstState = config.open === true ? true : null;
  try {
    let element = CostPill({
      useProjection: (key) => (key === 'tokenCost' ? view : undefined),
      t: makeT(config.locale || 'zh'),
    });
    if (element !== null && typeof element === 'object' && typeof element.type === 'function') {
      element = invoke(element.type, element.props);
    }
    return element;
  } finally {
    pendingFirstState = null;
  }
}

function openDialog(view, locale, settings) {
  return render(view, Object.assign({ open: true, locale: locale || 'zh' }, settings || {}));
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
check(
  render({
    currency: { code: 'CNY', symbol: '¥' },
    micro: 1472358,
    tokens: BASE_TOKENS,
    tokensTotal: BASE_TOTAL,
    models: [],
  }) === null,
  'the pre-tab single-currency view shape is malformed and must render null',
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

// ---- 5) dialog: aggregate tab, both locales ------------------------------
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

  const tabs = tabsOf(element);
  check(tabs.length === 2, locale + ': expected 全部 + one model tab, got ' + tabs.length);
  check(findText(tabs[0]) === (locale === 'zh' ? '全部' : 'All'), locale + ': first tab must be the aggregate tab, got ' + JSON.stringify(findText(tabs[0])));
  check(tabs[0].props['aria-selected'] === true, locale + ': the aggregate tab must be selected initially');
  check(tabs[1].props['aria-selected'] === false, locale + ': model tab must not be selected initially');
  check(findText(tabs[1]).includes('DeepSeek-V4.1-Flash'), locale + ': model tab must show the short model name');
  check(findText(tabs[1]).includes('¥1.47'), locale + ': priced model tab must append its cost, got ' + JSON.stringify(findText(tabs[1])));

  const tokenRows = collectRows(element, 'data-token-cost-tokens');
  const expectedRows =
    locale === 'zh' ? ['未命中缓存输入', '缓存命中输入', '输出', 'Token 合计'] : ['Uncached input', 'Cache-hit input', 'Output', 'Total tokens'];
  for (const label of expectedRows) check(tokenRows.includes(label), locale + ': missing token row ' + label + ' in ' + JSON.stringify(tokenRows));
  const bandRows = collectRows(element, 'data-token-cost-bands');
  const expectedBands = locale === 'zh' ? ['高峰时段费用', '空闲时段费用'] : ['Peak-band cost', 'Off-peak cost'];
  for (const label of expectedBands) check(bandRows.includes(label), locale + ': missing band row ' + label + ' in ' + JSON.stringify(bandRows));

  const text = findText(element);
  // K/M token magnitudes in the aggregate token rows and the total.
  check(/274K/.test(text), locale + ': expected 274K input tokens, got ' + JSON.stringify(text));
  check(/31M/.test(text), locale + ': expected 31M cache-read tokens, got ' + JSON.stringify(text));
  check(/144\.4K/.test(text), locale + ': expected 144.4K output tokens, got ' + JSON.stringify(text));
  check(/31\.5M/.test(text), locale + ': expected 31.5M total tokens, got ' + JSON.stringify(text));
  // Money rounded to two decimals: ¥0.27 / ¥0.62 / ¥0.58 / ¥1.47.
  for (const amount of ['¥0.27', '¥0.62', '¥0.58', '¥1.47']) {
    check(text.includes(amount), locale + ': expected two-decimal amount ' + amount + ' in ' + JSON.stringify(text));
  }
  // Removed content must not come back.
  for (const removed of ['差额', '估算', '每百万', '价格依据', '节省']) {
    check(!text.includes(removed), locale + ': removed content reappeared: ' + removed);
  }
  // Locale isolation: nothing from the other dictionary.
  if (locale === 'zh') check(!text.includes('Uncached'), 'zh dialog leaked English dictionary text');
  else check(!text.includes('未定价') && !text.includes('全部'), 'en dialog leaked Chinese dictionary text');
  check(countDividers(element) >= 3, locale + ': expected section dividers, got ' + countDividers(element));
  // Aggregate tab has no global footer / price link; links are per model.
  const aggregatePanel = tabpanelOf(element);
  check(aggregatePanel !== undefined, locale + ': dialog must render a tabpanel');
  if (aggregatePanel !== undefined) check(anchorsOf(aggregatePanel).length === 0, locale + ': aggregate tab must not render a price link');
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

// ---- 7) dialog: switching to a model tab shows its rows, bands and link ---
for (const locale of ['zh', 'en']) {
  const element = openDialog(makeView(), locale);
  const initialTabs = tabsOf(element);
  if (initialTabs.length < 2) {
    check(false, locale + ': model tab missing for switching test');
    continue;
  }
  initialTabs[1].props.onClick();
  const tabs = tabsOf(element);
  check(tabs[1].props['aria-selected'] === true, locale + ': clicking a model tab must select it');
  check(tabs[0].props['aria-selected'] === false, locale + ': clicking a model tab must deselect the aggregate tab');

  const panel = tabpanelOf(element);
  check(panel !== undefined, locale + ': model tab must render a tabpanel');
  if (panel === undefined) continue;
  const panelText = findText(panel);
  check(panelText.includes('deepseek-official'), locale + ': model tab needs its provider line, got ' + JSON.stringify(panelText));
  check(panelText.includes('DeepSeek'), locale + ': model tab needs its vendor line');
  check(/274K/.test(panelText) && /31M/.test(panelText) && /144\.4K/.test(panelText) && /31\.5M/.test(panelText), locale + ': model tab token rows must use K/M');
  for (const amount of ['¥0.27', '¥0.62', '¥0.58', '¥1.47']) {
    check(panelText.includes(amount), locale + ': model tab missing two-decimal amount ' + amount + ' in ' + JSON.stringify(panelText));
  }
  const modelBandRows = collectRows(element, 'data-token-cost-bands');
  check(modelBandRows.includes(locale === 'zh' ? '高峰时段费用' : 'Peak-band cost'), locale + ': model tab must show non-null peak band');
  check(modelBandRows.includes(locale === 'zh' ? '空闲时段费用' : 'Off-peak cost'), locale + ': model tab must show non-null off-peak band');
  check(
    findNode(panel, (node) => node.props !== undefined && node.props['data-token-cost-model-meta'] === true) !== undefined,
    locale + ': model tab must render the provider/vendor meta line',
  );

  const link = findNode(panel, (node) => node.type === 'a');
  check(link !== undefined, locale + ': model tab is missing the official price link');
  if (link !== undefined) {
    check(link.props.href === SOURCE, locale + ': link must point at that model source, got ' + link.props.href);
    check(link.props.target === '_blank', locale + ': link must open a new tab');
    check(typeof link.props.rel === 'string' && link.props.rel.includes('noopener') && link.props.rel.includes('noreferrer'), locale + ': link rel must be safe');
    check(findText(link) === SOURCE, locale + ': link must show the visible URL, got ' + JSON.stringify(findText(link)));
  }
  check(findText(panel).includes(locale === 'zh' ? '官方价格' : 'Official pricing'), locale + ': link needs its localized label');

  // Back to the aggregate tab: the model-only content must disappear.
  tabsOf(element)[0].props.onClick();
  const backPanel = tabpanelOf(element);
  check(backPanel !== undefined, locale + ': returning to the aggregate tab must render a panel');
  if (backPanel !== undefined) {
    check(
      findNode(backPanel, (node) => node.props !== undefined && node.props['data-token-cost-model-meta'] === true) === undefined,
      locale + ': aggregate tab must not render model meta',
    );
    check(anchorsOf(backPanel).length === 0, locale + ': aggregate tab must not render the model price link');
  }
}

// ---- 8) dialog: keyboard Left/Right/Home/End on the tablist --------------
{
  const element = openDialog(makeView(), 'zh');
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
  check(tabs.length === 3, locale + ': mixed view must have aggregate + two model tabs, got ' + tabs.length);
  if (tabs.length < 3) continue;
  const unpricedLabel = findText(tabs[2]);
  check(unpricedLabel.includes('MiMo-V2.6-Pro'), locale + ': unpriced model tab must show its name, got ' + JSON.stringify(unpricedLabel));
  check(!unpricedLabel.includes('¥'), locale + ': unpriced model tab must not append a cost, got ' + JSON.stringify(unpricedLabel));
  tabs[2].props.onClick();
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
}

// Unpriced-only dialog: aggregate renders tokens, title says unpriced, no bands/link.
for (const locale of ['zh', 'en']) {
  const element = openDialog(makeUnpricedView(), locale);
  const text = findText(element);
  check(text.includes(locale === 'zh' ? '未定价' : 'Unpriced'), locale + ': unpriced-only dialog title must say unpriced');
  check(collectRows(element, 'data-token-cost-tokens').length > 0, locale + ': unpriced-only dialog must still render token rows');
  check(collectRows(element, 'data-token-cost-bands').length === 0, locale + ': unpriced-only dialog has no band data to show');
  check(anchorsOf(element).length === 0, locale + ': unpriced-only dialog must not render a price link');
}

// ---- 10) dialog: multiple currencies per-currency rows and tabs ----------
{
  const element = openDialog(makeMultiCurrencyView(), 'zh');
  const text = findText(element);
  check(text.includes('¥2.32') && text.includes('$0.14'), 'multi-currency dialog title must show every currency total');
  check(text.includes('¥2.32 · $0.14'), 'multi-currency dialog total must join amounts, got ' + JSON.stringify(text));
  const tabs = tabsOf(element);
  check(tabs.length === 3, 'multi-currency dialog must have one tab per model, got ' + tabs.length);
  if (tabs.length === 3) {
    check(findText(tabs[1]).includes('¥2.32'), 'CNY model tab must append its CNY amount');
    check(findText(tabs[2]).includes('$0.14'), 'USD model tab must append its USD amount');
  }
  const bandRows = collectRows(element, 'data-token-cost-bands');
  check(bandRows.length === 4, 'aggregate must show peak/off-peak per currency, got ' + JSON.stringify(bandRows));
  check(bandRows.includes('高峰时段费用 (CNY)') && bandRows.includes('高峰时段费用 (USD)'), 'multi-currency band rows must name their currency, got ' + JSON.stringify(bandRows));
  check(bandRows.includes('空闲时段费用 (CNY)') && bandRows.includes('空闲时段费用 (USD)'), 'multi-currency off-peak rows must name their currency');
  const aggregateText = findText(tabpanelOf(element));
  check(aggregateText.includes('CNY ¥1.20') && aggregateText.includes('USD $0.09'), 'aggregate bucket rows must show each currency cost, got ' + JSON.stringify(aggregateText));

  tabsOf(element)[2].props.onClick();
  const panel = tabpanelOf(element);
  check(panel !== undefined, 'USD model tab must render a panel');
  if (panel !== undefined) {
    const panelText = findText(panel);
    check(panelText.includes('$0.09') && panelText.includes('$0.05'), 'USD model tab must use its own currency symbol, got ' + JSON.stringify(panelText));
    check(!panelText.includes('¥'), 'USD model tab must not mix in the CNY symbol');
    const link = findNode(panel, (node) => node.type === 'a');
    check(link !== undefined && link.props.href === 'https://example.test/usd-pricing', 'USD model tab must link its own source');
  }
}

// ---- 11) dialog: bands only when reported, link only when present --------
{
  const plain = openDialog(makeView({ models: [makeModel({ peakMicro: null, offPeakMicro: null, source: null })] }), 'zh');
  tabsOf(plain)[1].props.onClick();
  const plainPanel = tabpanelOf(plain);
  check(collectRows(plain, 'data-token-cost-bands').length === 0, 'null model peak/off-peak must not render band rows');
  check(anchorsOf(plainPanel).length === 0, 'priced model without a source must not render a link');
  check(findText(plainPanel).includes('¥0.27'), 'model costs must still render without a source');

  const partial = openDialog(makeView({ models: [makeModel({ peakMicro: null, offPeakMicro: 0 })] }), 'zh');
  tabsOf(partial)[1].props.onClick();
  const partialBands = collectRows(partial, 'data-token-cost-bands');
  check(partialBands.length === 1 && partialBands[0] === '空闲时段费用', 'only the non-null band row must render, got ' + JSON.stringify(partialBands));
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
  check(tabs.length === 4, 'three-model view needs aggregate + three model tabs, got ' + tabs.length);
  if (tabs.length === 4) {
    tabs[3].props.onClick();
    check(tabsOf(element)[3].props['aria-selected'] === true, 'last model tab must be selectable');
  }
  // Re-render the same dialog with fewer models while the third tab is
  // selected: the index must clamp to the last available tab, never throw.
  const shrunk = render(makeView(), { open: true, locale: 'zh', resetHooks: false });
  const shrunkTabs = tabsOf(shrunk);
  check(shrunkTabs.length === 2, 'shrunk view must rebuild the tab strip, got ' + shrunkTabs.length);
  check(shrunkTabs[1].props['aria-selected'] === true, 'stale tab index must clamp to the last available tab');
  check(tabpanelOf(shrunk) !== undefined, 'clamped tab must render a panel');
  check(findText(tabpanelOf(shrunk)).includes('¥1.47'), 'clamped model tab must render the new model content');
}

// ---- 13) locale dictionaries: parity, coverage and no unresolved keys ----
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
      aggregateRows: collectRows(reportDialog, 'data-token-cost-tokens'),
      bandRows: collectRows(reportDialog, 'data-token-cost-bands'),
    },
    null,
    2,
  ),
);
