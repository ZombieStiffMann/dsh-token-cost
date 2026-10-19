/**
 * Catalog loader tests. Run with the bundled Node:
 *   node --test test/catalog.test.mjs
 *
 * Fixtures are written to a fresh OS temp directory, so the tests never touch
 * `catalog/china/`. The real directory is only inspected read-only, and the
 * last test tolerates it being empty or partially filled while contributors add
 * vendor files one at a time.
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CatalogError, CHINA_DIR, loadCatalog, normalizeVendor } from '../catalog/index.js';
import { createLookup } from '../catalog/lookup.js';
import { listVendorFiles, readVendorCatalogSync, validateVendorData } from '../catalog/validate.js';

/** One valid vendor data object; `overrides` lets a test break exactly one field. */
function validVendor(overrides = {}) {
  return {
    vendor: 'acme',
    name: 'Acme AI',
    nameEn: 'Acme AI',
    currency: { code: 'CNY', symbol: '¥' },
    source: 'https://acme.example/pricing',
    asOf: '2026-10-19',
    providers: ['acme'],
    models: [
      {
        id: 'acme-chat',
        name: 'Acme Chat',
        rates: { cacheHit: 0.2, cacheMiss: 2, output: 8 },
      },
    ],
    ...overrides,
  };
}

/** Serialize a vendor object as a data-only catalog module. */
function vendorSource(vendor) {
  return `export default ${JSON.stringify(vendor, null, 2)};\n`;
}

/** Create a temp vendor directory prepopulated with `files`; removed after the test. */
async function tempCatalog(t, files = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-token-cost-catalog-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content, 'utf8');
  return dir;
}

test('normalizeVendor trims strings, defaults cacheWrite and expands tier/billing defaults', () => {
  const normalized = normalizeVendor({
    vendor: 'acme',
    name: ' Acme AI ',
    nameEn: ' Acme AI ',
    currency: { code: 'CNY', symbol: '¥' },
    source: 'https://acme.example/pricing',
    asOf: '2026-10-19',
    providers: [' acme ', '', 'zai'],
    billing: { windows: [[540, 720]], offPeakMultiplier: 0.5 },
    models: [
      {
        id: ' flat-model ',
        name: ' Flat Model ',
        aliases: [' acme-chat-legacy ', ''],
        matchPrefixes: [' acme-chat- '],
        rates: { cacheHit: 0.2, cacheMiss: 2, output: 8 },
        notes: ' Batch API has separate pricing. ',
      },
      {
        id: 'tiered-model',
        name: 'Tiered Model',
        tiers: [
          { maxInputTokens: 32000, rates: { cacheHit: 0.1, cacheMiss: 1, output: 2 } },
          { maxInputTokens: 128000, rates: { cacheHit: 0.4, cacheMiss: 4, cacheWrite: 5, output: 8 } },
        ],
      },
    ],
  });

  assert.deepEqual(normalized, {
    vendor: 'acme',
    name: 'Acme AI',
    nameEn: 'Acme AI',
    currency: { code: 'CNY', symbol: '¥' },
    source: 'https://acme.example/pricing',
    asOf: '2026-10-19',
    providers: ['acme', 'zai'],
    billing: { windows: [[540, 720]], offPeakMultiplier: 0.5, weekdays: [1, 2, 3, 4, 5], holidays: [] },
    models: [
      {
        id: 'flat-model',
        name: 'Flat Model',
        aliases: ['acme-chat-legacy'],
        matchPrefixes: ['acme-chat-'],
        rates: { cacheHit: 0.2, cacheMiss: 2, cacheWrite: 2, output: 8 },
        notes: 'Batch API has separate pricing.',
      },
      {
        id: 'tiered-model',
        name: 'Tiered Model',
        aliases: [],
        tiers: [
          { maxInputTokens: 32000, rates: { cacheHit: 0.1, cacheMiss: 1, cacheWrite: 1, output: 2 } },
          { maxInputTokens: 128000, rates: { cacheHit: 0.4, cacheMiss: 4, cacheWrite: 5, output: 8 } },
        ],
      },
    ],
  });
});

test('loadCatalog is synchronous, tolerates an empty directory and supports a tightened expectation', async (t) => {
  const dir = await tempCatalog(t, {});

  const vendors = loadCatalog({ dir });
  assert.ok(Array.isArray(vendors), 'the return value is an array, not a Promise');
  assert.equal(typeof vendors.then, 'undefined');
  assert.deepEqual(vendors, []);

  await assert.rejects(async () => loadCatalog({ dir, minVendors: 1 }), (error) => {
    assert.ok(error instanceof CatalogError);
    assert.match(error.message, /expected at least 1 vendor catalog\(s\), found 0/);
    return true;
  });

  await writeFile(join(dir, 'acme.js'), vendorSource(validVendor()), 'utf8');
  assert.equal(loadCatalog({ dir }).length, 1);
  assert.equal(loadCatalog({ dir, minVendors: 1 }).length, 1);
});

