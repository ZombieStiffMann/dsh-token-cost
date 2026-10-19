/**
 * Fold, catalog and view tests for the Host half. Run with the bundled Node:
 *   node --test test/fold.test.mjs
 *
 * The tests inject a small China vendor catalog instead of the repository data,
 * so they stay deterministic while `catalog/china/` grows.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCostProjectionDefinition, PROJECTION_KEY } from '../index.js';
import { buildCostCatalog } from '../cost-catalog.js';
import { DEFAULT_PRICING, isPeakForBilling, normalizePricing } from '../pricing.js';

const HOUR = 3600 * 1000;
/** Monday, 2026-10-19, in Beijing time. */
const MONDAY = Date.parse('2026-10-19T00:00:00+08:00');
const at = (dayOffset, hour, minute = 0) => MONDAY + dayOffset * 24 * HOUR + hour * HOUR + minute * 60 * 1000;

function deepseekCatalog(userConfig = {}) {
  return buildCostCatalog({
    deepseekPricing: normalizePricing(undefined, DEFAULT_PRICING),
    chinaVendors: [],
    userConfig,
  });
}

function fakeVendor(overrides = {}) {
  const models = overrides.models ?? [
    {
      id: 'glm-4.6',
      name: 'GLM-4.6',
      aliases: [],
      rates: { cacheMiss: 4, cacheHit: 0.8, cacheWrite: 4, output: 16 },
    },
  ];
  return {
    vendor: overrides.vendor ?? 'zhipu',
    name: overrides.name ?? '智谱 AI',
    nameEn: overrides.nameEn ?? 'Zhipu AI',
    currency: overrides.currency ?? { code: 'CNY', symbol: '¥' },
    source: overrides.source ?? 'https://open.bigmodel.cn/pricing',
    asOf: overrides.asOf ?? '2026-10-19',
    providers: overrides.providers ?? ['zai'],
    ...(overrides.billing === undefined ? {} : { billing: { ...overrides.billing, holidaySet: new Set(overrides.billing.holidays ?? []) } }),
    models,
  };
}

function catalogWith(vendors, userConfig = {}) {
  return buildCostCatalog({
    deepseekPricing: normalizePricing(undefined, DEFAULT_PRICING),
    chinaVendors: vendors.map(fakeVendor),
    userConfig,
  });
}

function makeProjection(catalog) {
  return createCostProjectionDefinition({ current: catalog });
}

function fold(definition, events) {
  let state = definition.init();
  for (const event of events) state = definition.apply(state, event);
  return state;
}

function viewOf(definition, state) {
  return definition.wire.view(state);
}

function messageEvent({ turn = 1, step = 1, usage, time, provider = 'deepseek-official', model = 'deepseek-flash' }) {
  const tokens = usage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  return {
    type: 'assistant/message',
    seq: 0,
    time,
    data: {
      turn,
      step,
      usage: tokens,
      stream: [],
      message: { role: 'assistant', source: { kind: 'model', provider, model } },
    },
  };
}

function attemptEvent({ turn = 1, step = 1, usage, time, provider = 'deepseek-official', model = 'deepseek-flash' }) {
  return {
    type: 'assistant/attempt',
    seq: 0,
    time,
    data: {
      turn,
      step,
      stream: [{ type: 'chunk', chunk: { type: 'usage', usage } }],
      message: { role: 'assistant', source: { kind: 'model', provider, model } },
    },
  };
}

function headerEvent({ provider = 'deepseek-official', model = 'deepseek-flash', time = MONDAY, seq = 0 }) {
  return { type: 'request/header', seq, time, data: { header: { config: { provider, model } } } };
}

function totalsOf(view, code = 'CNY') {
  return view.currencies.find((currency) => currency.code === code);
}

