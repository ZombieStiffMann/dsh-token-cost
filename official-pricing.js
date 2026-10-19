/**
 * Official DeepSeek price-page reader.
 *
 * The plugin prices tokens with the latest official rates, so the Host half
 * re-reads the public pricing page in the background and swaps the catalog for
 * usages that happen after a successful read. This module is pure (no network,
 * no filesystem): it turns the page HTML into a catalog patch, and returns null
 * on any unexpected layout so the caller keeps the previous catalog instead of
 * pricing with a half-parsed table.
 *
 * Nothing here trusts the page as instructions; the HTML is only parsed for
 * numbers and model ids.
 */

/** Official CNY pricing page used by default. */
export const OFFICIAL_PRICE_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing';

/** Model ids the official page is expected to price (additional ids are accepted too). */
const EXPECTED_MODELS = ['deepseek-flash', 'deepseek-v4-pro'];

/** Strip tags, decode the few entities the table uses, collapse whitespace. */
function textOf(html) {
  return html
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(td|th|tr|p|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

/** Wall-clock date (`YYYY-MM-DD`) of one instant in Beijing time. */
function beijingDate(nowMs) {
  const shifted = new Date(nowMs + 480 * 60000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** `HH:MM` in the page to minutes after midnight, or null. */
function minuteOf(hours, minutes) {
  const h = Number(hours);
  const m = Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 24 || m < 0 || m > 59) return null;
  if (h === 24 && m !== 0) return null;
  return h * 60 + m;
}

/**
 * Read peak windows out of the pricing footnote, when it still states them in
 * the expected shape ("... 9:00 - 12:00、14:00 - 18:00 为高峰时段").
 *
 * @returns {Array<[number, number]> | null} windows, or null when the footnote
 *   cannot be recognized (the caller keeps the configured windows).
 */
function parsePeakWindows(html) {
  const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  const footnote = paragraphs.find((paragraph) => {
    const text = textOf(paragraph);
    return text.includes('高峰时段') && text.includes('空闲时段价格');
  });
  if (footnote === undefined) return null;
  const windows = [];
  const pattern = /(\d{1,2}):(\d{2})\s*[-–—至~]\s*(\d{1,2}):(\d{2})/g;
  let match;
  while ((match = pattern.exec(textOf(footnote))) !== null) {
    const start = minuteOf(match[1], match[2]);
    const end = minuteOf(match[3], match[4]);
    if (start === null || end === null || start >= end) return null;
    windows.push([start, end]);
  }
  if (windows.length === 0) return null;
  windows.sort((left, right) => left[0] - right[0]);
  return windows;
}

/** The models table, its price rows, and its header model ids. */
function readPriceTable(html) {
  const marker = html.indexOf('百万tokens输入');
  if (marker < 0) return null;
  const tableStart = html.lastIndexOf('<table', marker);
  const tableEnd = html.indexOf('</table>', marker);
  if (tableStart < 0 || tableEnd < 0) return null;
  const table = html.slice(tableStart, tableEnd + '</table>'.length);
  const rows = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  if (rows.length === 0) return null;

  const header = rows.find((row) => /deepseek-[a-z0-9.-]+/.test(textOf(row)) && /模型/.test(textOf(row)));
  if (header === undefined) return null;
  const modelIds = [];
  const idPattern = /deepseek-[a-z0-9.-]+/gi;
  let idMatch;
  while ((idMatch = idPattern.exec(textOf(header))) !== null) {
    if (!modelIds.includes(idMatch[0])) modelIds.push(idMatch[0]);
  }
  if (modelIds.length === 0) return null;

  /** band -> bucket -> array of numbers in header column order. */
  const cells = {
    peak: { cacheHit: [], cacheMiss: [], output: [] },
    offPeak: { cacheHit: [], cacheMiss: [], output: [] },
  };
  // The table groups each bucket under a rowspanned label cell: the first row
  // of the pair carries "…（缓存命中）/（缓存未命中）" or "百万tokens输出", the
  // second only repeats the band. Track the label across rows.
  let currentBucket = null;
  for (const row of rows) {
    const text = textOf(row);
    if (text.includes('缓存未命中')) currentBucket = 'cacheMiss';
    else if (text.includes('缓存命中')) currentBucket = 'cacheHit';
    else if (text.includes('tokens输出')) currentBucket = 'output';
    if (!text.includes('元')) continue;
    let band;
    if (text.includes('空闲时段')) band = 'offPeak';
    else if (text.includes('高峰时段')) band = 'peak';
    else continue;
    if (currentBucket === null) return null;
    const numbers = [];
    const numberPattern = /([0-9]+(?:\.[0-9]+)?)\s*元/g;
    let numberMatch;
    while ((numberMatch = numberPattern.exec(text)) !== null) numbers.push(Number(numberMatch[1]));
    if (numbers.length !== modelIds.length) return null;
    cells[band][currentBucket] = numbers;
  }

  for (const band of ['peak', 'offPeak']) {
    for (const bucket of ['cacheHit', 'cacheMiss', 'output']) {
      if (cells[band][bucket].length !== modelIds.length) return null;
    }
  }
  return { modelIds, cells };
}

/**
 * Parse the official pricing page into a catalog patch.
 *
 * @param {string} html - page HTML.
 * @param {{ now?: number, sourceUrl?: string }} [options]
 * @returns {null | { asOf: string, source: string, fetchedAt: number,
 *   peakWindows: Array<[number, number]> | null,
 *   models: Record<string, { name: string, rates: object, offPeakMultiplier: number }> }}
 *   A catalog patch, or null when the page layout or numbers are not usable.
 */
export function parseOfficialPricingPage(html, options = {}) {
  if (typeof html !== 'string' || html.length === 0) return null;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const sourceUrl = typeof options.sourceUrl === 'string' && options.sourceUrl !== '' ? options.sourceUrl : OFFICIAL_PRICE_URL;

  const table = readPriceTable(html);
  if (table === null) return null;

  const models = {};
  for (let column = 0; column < table.modelIds.length; column += 1) {
    const id = table.modelIds[column].toLowerCase();
    const peak = {
      cacheHit: table.cells.peak.cacheHit[column],
      cacheMiss: table.cells.peak.cacheMiss[column],
      output: table.cells.peak.output[column],
    };
    const offPeak = {
      cacheHit: table.cells.offPeak.cacheHit[column],
      cacheMiss: table.cells.offPeak.cacheMiss[column],
      output: table.cells.offPeak.output[column],
    };
    // Sanity: the three observed prices must be non-negative numbers, and the
    // miss/output prices positive enough for a real model.
    for (const value of [peak.cacheHit, peak.cacheMiss, peak.output, offPeak.cacheHit, offPeak.cacheMiss, offPeak.output]) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000) return null;
    }
    if (peak.cacheMiss <= 0 || peak.output <= 0) return null;

    // Off-peak is "half the peak price"; derive the multiplier from the table
    // instead of hard-coding it so a rate change cannot silently misprice.
    const ratios = [];
    for (const bucket of ['cacheHit', 'cacheMiss', 'output']) {
      if (peak[bucket] > 0) ratios.push(offPeak[bucket] / peak[bucket]);
    }
    if (ratios.length === 0) return null;
    const multiplier = ratios[0];
    if (!(multiplier > 0 && multiplier <= 1)) return null;
    if (ratios.some((ratio) => Math.abs(ratio - multiplier) > 1e-6)) return null;

    models[id] = {
      name: id,
      rates: { cacheMiss: peak.cacheMiss, cacheHit: peak.cacheHit, output: peak.output },
      offPeakMultiplier: Math.round(multiplier * 1e6) / 1e6,
    };
  }
  if (Object.keys(models).length === 0) return null;
  // The current page always prices at least the two shipped models; a page that
  // prices neither is treated as a layout change, not as a price list.
  if (!EXPECTED_MODELS.some((id) => Object.hasOwn(models, id))) return null;

  return {
    asOf: beijingDate(now),
    source: sourceUrl,
    fetchedAt: now,
    peakWindows: parsePeakWindows(html),
    models,
  };
}