test('a missing vendor directory is reported as a CatalogError', async (t) => {
  const dir = await tempCatalog(t, {});
  await assert.rejects(async () => loadCatalog({ dir: join(dir, 'does-not-exist') }), (error) => {
    assert.ok(error instanceof CatalogError);
    assert.match(error.message, /cannot read vendor directory/);
    return true;
  });
});

test('loadCatalog loads every vendor file in stable file order and skips _-prefixed files', async (t) => {
  const dir = await tempCatalog(t, {
    'b-vendor.js': vendorSource(validVendor({ vendor: 'zeta', name: 'Zeta', providers: [] })),
    'a-vendor.js': vendorSource(validVendor({ vendor: 'alpha', name: 'Alpha' })),
    // "_"-prefixed files are templates/helpers, never data: this content would be rejected if it were read.
    '_template-copy.js': 'export default { not: "a vendor" };\n',
  });

  const vendors = loadCatalog({ dir });
  assert.deepEqual(vendors.map((vendor) => vendor.vendor), ['alpha', 'zeta']);

  assert.deepEqual(listVendorFiles(dir).filter((name) => name.startsWith('_')), []);
});

test('loadCatalog normalizes loaded files (cacheWrite, aliases, tiers, billing)', async (t) => {
  const dir = await tempCatalog(t, {
    'acme.js': vendorSource(
      validVendor({
        billing: { windows: [[540, 720], [840, 1080]], offPeakMultiplier: 0.5 },
        models: [
          {
            id: 'acme-chat',
            name: 'Acme Chat',
            aliases: ['acme-chat-legacy'],
            rates: { cacheHit: 0.2, cacheMiss: 2, output: 8 },
          },
          {
            id: 'acme-long',
            name: 'Acme Long',
            tiers: [{ maxInputTokens: 100000, rates: { cacheHit: 0.4, cacheMiss: 4, output: 16 } }],
          },
        ],
      }),
    ),
  });

  const [vendor] = loadCatalog({ dir });
  assert.deepEqual(vendor.billing, {
    windows: [[540, 720], [840, 1080]],
    offPeakMultiplier: 0.5,
    weekdays: [1, 2, 3, 4, 5],
    holidays: [],
  });
  assert.deepEqual(vendor.models[0], {
    id: 'acme-chat',
    name: 'Acme Chat',
    aliases: ['acme-chat-legacy'],
    rates: { cacheHit: 0.2, cacheMiss: 2, cacheWrite: 2, output: 8 },
  });
  assert.deepEqual(vendor.models[1], {
    id: 'acme-long',
    name: 'Acme Long',
    aliases: [],
    tiers: [{ maxInputTokens: 100000, rates: { cacheHit: 0.4, cacheMiss: 4, cacheWrite: 4, output: 16 } }],
  });
});

test('invalid vendor files are rejected with an error naming every bad file', async (t) => {
  const dir = await tempCatalog(t, {
    'good.js': vendorSource(validVendor()),
    'bad-currency.js': vendorSource(validVendor({ vendor: 'bad-currency', currency: { code: 'USD', symbol: '$' } })),
    'bad-price.js': vendorSource(
      validVendor({
        vendor: 'bad-price',
        models: [{ id: 'broken', name: 'Broken', rates: { cacheHit: 0, cacheMiss: -1, output: 1 } }],
      }),
    ),
  });

  await assert.rejects(async () => loadCatalog({ dir }), (error) => {
    assert.ok(error instanceof CatalogError);
    assert.equal(error.name, 'CatalogError');
    assert.equal(error.dir, dir);
    assert.match(error.message, /bad-currency\.js/);
    assert.match(error.message, /bad-price\.js/);
    assert.doesNotMatch(error.message, /good\.js/, 'valid files are not reported');
    assert.ok(error.errors.some((issue) => issue.startsWith('bad-currency.js: ')));
    assert.ok(error.errors.some((issue) => issue.startsWith('bad-price.js')), 'nested paths still start with the file name');
    assert.match(error.message, /invalid vendor catalog/);
    return true;
  });
});

test('files that are not data-only default exports are rejected by name', async (t) => {
  const dir = await tempCatalog(t, {
    'syntax.js': 'export default {\n  vendor: "syntax",\n',
    'imports.js': "import { helper } from './helper.js';\nexport default {};\n",
    'no-default.js': 'export const rates = {};\n',
    'not-an-object.js': 'export default 42;\n',
  });

  await assert.rejects(async () => loadCatalog({ dir }), (error) => {
    assert.ok(error instanceof CatalogError);
    for (const file of ['syntax.js', 'imports.js', 'no-default.js', 'not-an-object.js']) {
      assert.match(error.message, new RegExp(file.replace('.', '\\.')));
    }
    return true;
  });
});

test('duplicate vendor ids across files are rejected', async (t) => {
  const dir = await tempCatalog(t, {
    'first.js': vendorSource(validVendor()),
    'second.js': vendorSource(validVendor({ name: 'Acme Again' })),
  });

  await assert.rejects(async () => loadCatalog({ dir }), (error) => {
    assert.ok(error instanceof CatalogError);
    assert.match(error.message, /duplicate vendor id acme/);
    assert.match(error.message, /first\.js/);
    assert.match(error.message, /second\.js/);
    return true;
  });
});

