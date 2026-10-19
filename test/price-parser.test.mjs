/**
 * Official price-page parser tests. Uses the real page saved at
 * test/fixtures/pricing-zh.html plus synthetic broken layouts, so the background
 * refresh can never replace a good catalog with a half-parsed one.
 *
 * Run: node --test test/price-parser.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parseOfficialPricingPage, OFFICIAL_PRICE_URL } from '../official-pricing.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, 'fixtures', 'pricing-zh.html'), 'utf8');
const NOW = Date.parse('2026-10-19T15:00:00Z');

test('reads the current official CNY table', () => {
  const parsed = parseOfficialPricingPage(fixture, { now: NOW, sourceUrl: OFFICIAL_PRICE_URL });
  assert.notEqual(parsed, null);
  assert.equal(parsed.source, OFFICIAL_PRICE_URL);
  assert.equal(parsed.asOf, '2026-10-19');
  assert.deepEqual(parsed.models['deepseek-flash'].rates, { cacheMiss: 2, cacheHit: 0.04, output: 8 });
  assert.deepEqual(parsed.models['deepseek-v4-pro'].rates, { cacheMiss: 9, cacheHit: 0.3, output: 27 });
  assert.equal(parsed.models['deepseek-flash'].offPeakMultiplier, 0.5);
  assert.equal(parsed.models['deepseek-v4-pro'].offPeakMultiplier, 0.5);
  assert.deepEqual(parsed.peakWindows, [[540, 720], [840, 1080]]);
});

test('a changed price table is read instead of the built-in snapshot', () => {
  const changed = fixture
    .replace('<td>0.04元</td><td>0.30元</td>', '<td>0.05元</td><td>0.36元</td>')
    .replace('<td>0.02元</td><td>0.15元</td>', '<td>0.025元</td><td>0.18元</td>');
  const parsed = parseOfficialPricingPage(changed, { now: NOW });
  assert.notEqual(parsed, null);
  assert.equal(parsed.models['deepseek-flash'].rates.cacheHit, 0.05);
  assert.equal(parsed.models['deepseek-v4-pro'].rates.cacheHit, 0.36);
  assert.equal(parsed.models['deepseek-flash'].offPeakMultiplier, 0.5);
});

test('page without the model table is rejected', () => {
  assert.equal(parseOfficialPricingPage('<html><body>maintenance</body></html>', { now: NOW }), null);
});

test('table with an inconsistent off-peak ratio is rejected', () => {
  // 0.02 / 0.04 is fine, but 0.15 / 0.30 becomes 0.15 / 0.31 -> ratio 0.4838
  const inconsistent = fixture.replace('<td>0.04元</td><td>0.30元</td>', '<td>0.04元</td><td>0.31元</td>');
  assert.equal(parseOfficialPricingPage(inconsistent, { now: NOW }), null);
});

test('table with a missing price column is rejected', () => {
  const missingColumn = fixture.replace('<td>0.02元</td><td>0.15元</td>', '<td>0.02元</td><td>0.15元</td><td>1元</td>');
  assert.equal(parseOfficialPricingPage(missingColumn, { now: NOW }), null);
});

test('renamed peak windows in the footnote are carried through', () => {
  const renamed = fixture.replace('9:00 - 12:00、14:00 - 18:00', '10:00 - 11:30、15:00 - 19:00');
  const parsed = parseOfficialPricingPage(renamed, { now: NOW });
  assert.notEqual(parsed, null);
  assert.deepEqual(parsed.peakWindows, [[600, 690], [900, 1140]]);
});

test('unrecognized footnote keeps the configured windows (null patch value)', () => {
  const noFootnote = fixture.replace('北京时间周一至周五（不含中国法定节假日）9:00 - 12:00、14:00 - 18:00 为高峰时段；其余时段，包括周末及中国法定节假日全天均为空闲时段。', '');
  const parsed = parseOfficialPricingPage(noFootnote, { now: NOW });
  assert.notEqual(parsed, null);
  assert.equal(parsed.peakWindows, null);
  assert.equal(parsed.models['deepseek-flash'].rates.cacheMiss, 2);
});