test('DeepSeek samples are priced with the official peak/off-peak bands', () => {
  const definition = makeProjection(deepseekCatalog());
  const usage = { inputTokens: 1000, outputTokens: 300, cacheReadTokens: 2000, cacheWriteTokens: 0 };
  const peakState = fold(definition, [messageEvent({ usage, time: at(0, 10) })]);
  const peakView = viewOf(definition, peakState);
  // 1000*2 + 2000*0.04 + 300*8 = 4480 micro-CNY
  assert.equal(totalsOf(peakView).micro, 4480);
  assert.equal(totalsOf(peakView).peakMicro, 4480);
  assert.equal(peakView.models[0].banded, undefined);
  assert.equal(peakView.models[0].peakMicro, 4480);
  assert.equal(peakView.models[0].offPeakMicro, 0);

  const offState = fold(definition, [messageEvent({ usage, time: at(0, 13) })]);
  const offView = viewOf(definition, offState);
  assert.equal(totalsOf(offView).micro, 2240);
  assert.equal(totalsOf(offView).offPeakMicro, 2240);
  assert.equal(totalsOf(offView).saving, 2240);
});

test('a flat-price vendor prices at its published rate, with no band split', () => {
  const definition = makeProjection(catalogWith([fakeVendor()]));
  const usage = { inputTokens: 1000, outputTokens: 300, cacheReadTokens: 2000, cacheWriteTokens: 0 };
  const state = fold(definition, [messageEvent({ usage, time: at(0, 10), provider: 'zai', model: 'glm-4.6' })]);
  const view = viewOf(definition, state);
  // 1000*4 + 2000*0.8 + 300*16 = 10400 micro-CNY
  assert.equal(totalsOf(view).micro, 10400);
  assert.equal(totalsOf(view).peakMicro, 0);
  assert.equal(totalsOf(view).offPeakMicro, 0);
  assert.equal(view.models.length, 1);
  assert.equal(view.models[0].vendor, 'zhipu');
  assert.equal(view.models[0].vendorName, '智谱 AI');
  assert.equal(view.models[0].peakMicro, null);
  assert.equal(view.models[0].source, 'https://open.bigmodel.cn/pricing');
});