test('validate.js exposes the shared per-file validator and non-throwing reader used by the CLI', async (t) => {
  const issues = validateVendorData('fixture.js', {});
  assert.ok(issues.errors.length > 0);
  assert.ok(issues.errors.every((message) => message.startsWith('fixture.js: ')), 'every issue is prefixed with the file name');
  assert.deepEqual(issues.warnings, []);

  const warned = validateVendorData(
    'fixture.js',
    validVendor({ models: [{ id: 'acme-chat', name: 'Acme Chat', rates: { cacheHit: 9, cacheMiss: 1, output: 2 } }] }),
  );
  assert.deepEqual(warned.errors, []);
  assert.ok(warned.warnings.some((message) => /cacheHit is higher than cacheMiss/.test(message)));

  const dir = await tempCatalog(t, {
    'valid.js': vendorSource(validVendor()),
    'invalid.js': vendorSource(validVendor({ vendor: 'invalid', source: 'http://not-https.example/pricing', name: 'Invalid' })),
    '_ignored.js': 'not javascript\n',
  });
  const result = readVendorCatalogSync(dir);
  assert.deepEqual(result.files, ['invalid.js', 'valid.js'], '_-prefixed files are ignored and file order is stable');
  assert.equal(result.vendors.length, 2, 'the non-throwing reader still returns the parsable data it found');
  assert.ok(result.errors.some((issue) => issue.startsWith('invalid.js: ')));
  assert.ok(result.modelCount >= 1);
});

test('normalized loadCatalog output feeds createLookup directly', async (t) => {
  const dir = await tempCatalog(t, {
    'acme.js': vendorSource(
      validVendor({
        models: [
          {
            id: 'acme-chat',
            name: 'Acme Chat',
            aliases: ['acme-chat-legacy'],
            rates: { cacheHit: 0.2, cacheMiss: 2, output: 8 },
          },
          {
            id: 'acme-long',
            name: 'Acme Long',
            tiers: [{ maxInputTokens: 100000, rates: { cacheHit: 0.4, cacheMiss: 4, output: 16 } }],
          },
        ],
      }),
    ),
  });

  const lookup = createLookup(loadCatalog({ dir }));
  const match = lookup({ provider: 'acme', model: 'acme-chat', promptTokens: 10 });
  assert.equal(match.vendor, 'acme');
  assert.equal(match.vendorName, 'Acme AI');
  assert.equal(match.model.name, 'Acme Chat');
  assert.equal(match.tier, null);
  assert.equal(match.rates.cacheWrite, 2, 'the cacheWrite default survives normalization');
  assert.equal(lookup({ model: 'ACME-CHAT-LEGACY' }).model.id, 'acme-chat');
  assert.deepEqual(lookup({ provider: 'acme', model: 'acme-long', promptTokens: 99999 }).tier, { maxInputTokens: 100000 });
});

test('the real catalog/china directory loads and validates, tolerating the empty/partial state', () => {
  const files = listVendorFiles(CHINA_DIR);
  const vendors = loadCatalog(); // throws if any real file is invalid
  assert.ok(Array.isArray(vendors));
  assert.equal(typeof vendors.then, 'undefined', 'the Host activation path must not get a Promise');
  assert.equal(vendors.length, files.length, 'every file that exists must load and validate');

  const vendorIds = new Set();
  for (const vendor of vendors) {
    assert.match(vendor.vendor, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(vendor.vendor, vendor.vendor.trim());
    assert.ok(!vendorIds.has(vendor.vendor), `duplicate vendor id ${vendor.vendor}`);
    vendorIds.add(vendor.vendor);
    assert.deepEqual(vendor.currency, { code: 'CNY', symbol: '¥' });
    assert.ok(vendor.source.startsWith('https://'));
    assert.match(vendor.asOf, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Array.isArray(vendor.providers));
    assert.ok(vendor.models.length > 0, `${vendor.vendor} must publish at least one model`);
    for (const model of vendor.models) {
      assert.equal(typeof model.id, 'string');
      assert.ok(model.id.length > 0);
      assert.equal(typeof model.name, 'string');
      assert.ok(model.name.length > 0);
      assert.ok(Array.isArray(model.aliases));
      const rateSets = Array.isArray(model.tiers) && model.tiers.length > 0
        ? model.tiers.map((tier) => tier.rates)
        : [model.rates];
      for (const rateSet of rateSets) {
        for (const key of ['cacheHit', 'cacheMiss', 'cacheWrite', 'output']) {
          assert.equal(typeof rateSet[key], 'number', `${vendor.vendor}/${model.id} rates.${key}`);
        }
      }
    }
  }

  if (files.length === 0) {
    assert.equal(vendors.length, 0, 'an empty data set is tolerated while the catalog is being written');
  } else {
    assert.ok(vendors.length > 0, 'real vendor files load');
  }
});
