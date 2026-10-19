/**
 * Price-lookup engine tests. Run with the bundled Node:
 *   node --test test/lookup.test.mjs
 *
 * The fixtures are schema-shaped vendor objects built in memory, so the tests
 * are deterministic and do not touch `catalog/china/`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLookup, listModels, selectTier } from '../catalog/lookup.js';

function rateSet(overrides = {}) {
  return { cacheMiss: 2, cacheHit: 0.2, output: 8, ...overrides };
}

function makeModel(overrides = {}) {
  return {
    id: 'model-a',
    name: 'Model A',
    aliases: [],
    rates: rateSet(),
    ...overrides,
  };
}

function makeVendor(overrides = {}) {
  const { models, ...rest } = overrides;
  return {
    vendor: 'vendor-a',
    name: 'Vendor A',
    nameEn: 'Vendor A',
    currency: { code: 'CNY', symbol: '¥' },
    source: 'https://vendor-a.example/pricing',
    asOf: '2026-10-19',
    providers: [],
    models: models ?? [makeModel()],
    ...rest,
  };
}

test('createLookup returns a callable resolver with the documented flat-price shape', () => {
  const lookup = createLookup([makeVendor({ providers: ['zai'] })]);
  assert.equal(typeof lookup, 'function');
  assert.equal(lookup.resolve, lookup, 'the resolver is exposed both directly and as .resolve');

  const match = lookup({ provider: 'zai', model: 'model-a', promptTokens: 1000 });
  assert.deepEqual(match, {
    vendor: 'vendor-a',
    vendorName: 'Vendor A',
    currency: { code: 'CNY', symbol: '¥' },
    source: 'https://vendor-a.example/pricing',
    asOf: '2026-10-19',
    model: { id: 'model-a', name: 'Model A' },
    rates: { cacheHit: 0.2, cacheMiss: 2, cacheWrite: 2, output: 8 },
    tier: null,
    billing: null,
  });
});

test('cacheWrite defaults to cacheMiss unless the vendor publishes a separate price', () => {
  const lookup = createLookup([
    makeVendor({
      models: [
        makeModel({ id: 'implicit' }),
        makeModel({ id: 'explicit', rates: rateSet({ cacheWrite: 1.5 }) }),
      ],
    }),
  ]);
  assert.equal(lookup({ model: 'implicit' }).rates.cacheWrite, 2);
  assert.equal(lookup({ model: 'implicit' }).rates.cacheMiss, 2);
  assert.equal(lookup({ model: 'explicit' }).rates.cacheWrite, 1.5);
});

test('a provider mapping beats a shared model id', () => {
  const vendorA = makeVendor({
    vendor: 'alpha',
    name: 'Alpha',
    providers: ['prov-a'],
    models: [makeModel({ id: 'shared', name: 'Shared A', rates: rateSet({ cacheMiss: 1 }) })],
  });
  const vendorB = makeVendor({
    vendor: 'beta',
    name: 'Beta',
    providers: ['prov-b'],
    models: [makeModel({ id: 'shared', name: 'Shared B', rates: rateSet({ cacheMiss: 9 }) })],
  });
  const lookup = createLookup([vendorA, vendorB]);

  assert.equal(lookup({ provider: 'prov-b', model: 'shared' }).vendor, 'beta');
  assert.equal(lookup({ provider: 'PROV-B', model: 'SHARED' }).vendor, 'beta', 'provider/model matching is case-insensitive');
  assert.equal(lookup({ model: 'shared' }).vendor, 'alpha', 'without a provider the first catalog entry wins');
  assert.equal(lookup({ provider: 'unknown-provider', model: 'shared' }).vendor, 'alpha', 'an unmapped provider falls through to model-id matching');
});

test('a provider match still falls through to another vendor when its own ids differ', () => {
  const vendorA = makeVendor({ vendor: 'alpha', providers: ['prov-a'], models: [makeModel({ id: 'alpha-only' })] });
  const vendorB = makeVendor({ vendor: 'beta', providers: ['prov-b'], models: [makeModel({ id: 'beta-only' })] });
  const lookup = createLookup([vendorA, vendorB]);
  assert.equal(lookup({ provider: 'prov-a', model: 'beta-only' }).vendor, 'beta');
});

test('exact ids beat aliases; aliases beat prefixes', () => {
  const aliasVendor = makeVendor({
    vendor: 'alias-vendor',
    name: 'Alias Vendor',
    models: [
      makeModel({ id: 'target-model', name: 'Target', aliases: ['fuzzy', 'legacy-name'] }),
      makeModel({ id: 'prefix-model', name: 'Prefix', matchPrefixes: ['legacy-'] }),
    ],
  });
  const exactVendor = makeVendor({
    vendor: 'exact-vendor',
    name: 'Exact Vendor',
    models: [makeModel({ id: 'fuzzy', name: 'Fuzzy Exact' })],
  });
  const lookup = createLookup([aliasVendor, exactVendor]);

  assert.equal(lookup({ model: 'fuzzy' }).vendor, 'exact-vendor', 'an exact model id wins over an earlier vendor alias');
  assert.equal(lookup({ model: 'FUZZY' }).model.id, 'fuzzy');
  assert.equal(lookup({ model: 'legacy-name' }).vendor, 'alias-vendor', 'alias matches when no exact id exists');
  assert.equal(lookup({ model: 'LEGACY-NAME' }).model.id, 'target-model');
  assert.equal(lookup({ model: 'legacy-name' }).model.id, 'target-model', 'the exact alias wins over the "legacy-" prefix of another model');
  assert.equal(lookup({ model: 'legacy-2026' }).model.id, 'prefix-model', 'prefix matching still applies to undocumented ids');
});

test('documented matchPrefixes match case-insensitively and the longest prefix wins', () => {
  const vendor = makeVendor({
    models: [
      makeModel({ id: 'glm-4.6', name: 'GLM-4.6', matchPrefixes: ['glm-4'] }),
      makeModel({ id: 'glm-4.6-flash', name: 'GLM-4.6 Flash', matchPrefixes: ['glm-4.6-flash-'] }),
    ],
  });
  const lookup = createLookup([vendor]);

  assert.equal(lookup({ model: 'glm-4.6-flash-20261001' }).model.id, 'glm-4.6-flash', 'the longer matching prefix wins');
  assert.equal(lookup({ model: 'GLM-4.6-FLASH-20261001' }).model.id, 'glm-4.6-flash');
  assert.equal(lookup({ model: 'glm-4.6-0901' }).model.id, 'glm-4.6', 'the shorter documented prefix still matches');
  assert.equal(lookup({ model: 'glm-5-20261001' }), null, 'an undocumented prefix is unpriced');
});

test('tier selection uses the first bound that covers the prompt, then the largest tier', () => {
  const tiered = {
    id: 'tiered-model',
    name: 'Tiered Model',
    aliases: [],
    tiers: [
      { maxInputTokens: 32000, rates: { cacheMiss: 1, cacheHit: 0.1, output: 2 } },
      { maxInputTokens: 128000, rates: { cacheMiss: 4, cacheHit: 0.4, output: 8 } },
      { maxInputTokens: 1000000, rates: { cacheMiss: 16, cacheHit: 1.6, output: 32 } },
    ],
  };
  const lookup = createLookup([makeVendor({ models: [tiered] })]);
  const tierOf = (promptTokens) => lookup({ model: 'tiered-model', promptTokens }).tier.maxInputTokens;
  const ratesOf = (promptTokens) => lookup({ model: 'tiered-model', promptTokens }).rates;

  assert.equal(tierOf(0), 32000);
  assert.equal(tierOf(1), 32000);
  assert.equal(tierOf(32000), 32000, 'the bound is inclusive');
  assert.equal(tierOf(32001), 128000);
  assert.equal(tierOf(128000), 128000);
  assert.equal(tierOf(128001), 1000000);
  assert.equal(tierOf(1000000), 1000000);
  assert.equal(tierOf(1000001), 1000000, 'beyond every published bound the largest tier applies');
  assert.equal(tierOf(undefined), 32000, 'no prompt size means the smallest request');
  assert.equal(tierOf(Number.NaN), 32000);
  assert.equal(tierOf(Infinity), 1000000);
  assert.deepEqual(ratesOf(32000), { cacheHit: 0.1, cacheMiss: 1, cacheWrite: 1, output: 2 }, 'tier rates inherit the cacheWrite default');
  assert.deepEqual(ratesOf(128001), { cacheHit: 1.6, cacheMiss: 16, cacheWrite: 16, output: 32 });
});

test('selectTier is exported and handles flat models and unsorted tiers', () => {
  assert.equal(selectTier({ rates: rateSet() }, 1000), null);
  assert.equal(selectTier({}, 1000), null);
  assert.equal(selectTier(null, 1000), null);
  const tiers = [
    { maxInputTokens: 100, rates: rateSet() },
    { maxInputTokens: 10, rates: rateSet() },
  ];
  assert.equal(selectTier({ tiers }, 5).maxInputTokens, 10);
  assert.equal(selectTier({ tiers }, 500).maxInputTokens, 100, 'the fallback is the largest bound, not the last entry');
});

test('vendor billing is normalized with defaults and extra fields are preserved', () => {
  const chinaVendor = makeVendor({
    billing: { windows: [[540, 720], [840, 1080]], offPeakMultiplier: 0.5 },
  });
  const deepseekVendor = makeVendor({
    vendor: 'deepseek',
    name: 'DeepSeek',
    providers: ['deepseek-official'],
    billing: {
      windows: [[540, 720]],
      offPeakMultiplier: 0.5,
      weekdays: [1, 2, 3, 4, 5],
      holidays: ['2026-10-01'],
      timeZoneOffsetMinutes: 480,
      holidaySet: new Set(['2026-10-01']),
    },
  });
  const lookup = createLookup([chinaVendor, deepseekVendor]);

  const china = lookup({ model: 'model-a' });
  assert.deepEqual(china.billing, {
    windows: [[540, 720], [840, 1080]],
    offPeakMultiplier: 0.5,
    weekdays: [1, 2, 3, 4, 5],
    holidays: [],
  });
  assert.notEqual(china.billing, chinaVendor.billing, 'results own their billing copy');

  const deepseek = lookup({ provider: 'deepseek-official', model: 'model-a' });
  assert.equal(deepseek.vendor, 'deepseek');
  assert.equal(deepseek.billing.timeZoneOffsetMinutes, 480);
  assert.ok(deepseek.billing.holidaySet instanceof Set, 'the prebuilt holiday Set is passed through for the fold');
  assert.deepEqual(deepseek.billing.holidays, ['2026-10-01']);
});

test('display metadata follows the vendor and per-model overrides', () => {
  const usdVendor = makeVendor({ currency: { code: 'USD', symbol: '$' } });
  assert.deepEqual(createLookup([usdVendor])({ model: 'model-a' }).currency, { code: 'USD', symbol: '$' });

  const override = makeModel({
    id: 'overridden',
    source: 'https://override.example/pricing',
    asOf: '2026-10-20',
    currency: { code: 'USD', symbol: '$' },
  });
  const overridden = createLookup([makeVendor({ models: [override] })])({ model: 'overridden' });
  assert.equal(overridden.source, 'https://override.example/pricing');
  assert.equal(overridden.asOf, '2026-10-20');
  assert.deepEqual(overridden.currency, { code: 'USD', symbol: '$' });
});

test('a world (USD) vendor keeps its currency through the lookup result', () => {
  const cnyVendor = makeVendor({
    vendor: 'acme',
    name: 'Acme',
    providers: ['acme'],
    models: [makeModel({ id: 'acme-chat', name: 'Acme Chat', rates: rateSet({ cacheMiss: 2, cacheHit: 0.2, output: 8 }) })],
  });
  const usdVendor = makeVendor({
    vendor: 'globex',
    name: 'Globex',
    providers: ['globex'],
    currency: { code: 'USD', symbol: '$' },
    source: 'https://globex.example/pricing',
    models: [makeModel({ id: 'globex-1', name: 'Globex 1', rates: rateSet({ cacheMiss: 3, cacheHit: 0.3, output: 12 }) })],
  });
  const lookup = createLookup([cnyVendor, usdVendor]);

  const usd = lookup({ provider: 'globex', model: 'globex-1', promptTokens: 1000 });
  assert.deepEqual(usd.currency, { code: 'USD', symbol: '$' });
  assert.deepEqual(usd.rates, { cacheHit: 0.3, cacheMiss: 3, cacheWrite: 3, output: 12 }, 'rates stay in USD as published');
  assert.equal(usd.vendor, 'globex');
  assert.equal(usd.source, 'https://globex.example/pricing');

  const cny = lookup({ model: 'acme-chat' });
  assert.deepEqual(cny.currency, { code: 'CNY', symbol: '¥' });
  assert.equal(cny.rates.cacheMiss, 2, 'USD and CNY catalogs never share rates');
});

test('model notes are included only when documented', () => {
  const noted = createLookup([makeVendor({ models: [makeModel({ notes: 'Batch API has separate pricing.' })] })])({ model: 'model-a' });
  assert.deepEqual(noted.model, { id: 'model-a', name: 'Model A', notes: 'Batch API has separate pricing.' });
  const plain = createLookup([makeVendor()])({ model: 'model-a' });
  assert.equal('notes' in plain.model, false);
});

test('unpriced routes resolve to null instead of guessing', () => {
  const lookup = createLookup([makeVendor()]);
  assert.equal(lookup({ model: 'unknown-model' }), null);
  assert.equal(lookup({ provider: 'zai', model: 'unknown-model' }), null);
  assert.equal(lookup({ model: '' }), null);
  assert.equal(lookup({ model: 42 }), null);
  assert.equal(lookup({}), null);
  assert.equal(lookup(null), null);
  assert.equal(createLookup([])({ model: 'model-a' }), null);
  assert.equal(createLookup(undefined)({ model: 'model-a' }), null);
  assert.equal(lookup({ model: 'model-a', promptTokens: 'not-a-number' }).tier, null);
});

test('malformed entries are skipped without hiding a later valid match', () => {
  const broken = makeVendor({ vendor: 'broken', models: [{ id: 'dup', name: 'No Prices', aliases: [] }] });
  const good = makeVendor({ vendor: 'good', name: 'Good', models: [makeModel({ id: 'dup' })] });
  const lookup = createLookup([broken, good]);
  assert.equal(lookup({ model: 'dup' }).vendor, 'good');
  assert.equal(lookup({ model: 'dup' }).rates.cacheMiss, 2);
});

test('listModels flattens every vendor entry in catalog order', () => {
  const vendorA = makeVendor({
    vendor: 'alpha',
    name: 'Alpha',
    models: [
      makeModel({ id: 'one', name: 'One', aliases: ['1'] }),
      makeModel({ id: 'two', name: 'Two', matchPrefixes: ['two-'], tiers: [{ maxInputTokens: 1000, rates: rateSet() }] }),
    ],
  });
  const vendorB = makeVendor({ vendor: 'beta', name: 'Beta' });
  const vendors = [vendorA, vendorB];
  assert.deepEqual(listModels(vendors), [
    { vendor: 'alpha', vendorName: 'Alpha', id: 'one', name: 'One', aliases: ['1'], matchPrefixes: [], tierCount: 0 },
    { vendor: 'alpha', vendorName: 'Alpha', id: 'two', name: 'Two', aliases: [], matchPrefixes: ['two-'], tierCount: 1 },
    { vendor: 'beta', vendorName: 'Beta', id: 'model-a', name: 'Model A', aliases: [], matchPrefixes: [], tierCount: 0 },
  ]);
  assert.equal(createLookup(vendors).listModels().length, 3);
});

test('matching is case-insensitive on both ids and aliases', () => {
  const vendor = makeVendor({ models: [makeModel({ id: 'GLM-4.6', name: 'GLM-4.6', aliases: ['Glm-4.6-Turbo'] })] });
  const lookup = createLookup([vendor]);
  assert.equal(lookup({ model: 'glm-4.6' }).model.id, 'GLM-4.6', 'the catalog display id is returned as published');
  assert.equal(lookup({ model: ' GLM-4.6-TURBO ' }).model.id, 'GLM-4.6', 'query ids are trimmed and case-folded');
});
