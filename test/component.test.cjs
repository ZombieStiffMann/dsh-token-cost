// Render-path test for the cost pill's client half.
//
// Loads the real client.js through a fake module loader with a minimal React
// stub (no DOM renderer), then exercises the states the pill must handle:
// normal cost, missing projection, zero usage, unpriced-only, mixed unpriced,
// malformed view, and the open breakdown dialog (portal, K/M token counts,
// two-decimal money, dividers, official price link, locale keys).
//
// Run: node test/component.test.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(dir, 'client.js'), 'utf8');

function makeElement() {
  return { dataset: {}, textContent: '', remove() {} };
}
global.document = {
  body: {},
  head: { appendChild() {} },
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

const noop = () => {};
let openOnFirstState = false;
let stateCalls = 0;
const ReactStub = {
  // Real React stores children on props; DetailRow reads props.children.
  createElement: (type, props, ...children) => ({
    type,
    props: Object.assign({}, props, children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children }),
    children,
  }),
  Fragment: Symbol('Fragment'),
  useState: (init) => {
    stateCalls += 1;
    if (stateCalls === 1) return [openOnFirstState, noop];
    return [null, noop];
  },
  useRef: (init) => ({ current: init }),
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

const plugin = captured.factory(requireStub);
let dictionaries;
const registrations = [];
const ctx = {
  effect(fn) {
    const dispose = fn();
    return typeof dispose === 'function' ? dispose : noop;
  },
  locale: {
    register(namespace, dicts) {
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
if (registrations.length !== 1) throw new Error('expected one slot registration');
const { options } = registrations[0];
if (options.name !== 'conversation.composer.dock' || options.id !== 'cost') throw new Error('unexpected registration ' + JSON.stringify(options));
const CostPill = registrations[0].component;

const missingKeys = new Set();
function makeT(locale) {
  return (key, params) => {
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

function render(view, open, locale) {
  stateCalls = 0;
  openOnFirstState = Boolean(open);
  let element = CostPill({ useProjection: (key) => (key === 'tokenCost' ? view : undefined), t: makeT(locale || 'zh') });
  if (element !== null && typeof element === 'object' && typeof element.type === 'function') {
    element = element.type(element.props);
  }
  return element;
}

function findText(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(findText).join(' ');
  if (typeof node === 'object') {
    if (node.portal !== undefined) return findText(node.portal);
    if (typeof node.type === 'function') return findText(node.type(node.props));
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
  if (typeof node.type === 'function') return findNode(node.type(node.props), predicate);
  return findNode(node.children, predicate);
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
  if (typeof node.type === 'function') return findPortal(node.type(node.props));
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
      walk(child.type(child.props));
      return;
    }
    if (child.type === 'dl' && child.props && child.props[marker] === true) {
      (function collectDt(row) {
        if (row === null || row === undefined || typeof row !== 'object') return;
        if (Array.isArray(row)) {
          row.forEach(collectDt);
          return;
        }
        if (typeof row.type === 'function') {
          collectDt(row.type(row.props));
          return;
        }
        if (row.type === 'dt') {
          rows.push(findText(row));
          return;
        }
        collectDt(row.children);
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
      walk(child.type(child.props));
      return;
    }
    if (typeof child.type === 'string' && child.props && typeof child.props.className === 'string' && child.props.className.endsWith('_divider')) count += 1;
    walk(child.children);
  })(node);
  return count;
}

function makeView(overrides) {
  const tokens = { input: 273974, cacheRead: 31034624, cacheWrite: 0, output: 144423, reasoning: 0 };
  return Object.assign(
    {
      currency: { code: 'CNY', symbol: '¥' },
      micro: 1472358,
      tokens,
      tokensTotal: 31453021,
      micros: { input: 273974, cacheRead: 620692, cacheWrite: 0, output: 577692 },
      peakMicro: 0,
      offPeakMicro: 1472358,
      saving: 1472363,
      models: [
        { provider: 'deepseek-official', model: 'deepseek-flash', pricingKey: 'deepseek-flash', priced: true, micro: 1472358, tokens: { ...tokens }, tokensTotal: 31453021 },
      ],
      unpricedModels: [],
      unpricedTokens: 0,
      events: 128,
      firstTime: 0,
      lastTime: 0,
      price: {
        asOf: '2026-10-19',
        source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
        timeZoneOffsetMinutes: 480,
        timeZoneLabel: '北京时间 (UTC+8)',
        offPeakMultiplier: 0.5,
        peakWindows: [[540, 720], [840, 1080]],
        models: {
          'deepseek-flash': {
            name: 'DeepSeek-V4.1-Flash',
            rates: { cacheMiss: 2, cacheHit: 0.04, cacheWrite: 2, output: 8 },
            offPeakMultiplier: 0.5,
          },
          'deepseek-v4-pro': {
            name: 'DeepSeek-V4-Pro',
            rates: { cacheMiss: 9, cacheHit: 0.3, cacheWrite: 9, output: 27 },
            offPeakMultiplier: 0.5,
          },
        },
      },
    },
    overrides || {},
  );
}

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

// 1) normal view, closed pill, both locales: two-decimal money only.
for (const locale of ['zh', 'en']) {
  const element = render(makeView(), false, locale);
  check(element !== null && element !== undefined, locale + ': pill must render');
  const text = findText(element);
  check(text.includes('¥1.47'), locale + ': pill must show two-decimal CNY, got ' + JSON.stringify(text));
  check(!/¥1\.472/.test(text), locale + ': pill must not show more than two decimals');
  const button = findNode(element, (node) => node.type === 'button');
  check(button !== undefined, locale + ': missing trigger button');
  check(button && button.props['aria-haspopup'] === 'dialog', locale + ': trigger must set aria-haspopup');
  check(button && button.props['aria-expanded'] === false, locale + ': trigger must be closed');
  check(button && typeof button.props['aria-label'] === 'string' && button.props['aria-label'].length > 0, locale + ': trigger needs aria-label');
}

// 2) missing projection / malformed view / zero usage -> no pill
check(render(undefined) === null, 'missing projection must render null');
check(render(makeView({ micro: 'cost' })) === null, 'non-numeric cost must render null');
check(
  render(makeView({ micro: 0, tokens: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }, tokensTotal: 0, micros: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }, models: [] })) === null,
  'zero usage must render null',
);

// 3) unpriced-only view: warning label, still openable
const unpricedOnly = render(
  makeView({
    micro: 0,
    micros: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
    models: [{ provider: 'xiaomi', model: 'mimo-v2.6-pro', pricingKey: null, priced: false, micro: 0, tokens: { input: 100, cacheRead: 0, cacheWrite: 0, output: 20, reasoning: 0 }, tokensTotal: 120 }],
    tokens: { input: 100, cacheRead: 0, cacheWrite: 0, output: 20, reasoning: 0 },
    tokensTotal: 120,
    unpricedModels: ['mimo-v2.6-pro'],
    unpricedTokens: 120,
  }),
);
check(unpricedOnly !== null, 'unpriced-only view must render');
check(findText(unpricedOnly).includes('未定价'), 'unpriced-only view must say 未定价, got ' + JSON.stringify(findText(unpricedOnly)));

// 4) open dialog: portal, K/M counts, two-decimal money, dividers, no removed rows, official link.
for (const locale of ['zh', 'en']) {
  const element = render(makeView(), true, locale);
  const portal = findPortal(element);
  check(portal !== undefined, locale + ': open state must portal a panel');
  if (portal === undefined) continue;
  check(portal.container === global.document.body, locale + ': panel must portal to document.body');
  check(portal.portal.props.role === 'dialog', locale + ': panel must be role=dialog');

  const tokenRows = collectRows(element, 'data-token-cost-tokens');
  const expectedRows = locale === 'zh'
    ? ['未命中缓存输入', '缓存命中输入', '输出', 'Token 合计']
    : ['Uncached input', 'Cache-hit input', 'Output', 'Total tokens'];
  for (const label of expectedRows) check(tokenRows.includes(label), locale + ': missing token row ' + label + ' in ' + JSON.stringify(tokenRows));
  const bandRows = collectRows(element, 'data-token-cost-bands');
  const expectedBands = locale === 'zh' ? ['高峰时段费用', '空闲时段费用'] : ['Peak-band cost', 'Off-peak cost'];
  for (const label of expectedBands) check(bandRows.includes(label), locale + ': missing band row ' + label + ' in ' + JSON.stringify(bandRows));

  const text = findText(element);
  // K/M token magnitudes in the token rows and the total.
  check(/274K/.test(text), locale + ': expected 274K input tokens, got ' + JSON.stringify(text));
  check(/31M/.test(text), locale + ': expected 31M cache-read tokens, got ' + JSON.stringify(text));
  check(/144\.4K/.test(text), locale + ': expected 144.4K output tokens, got ' + JSON.stringify(text));
  check(/31\.5M/.test(text), locale + ': expected 31.5M total tokens, got ' + JSON.stringify(text));
  // Money rounded to two decimals: ¥0.27 / ¥0.62 / ¥0.58 / ¥1.47.
  for (const amount of ['¥0.27', '¥0.62', '¥0.58', '¥1.47']) {
    check(text.includes(amount), locale + ': expected two-decimal amount ' + amount + ' in ' + JSON.stringify(text));
  }
  // Removed content must not come back (peak-rate saving, rate lines, estimate note).
  for (const removed of ['差额', '估算', '每百万', '价格依据', 'below peak']) {
    check(!text.includes(removed), locale + ': removed content reappeared: ' + removed);
  }
  // Structure: dividers between sections.
  check(countDividers(element) >= 3, locale + ': expected section dividers, got ' + countDividers(element));
  // Single model -> model section hidden.
  check(collectRows(element, 'data-token-cost-models').length === 0, locale + ': single-model view must hide the per-model section');
  // Official price link.
  const link = findNode(element, (node) => node.type === 'a');
  check(link !== undefined, locale + ': missing official price link');
  check(link && link.props.href === 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing', locale + ': link must point at the official page');
  check(link && link.props.target === '_blank' && typeof link.props.rel === 'string' && link.props.rel.includes('noopener'), locale + ': link must open a new tab safely');
}

// 5) mixed models show the per-model section and mark unpriced rows
const mixed = makeView({
  models: [
    ...makeView().models,
    { provider: 'xiaomi', model: 'mimo-v2.6-pro', pricingKey: null, priced: false, micro: 0, tokens: { input: 100, cacheRead: 0, cacheWrite: 0, output: 20, reasoning: 0 }, tokensTotal: 120 },
  ],
  unpricedModels: ['mimo-v2.6-pro'],
  unpricedTokens: 120,
});
const mixedElement = render(mixed, true, 'zh');
check(collectRows(mixedElement, 'data-token-cost-models').length === 2, 'two-model view must show the per-model section');
check(findText(mixedElement).includes('xiaomi/mimo') || findText(mixedElement).includes('mimo-v2.6-pro'), 'mixed view must show the unpriced model');

// 6) no unresolved locale key in any rendered locale
check(missingKeys.size === 0, 'unresolved locale keys: ' + JSON.stringify([...missingKeys]));

if (failures.length > 0) {
  console.error('COMPONENT TEST FAILED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('COMPONENT TEST OK');
console.log(
  JSON.stringify(
    {
      localeKeys: { zh: Object.keys(dictionaries.zh).length, en: Object.keys(dictionaries.en).length },
      pillText: findText(render(makeView(), false, 'zh')),
      tokenRows: collectRows(render(makeView(), false, 'zh') && render(makeView(), true, 'zh'), 'data-token-cost-tokens'),
    },
    null,
    2,
  ),
);
