/**
 * Catalog loader tests. Run with the bundled Node:
 *   node --test test/catalog.test.mjs
 *
 * Fixtures are written to fresh OS temp directories, so the tests never touch
 * the real `catalog/china/` or `catalog/world/` data. Those directories are only
 * inspected read-only, and the last test tolerates the world section being
 * missing, empty or partially filled while contributors add vendor files.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CatalogError, CHINA_DIR, WORLD_DIR, loadCatalog, loadCatalogSections, normalizeVendor } from '../catalog/index.js';
import { createLookup } from '../catalog/lookup.js';
import { listVendorFiles, readCatalogsSync, readVendorCatalogSync, validateVendorData } from '../catalog/validate.js';

const CNY = { code: 'CNY', symbol: '¥' };
const USD = { code: 'USD', symbol: '$' };

/** One valid China (CNY) vendor data object; `overrides` lets a test break exactly one field. */
function validVendor(overrides = {}) {
  return {
    vendor: 'acme',
    name: 'Acme AI',
    nameEn: 'Acme AI',
    currency: CNY,
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

/** One valid world (USD) vendor data object. */
function validWorldVendor(overrides = {}) {
  return validVendor({
    vendor: 'globex',
    name: 'Globex',
    nameEn: 'Globex AI',
    currency: USD,
    source: 'https://globex.example/pricing',
    providers: ['globex'],
    models: [{ id: 'globex-1', name: 'Globex 1', rates: { cacheHit: 0.3, cacheMiss: 3, output: 12 } }],
    ...overrides,
  });
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

test('normalizeVendor keeps the USD currency of a world vendor', () => {
  const normalized = normalizeVendor(validWorldVendor());
  assert.deepEqual(normalized.currency, USD);
  assert.equal(normalized.vendor, 'globex');
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

test('a mixed catalog loads China (CNY) vendors before world (USD) vendors', async (t) => {
  const chinaDir = await tempCatalog(t, {
    'b-vendor.js': vendorSource(validVendor({
      vendor: 'beta',
      name: 'Beta',
      providers: ['beta'],
      models: [{ id: 'beta-chat', name: 'Beta Chat', rates: { cacheHit: 0.2, cacheMiss: 2, output: 8 } }],
    })),
    'a-vendor.js': vendorSource(validVendor({
      vendor: 'alpha',
      name: 'Alpha',
      providers: ['alpha'],
      models: [{ id: 'alpha-chat', name: 'Alpha Chat', rates: { cacheHit: 0.2, cacheMiss: 2, output: 8 } }],
    })),
  });
  const worldDir = await tempCatalog(t, {
    'z-world.js': vendorSource(validWorldVendor()),
    'b-world.js': vendorSource(validWorldVendor({
      vendor: 'initech',
      name: 'Initech',
      providers: ['initech'],
      models: [{ id: 'initech-1', name: 'Initech 1', rates: { cacheHit: 0.1, cacheMiss: 1, output: 2 } }],
    })),
  });
  const sections = [
    { id: 'china', dir: chinaDir, currency: 'CNY' },
    { id: 'world', dir: worldDir, currency: 'USD' },
  ];

  const vendors = loadCatalogSections(sections);
  assert.deepEqual(vendors.map((vendor) => vendor.vendor), ['alpha', 'beta', 'initech', 'globex']);
  assert.deepEqual(vendors.map((vendor) => vendor.currency.code), ['CNY', 'CNY', 'USD', 'USD']);

  // The lookup keeps the matched vendor's currency, so amounts are never mixed.
  const lookup = createLookup(vendors);
  assert.deepEqual(lookup({ provider: 'globex', model: 'globex-1' }).currency, USD);
  assert.deepEqual(lookup({ model: 'initech-1' }).currency, USD);
  assert.deepEqual(lookup({ provider: 'alpha', model: 'alpha-chat' }).currency, CNY);

  // A single directory can be loaded on its own, with the same normalized shape.
  assert.deepEqual(loadCatalog({ dir: worldDir }).map((vendor) => vendor.vendor), ['initech', 'globex']);
  assert.deepEqual(loadCatalog({ dir: chinaDir }).map((vendor) => vendor.vendor), ['alpha', 'beta']);

  await assert.rejects(async () => loadCatalogSections(sections, { minVendors: 5 }), (error) => {
    assert.ok(error instanceof CatalogError);
    assert.match(error.message, /expected at least 5 vendor catalog\(s\), found 4/);
    return true;
  });
});

test('a missing or empty world directory is valid and yields the China vendors', async (t) => {
  const chinaDir = await tempCatalog(t, { 'acme.js': vendorSource(validVendor()) });
  const missingWorld = join(await tempCatalog(t, {}), 'does-not-exist');
  const emptyWorld = await tempCatalog(t, {});
  const chinaSection = { id: 'china', dir: chinaDir, currency: 'CNY' };

  for (const worldDir of [missingWorld, emptyWorld]) {
    const vendors = loadCatalogSections([
      chinaSection,
      { id: 'world', dir: worldDir, currency: 'USD', optional: true },
    ]);
    assert.deepEqual(vendors.map((vendor) => vendor.vendor), ['acme']);
    assert.deepEqual(vendors.map((vendor) => vendor.currency), [CNY]);
  }

  // A required section that cannot be read is still an error.
  await assert.rejects(async () => loadCatalogSections([{ id: 'china', dir: missingWorld, currency: 'CNY' }]), (error) => {
    assert.ok(error instanceof CatalogError);
    assert.match(error.message, /cannot read/);
    return true;
  });
});

test('each curated directory enforces its own currency', async (t) => {
  const chinaDir = await tempCatalog(t, {
    'usd-in-china.js': vendorSource(validVendor({ vendor: 'wrong-china', currency: USD })),
  });
  const worldDir = await tempCatalog(t, {
    'cny-in-world.js': vendorSource(validWorldVendor({ vendor: 'wrong-world', currency: CNY })),
  });

  const read = readCatalogsSync([
    { id: 'china', dir: chinaDir, currency: 'CNY' },
    { id: 'world', dir: worldDir, currency: 'USD' },
  ]);
  assert.equal(read.errors.length, 2);
  assert.ok(read.errors.some((issue) => issue.startsWith('china/usd-in-china.js: currency must be { code: "CNY", symbol: "¥" }')));
  assert.ok(read.errors.some((issue) => issue.startsWith('world/cny-in-world.js: currency must be { code: "USD", symbol: "$" }')));
  assert.equal(read.vendors.length, 2, 'the files are still parsed and reported');

  // The per-file validator exposes the same rule directly.
  const cnyOnly = validateVendorData('world.js', validWorldVendor(), { currency: 'CNY' });
  assert.ok(cnyOnly.errors.some((message) => /currency must be \{ code: "CNY", symbol: "¥" \}/.test(message)));
  assert.deepEqual(validateVendorData('world.js', validWorldVendor(), { currency: 'USD' }).errors, []);
});

test('invalid vendor files are rejected with an error naming every bad file', async (t) => {
  const dir = await tempCatalog(t, {
    'good.js': vendorSource(validVendor()),
    'bad-currency.js': vendorSource(validVendor({ vendor: 'bad-currency', currency: { code: 'EUR', symbol: '€' } })),
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
    const currencyIssue = error.errors.find((issue) => issue.startsWith('bad-currency.js: '));
    assert.ok(currencyIssue, 'the currency issue is prefixed with the file name');
    assert.match(currencyIssue, /CNY/);
    assert.match(currencyIssue, /USD/);
    assert.ok(error.errors.some((issue) => issue.startsWith('bad-price.js')), 'nested paths still start with the file name');
    assert.match(error.message, /invalid vendor catalog/);
    return true;
  });
});

test('a multi-section load reports rejected files from every section at once', async (t) => {
  const chinaDir = await tempCatalog(t, {
    'bad-china.js': vendorSource(validVendor({ vendor: 'bad-china', source: 'http://insecure.example/pricing' })),
  });
  const worldDir = await tempCatalog(t, {
    'bad-world.js': vendorSource(validWorldVendor({ vendor: 'bad-world', source: 'http://insecure.example/pricing' })),
  });

  await assert.rejects(async () => loadCatalogSections([
    { id: 'china', dir: chinaDir, currency: 'CNY' },
    { id: 'world', dir: worldDir, currency: 'USD' },
  ]), (error) => {
    assert.ok(error instanceof CatalogError);
    assert.match(error.message, /china\/bad-china\.js: source must be an official https URL/);
    assert.match(error.message, /world\/bad-world\.js: source must be an official https URL/);
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
  assert.equal(result.currency, null, 'a custom directory accepts either supported currency');
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
  assert.deepEqual(match.currency, CNY);
  assert.equal(match.rates.cacheWrite, 2, 'the cacheWrite default survives normalization');
  assert.equal(lookup({ model: 'ACME-CHAT-LEGACY' }).model.id, 'acme-chat');
  assert.deepEqual(lookup({ provider: 'acme', model: 'acme-long', promptTokens: 99999 }).tier, { maxInputTokens: 100000 });
});

test('the real catalog directories load: China (CNY) first, then world (USD)', () => {
  const chinaFiles = listVendorFiles(CHINA_DIR);
  const worldFiles = existsSync(WORLD_DIR) ? listVendorFiles(WORLD_DIR) : [];
  const vendors = loadCatalog(); // throws if any real file is invalid
  assert.ok(Array.isArray(vendors));
  assert.equal(typeof vendors.then, 'undefined', 'the Host activation path must not get a Promise');
  assert.match(CHINA_DIR, /catalog[\\/]china$/);
  assert.match(WORLD_DIR, /catalog[\\/]world$/);
  assert.equal(vendors.length, chinaFiles.length + worldFiles.length, 'every file that exists must load and validate');

  const china = vendors.slice(0, chinaFiles.length);
  const world = vendors.slice(chinaFiles.length);
  assert.equal(world.length, worldFiles.length);
  for (const vendor of china) assert.deepEqual(vendor.currency, CNY, `${vendor.vendor} lives in catalog/china`);
  for (const vendor of world) assert.deepEqual(vendor.currency, USD, `${vendor.vendor} lives in catalog/world`);

  const vendorIds = new Set();
  for (const vendor of vendors) {
    assert.match(vendor.vendor, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(vendor.vendor, vendor.vendor.trim());
    assert.ok(!vendorIds.has(vendor.vendor), `duplicate vendor id ${vendor.vendor}`);
    vendorIds.add(vendor.vendor);
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

  if (chinaFiles.length + worldFiles.length === 0) {
    assert.deepEqual(vendors, [], 'an empty data set is tolerated while the catalog is being written');
  } else {
    assert.ok(vendors.length > 0, 'real vendor files load');
  }
});