test('different currencies are accumulated separately and never summed', () => {
  const usdVendor = fakeVendor({
    vendor: 'usd-vendor',
    name: 'USD AI',
    currency: { code: 'USD', symbol: '$' },
    providers: ['usd'],
    models: [{ id: 'usd-model', name: 'USD Model', aliases: [], rates: { cacheMiss: 1, cacheHit: 0.1, cacheWrite: 1, output: 2 } }],
  });
  const definition = makeProjection(catalogWith([usdVendor]));
  const state = fold(definition, [
    messageEvent({ usage: { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, time: at(0, 10), provider: 'deepseek-official', model: 'deepseek-flash' }),
    messageEvent({ turn: 1, step: 2, usage: { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, time: at(0, 10), provider: 'usd', model: 'usd-model' }),
  ]);
  const view = viewOf(definition, state);
  assert.equal(view.currencies.length, 2);
  assert.equal(totalsOf(view, 'CNY').micro, 2000);
  assert.equal(totalsOf(view, 'USD').micro, 1000);
  assert.equal(view.models.length, 2);
});

test('context-length tiers pick the tier that contains the prompt size', () => {
  const tiered = fakeVendor({
    models: [
      {
        id: 'tiered-model',
        name: 'Tiered Model',
        aliases: [],
        tiers: [
          { maxInputTokens: 32000, rates: { cacheMiss: 1, cacheHit: 0.1, cacheWrite: 1, output: 2 } },
          { maxInputTokens: 128000, rates: { cacheMiss: 4, cacheHit: 0.4, cacheWrite: 4, output: 8 } },
        ],
      },
    ],
  });
  const definition = makeProjection(catalogWith([tiered]));
  const small = fold(definition, [
    messageEvent({ usage: { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }, time: at(0, 10), provider: 'zai', model: 'tiered-model' }),
  ]);
  assert.equal(totalsOf(viewOf(definition, small)).micro, 1000 * 1 + 100 * 2);
  const large = fold(definition, [
    messageEvent({ usage: { inputTokens: 40000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }, time: at(0, 10), provider: 'zai', model: 'tiered-model' }),
  ]);
  assert.equal(totalsOf(viewOf(definition, large)).micro, 40000 * 4 + 100 * 8);
  const boundary = fold(definition, [
    messageEvent({ usage: { inputTokens: 32000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, time: at(0, 10), provider: 'zai', model: 'tiered-model' }),
  ]);
  assert.equal(totalsOf(viewOf(definition, boundary)).micro, 32000 * 1);
});

test('provider mapping beats a shared model id; exact ids beat prefixes', () => {
  const vendorA = fakeVendor({
    vendor: 'vendor-a',
    name: 'Vendor A',
    providers: ['prov-a'],
    models: [{ id: 'shared-model', name: 'Shared A', aliases: [], rates: { cacheMiss: 1, cacheHit: 1, cacheWrite: 1, output: 1 } }],
  });
  const vendorB = fakeVendor({
    vendor: 'vendor-b',
    name: 'Vendor B',
    providers: ['prov-b'],
    models: [{ id: 'shared-model', name: 'Shared B', aliases: [], rates: { cacheMiss: 2, cacheHit: 2, cacheWrite: 2, output: 2 } }],
  });
  const catalog = catalogWith([vendorA, vendorB]);
  assert.equal(catalog.resolve({ provider: 'prov-b', model: 'shared-model', promptTokens: 0 }).vendor, 'vendor-b');
  assert.equal(catalog.resolve({ provider: 'unknown', model: 'shared-model', promptTokens: 0 }).vendor, 'vendor-a');
});

test('aliases, prefix matches, user overrides and fallback all resolve', () => {
  const vendor = fakeVendor({
    models: [
      {
        id: 'glm-4.6',
        name: 'GLM-4.6',
        aliases: ['glm-4.6-0901'],
        matchPrefixes: ['glm-4.6-2025'],
        rates: { cacheMiss: 4, cacheHit: 0.8, cacheWrite: 4, output: 16 },
      },
    ],
  });
  const catalog = catalogWith([vendor], {
    aliases: { 'my-alias': 'glm-4.6' },
    models: { 'custom-model': { name: 'Custom', rates: { cacheMiss: 10, cacheHit: 1, output: 20 } } },
    fallbackModel: 'deepseek-v4-pro',
  });
  assert.equal(catalog.resolve({ provider: 'zai', model: 'glm-4.6-0901', promptTokens: 0 }).model.id, 'glm-4.6');
  assert.equal(catalog.resolve({ provider: 'zai', model: 'glm-4.6-2025xxxx', promptTokens: 0 }).model.id, 'glm-4.6');
  assert.equal(catalog.resolve({ provider: 'x', model: 'my-alias', promptTokens: 0 }).vendor, 'zhipu');
  assert.equal(catalog.resolve({ provider: 'x', model: 'custom-model', promptTokens: 0 }).rates.cacheMiss, 10);
  assert.equal(catalog.resolve({ provider: 'x', model: 'custom-model', promptTokens: 0 }).rates.cacheWrite, 10, 'cacheWrite defaults to cacheMiss');
  assert.equal(catalog.resolve({ provider: 'x', model: 'totally-unknown', promptTokens: 0 }).model.id, 'deepseek-v4-pro');
  assert.equal(catalog.resolve({ provider: 'x', model: 'totally-unknown', promptTokens: 0 }).vendor, 'deepseek');
});

test('a user override patches a built-in model rate and inherits the rest', () => {
  const catalog = buildCostCatalog({
    deepseekPricing: normalizePricing(undefined, DEFAULT_PRICING),
    chinaVendors: [],
    userConfig: { models: { 'deepseek-flash': { rates: { cacheMiss: 100 } } } },
  });
  const match = catalog.resolve({ provider: 'deepseek-official', model: 'deepseek-flash', promptTokens: 0 });
  assert.equal(match.rates.cacheMiss, 100);
  assert.equal(match.rates.output, DEFAULT_PRICING.models['deepseek-flash'].rates.output);
  const definition = makeProjection(catalog);
  const state = fold(definition, [
    messageEvent({ usage: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, time: at(0, 10) }),
  ]);
  assert.equal(totalsOf(viewOf(definition, state)).micro, 10 * 100);
});

test('the fold keeps the shipped replacement and retry semantics', () => {
  const definition = makeProjection(catalogWith([fakeVendor()]));
  const first = { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const second = { inputTokens: 2000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const replaced = fold(definition, [
    headerEvent({ provider: 'zai', model: 'glm-4.6' }),
    attemptEvent({ usage: first, time: at(0, 10), provider: 'zai', model: 'glm-4.6' }),
    messageEvent({ usage: second, time: at(0, 10, 5), provider: 'zai', model: 'glm-4.6' }),
  ]);
  const replacedView = viewOf(definition, replaced);
  assert.equal(totalsOf(replacedView).micro, second.inputTokens * 4 + second.outputTokens * 16);
  assert.equal(replaced.events, 1);

  const retried = fold(definition, [
    headerEvent({ provider: 'zai', model: 'glm-4.6' }),
    attemptEvent({ usage: first, time: at(0, 10), provider: 'zai', model: 'glm-4.6' }),
    { type: 'llm/retry-started', seq: 2, time: at(0, 10, 1), data: { turn: 1, step: 1 } },
    messageEvent({ usage: second, time: at(0, 10, 2), provider: 'zai', model: 'glm-4.6' }),
  ]);
  assert.equal(totalsOf(viewOf(definition, retried)).micro, (first.inputTokens + second.inputTokens) * 4 + (first.outputTokens + second.outputTokens) * 16);
  assert.equal(retried.events, 2);
});

test('an unpriced route is disclosed instead of counted as free', () => {
  const definition = makeProjection(deepseekCatalog());
  const state = fold(definition, [
    messageEvent({
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
      time: at(0, 10),
      provider: 'xiaomi',
      model: 'mimo-v2.6-pro',
    }),
  ]);
  const view = viewOf(definition, state);
  assert.equal(view.currencies.length, 0);
  assert.equal(view.unpricedTokens, 120);
  assert.deepEqual(view.unpricedModels, ['mimo-v2.6-pro']);
  assert.equal(view.models[0].priced, false);
  assert.equal(view.models[0].source, null);
});

test('request/header supplies the route for attempt-only samples', () => {
  const definition = makeProjection(catalogWith([fakeVendor()]));
  const state = fold(definition, [
    headerEvent({ provider: 'zai', model: 'glm-4.6' }),
    attemptEvent({
      usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
      time: at(0, 10),
      provider: undefined,
      model: undefined,
    }),
  ]);
  const view = viewOf(definition, state);
  assert.equal(totalsOf(view).micro, 100 * 4 + 10 * 16);
});

test('state and view are plain JSON and the state version gates checkpoints', () => {
  const definition = makeProjection(catalogWith([fakeVendor()]));
  assert.equal(definition.stateVersion, 2);
  assert.equal(PROJECTION_KEY, 'tokenCost');
  const state = fold(definition, [
    headerEvent({ provider: 'zai', model: 'glm-4.6' }),
    messageEvent({
      usage: { inputTokens: 1234, outputTokens: 567, cacheReadTokens: 890, cacheWriteTokens: 0 },
      time: at(0, 10),
      provider: 'zai',
      model: 'glm-4.6',
    }),
  ]);
  const cloned = JSON.parse(JSON.stringify(state));
  assert.deepEqual(cloned, state);
  const view = JSON.parse(JSON.stringify(viewOf(definition, state)));
  assert.equal(view.models[0].tokensTotal, 1234 + 890 + 567);
  assert.ok(view.lastUpdated > 0);
});

test('peak band helper follows the official Beijing-time windows', () => {
  const billing = {
    windows: [[540, 720], [840, 1080]],
    offPeakMultiplier: 0.5,
    weekdays: [1, 2, 3, 4, 5],
    holidays: ['2026-10-01'],
    timeZoneOffsetMinutes: 480,
  };
  const holidays = new Set(billing.holidays);
  assert.equal(isPeakForBilling(billing, at(0, 10), holidays), true);
  assert.equal(isPeakForBilling(billing, at(0, 12), holidays), false);
  assert.equal(isPeakForBilling(billing, at(0, 15), holidays), true);
  assert.equal(isPeakForBilling(billing, at(5, 10), holidays), false);
  assert.equal(isPeakForBilling(billing, Date.parse('2026-10-01T10:00:00+08:00'), holidays), false);
  assert.equal(isPeakForBilling(null, at(0, 10), holidays), false);
});
