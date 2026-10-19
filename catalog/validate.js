#!/usr/bin/env node
// Validator and synchronous loader core for the curated vendor price catalogs.
//
// Usage:
//   node catalog/validate.js            # validate catalog/china and catalog/world
//   node catalog/validate.js <dir>      # validate another vendor directory
//
// The two curated sections are:
//   catalog/china/*.js  CNY (¥) — mainland-China vendors
//   catalog/world/*.js  USD ($) — international vendors
// A custom directory passed on the command line (or via the API) may contain
// either currency. The rest of the data contract — rates per 1,000,000 tokens,
// tiers, aliases, matchPrefixes, providers, billing, asOf, source — is shared
// and documented in catalog/china/SCHEMA.md (world/SCHEMA.md references it).
//
// It checks every present vendor data file and prints warnings and errors. It
// exits 1 on any error, 0 otherwise. An empty/partial world directory is valid:
// contributors may land world vendors one at a time.
//
// These pure helpers are also imported by catalog/index.js, whose
// `loadCatalog()` must be synchronous: the Host plugin builds its runtime
// catalog inside the synchronous `apply()`. Static ESM imports cannot enumerate
// a directory that other contributors are still filling in (and must not fail
// when an optional vendor file is not ready yet), so the vendor files are read
// as text and evaluated as one data expression. SCHEMA.md guarantees they are
// data-only (`export default { ... }`, no imports, no other code), which makes
// this equivalent to importing them, without top-level await and on Node 20+.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Directory holding the CNY (mainland-China) vendor data files. */
export const CHINA_DIR = join(HERE, 'china');

/** Directory holding the USD (international) vendor data files. */
export const WORLD_DIR = join(HERE, 'world');

/** @deprecated Historical alias for {@link CHINA_DIR}; use `CHINA_DIR`. */
export const VENDOR_DIR = CHINA_DIR;

/** The currencies a vendor catalog may declare. */
export const CURRENCIES = Object.freeze({
  CNY: Object.freeze({ code: 'CNY', symbol: '¥' }),
  USD: Object.freeze({ code: 'USD', symbol: '$' }),
});

/**
 * Curated catalog sections, in loading order: China (CNY) first, then world
 * (USD). `optional: true` sections may be missing on disk (the world set can be
 * empty while contributors add vendors); a required section that cannot be
 * read is reported as an error.
 */
export const CATALOG_SECTIONS = Object.freeze([
  Object.freeze({ id: 'china', dir: CHINA_DIR, currency: 'CNY', optional: false }),
  Object.freeze({ id: 'world', dir: WORLD_DIR, currency: 'USD', optional: true }),
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VENDOR_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/;
const URL_RE = /^https:\/\/\S+$/;
const EXPORT_DEFAULT_RE = /^\s*export\s+default\b/m;

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createIssues() {
  return { errors: [], warnings: [] };
}

function fail(issues, where, message) {
  issues.errors.push(`${where}: ${message}`);
}

function warn(issues, where, message) {
  issues.warnings.push(`${where}: ${message}`);
}

/** Whether a declared currency is one of the supported currencies (optionally one specific currency). */
export function isSupportedCurrency(currency, expected = null) {
  if (!isPlainObject(currency)) return false;
  const matches = (target) => currency.code === target.code && currency.symbol === target.symbol;
  if (expected !== null && Object.hasOwn(CURRENCIES, expected)) return matches(CURRENCIES[expected]);
  return matches(CURRENCIES.CNY) || matches(CURRENCIES.USD);
}

function currencyMessage(expected) {
  const targets = expected !== null && Object.hasOwn(CURRENCIES, expected)
    ? [CURRENCIES[expected]]
    : [CURRENCIES.CNY, CURRENCIES.USD];
  const shapes = targets.map((currency) => `{ code: "${currency.code}", symbol: "${currency.symbol}" }`).join(' or ');
  return `currency must be ${shapes}`;
}

/** Canonical path key: case-insensitive on Windows so both path spellings match. */
function pathKey(value) {
  const normalized = resolve(value).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * Currency a curated directory is expected to declare (`'CNY'`/`'USD'`), or
 * `null` for any other/custom directory, which may hold either currency.
 *
 * @param {string} dir
 * @returns {'CNY' | 'USD' | null}
 */
export function currencyForDir(dir) {
  if (typeof dir !== 'string' || dir === '') return null;
  const key = pathKey(dir);
  for (const section of CATALOG_SECTIONS) if (pathKey(section.dir) === key) return section.currency;
  return null;
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return false;
  return new Date(time).toISOString().slice(0, 10) === value;
}

function validateRates(issues, where, rates) {
  if (!isPlainObject(rates)) {
    fail(issues, where, 'rates must be an object');
    return;
  }
  for (const key of ['cacheHit', 'cacheMiss', 'output']) {
    const value = rates[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(issues, where, `rates.${key} must be a non-negative number`);
    if (key !== 'cacheHit' && typeof value === 'number' && value <= 0) fail(issues, where, `rates.${key} must be > 0`);
  }
  if (rates.cacheWrite !== undefined && (typeof rates.cacheWrite !== 'number' || !Number.isFinite(rates.cacheWrite) || rates.cacheWrite < 0)) {
    fail(issues, where, 'rates.cacheWrite must be a non-negative number when present');
  }
  if (typeof rates.cacheHit === 'number' && typeof rates.cacheMiss === 'number' && rates.cacheHit > rates.cacheMiss) {
    warn(issues, where, 'cacheHit is higher than cacheMiss; double-check the table');
  }
}

function validateWindows(issues, where, windows) {
  if (!Array.isArray(windows) || windows.length === 0) {
    fail(issues, where, 'windows must be a non-empty array');
    return;
  }
  for (const window of windows) {
    if (!Array.isArray(window) || window.length !== 2) {
      fail(issues, where, 'each window must be [startMinute, endMinute]');
      continue;
    }
    const [start, end] = window;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end) fail(issues, where, `invalid window ${JSON.stringify(window)}`);
  }
}

function validateModel(issues, where, model) {
  if (!isPlainObject(model)) {
    fail(issues, where, 'model must be an object');
    return null;
  }
  if (typeof model.id !== 'string' || !MODEL_ID_RE.test(model.id)) fail(issues, where, 'model.id must be a wire model id');
  if (typeof model.name !== 'string' || model.name.trim() === '') fail(issues, where, 'model.name is required');
  const hasRates = model.rates !== undefined;
  const hasTiers = model.tiers !== undefined;
  if (hasRates === hasTiers) fail(issues, where, 'exactly one of rates/tiers is required');
  if (hasRates) validateRates(issues, where, model.rates);
  if (hasTiers) {
    if (!Array.isArray(model.tiers) || model.tiers.length === 0) {
      fail(issues, where, 'tiers must be a non-empty array');
    } else {
      let previous = 0;
      for (const [index, tier] of model.tiers.entries()) {
        const tierWhere = `${where}.tiers[${index}]`;
        if (!isPlainObject(tier)) {
          fail(issues, tierWhere, 'tier must be an object');
          continue;
        }
        if (!Number.isSafeInteger(tier.maxInputTokens) || tier.maxInputTokens <= previous) {
          fail(issues, tierWhere, 'maxInputTokens must be a positive integer, strictly ascending');
        } else {
          previous = tier.maxInputTokens;
        }
        validateRates(issues, tierWhere, tier.rates);
      }
    }
  }
  if (model.aliases !== undefined) {
    if (!Array.isArray(model.aliases) || model.aliases.some((alias) => typeof alias !== 'string' || alias.trim() === '')) {
      fail(issues, where, 'aliases must be a non-empty string array');
    } else {
      for (const alias of model.aliases) if (alias.trim() === model.id.trim()) fail(issues, where, `alias duplicates the model id: ${alias}`);
    }
  }
  if (model.matchPrefixes !== undefined) {
    if (!Array.isArray(model.matchPrefixes) || model.matchPrefixes.some((prefix) => typeof prefix !== 'string' || prefix.trim() === '')) {
      fail(issues, where, 'matchPrefixes must be a non-empty string array');
    }
  }
  if (model.offPeakMultiplier !== undefined && (typeof model.offPeakMultiplier !== 'number' || !(model.offPeakMultiplier > 0) || model.offPeakMultiplier > 1)) {
    fail(issues, where, 'offPeakMultiplier must be in (0, 1]');
  }
  if (model.peakWindows !== undefined) validateWindows(issues, `${where}.peakWindows`, model.peakWindows);
  if (model.notes !== undefined && (typeof model.notes !== 'string' || model.notes.trim() === '')) fail(issues, where, 'notes must be a non-empty string when present');
  return model;
}

/**
 * Validate one vendor data object against SCHEMA.md.
 *
 * @param {string} file - file name/label prefixed to every issue.
 * @param {unknown} data - the module's default export.
 * @param {{ currency?: 'CNY' | 'USD' | null }} [options] - expected currency;
 *   `null`/omitted accepts either supported currency.
 * @returns {{ errors: string[], warnings: string[] }} all issues found (empty when valid).
 */
export function validateVendorData(file, data, options = {}) {
  const expectedCurrency = isPlainObject(options) && typeof options.currency === 'string' && Object.hasOwn(CURRENCIES, options.currency)
    ? options.currency
    : null;
  const issues = createIssues();
  const where = file;
  if (!isPlainObject(data)) {
    fail(issues, where, 'default export must be an object');
    return issues;
  }
  if (typeof data.vendor !== 'string' || !VENDOR_RE.test(data.vendor)) fail(issues, where, 'vendor must be a kebab-case id');
  if (typeof data.name !== 'string' || data.name.trim() === '') fail(issues, where, 'name is required');
  if (typeof data.nameEn !== 'string' || data.nameEn.trim() === '') fail(issues, where, 'nameEn is required');
  if (!isSupportedCurrency(data.currency, expectedCurrency)) fail(issues, where, currencyMessage(expectedCurrency));
  if (typeof data.source !== 'string' || !URL_RE.test(data.source)) fail(issues, where, 'source must be an official https URL');
  if (!validDate(data.asOf)) fail(issues, where, 'asOf must be an existing YYYY-MM-DD date');
  if (!Array.isArray(data.providers) || data.providers.some((provider) => typeof provider !== 'string' || provider.trim() === '')) {
    fail(issues, where, 'providers must be a string array');
  }
  if (data.billing !== undefined) {
    const billing = data.billing;
    if (!isPlainObject(billing)) fail(issues, where, 'billing must be an object when present');
    else {
      validateWindows(issues, `${where}.billing.windows`, billing.windows);
      if (typeof billing.offPeakMultiplier !== 'number' || !(billing.offPeakMultiplier > 0) || billing.offPeakMultiplier > 1) {
        fail(issues, where, 'billing.offPeakMultiplier must be in (0, 1]');
      }
      if (billing.weekdays !== undefined && (!Array.isArray(billing.weekdays) || billing.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) {
        fail(issues, where, 'billing.weekdays must be integers 0..6');
      }
      if (billing.holidays !== undefined && (!Array.isArray(billing.holidays) || billing.holidays.some((day) => !validDate(day)))) {
        fail(issues, where, 'billing.holidays must be YYYY-MM-DD strings');
      }
    }
  }
  if (!Array.isArray(data.models) || data.models.length === 0) {
    fail(issues, where, 'models must be a non-empty array');
    return issues;
  }
  const seen = new Set();
  for (const [index, model] of data.models.entries()) {
    const modelWhere = `${where}.models[${index}]`;
    const validated = validateModel(issues, modelWhere, model);
    if (validated === null || typeof validated.id !== 'string') continue;
    const id = validated.id.trim();
    if (seen.has(id)) fail(issues, modelWhere, `duplicate model id ${validated.id}`);
    else seen.add(id);
  }
  return issues;
}

/** Sorted list of vendor file names in `dir`, ignoring `_`-prefixed files and non-`.js` entries. */
export function listVendorFiles(dir = CHINA_DIR) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name.startsWith('_')) continue;
    files.push(entry.name);
  }
  return files.sort();
}

/**
 * Evaluate one data-only vendor module source and return its default export.
 *
 * The contract (SCHEMA.md) allows exactly `export default { ... }` and nothing
 * else, so rewriting that one statement to `module.exports =` and running it in
 * a function is equivalent to a module import, minus the async boundary.
 *
 * @param {string} source - file contents.
 * @returns {unknown} the default export.
 * @throws {Error} when the source is not a data-only default export or throws.
 */
export function evaluateVendorSource(source) {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  if (!EXPORT_DEFAULT_RE.test(text)) throw new Error('no `export default` statement found');
  const commonjs = text.replace(EXPORT_DEFAULT_RE, 'module.exports =');
  const factory = new Function('module', 'exports', `'use strict';\n${commonjs}\n;return module.exports;`);
  const module = { exports: {} };
  return factory(module, module.exports);
}

function countModels(entries) {
  let count = 0;
  for (const { data } of entries) if (Array.isArray(data.models)) count += data.models.length;
  return count;
}

function crossFileIssues(entries, issues) {
  const vendorIds = new Map();
  const modelIds = new Map();
  for (const { label, data } of entries) {
    if (vendorIds.has(data.vendor)) fail(issues, label, `duplicate vendor id ${data.vendor} (also ${vendorIds.get(data.vendor)})`);
    else vendorIds.set(data.vendor, label);
    for (const model of Array.isArray(data.models) ? data.models : []) {
      if (!isPlainObject(model) || typeof model.id !== 'string') continue;
      const id = model.id.trim().toLowerCase();
      if (modelIds.has(id)) warn(issues, label, `model id ${model.id} also appears in ${modelIds.get(id)}; provider mapping decides`);
      else modelIds.set(id, label);
      for (const alias of Array.isArray(model.aliases) ? model.aliases : []) {
        if (typeof alias !== 'string') continue;
        const key = alias.trim().toLowerCase();
        if (modelIds.has(key)) warn(issues, label, `alias ${alias} collides with ${modelIds.get(key)}`);
        else modelIds.set(key, label);
      }
    }
  }
}

/** Read, evaluate and per-file-validate every vendor file in one directory. */
function readVendorFilesSync(dir, { currency = currencyForDir(dir), labelPrefix = '' } = {}) {
  const files = listVendorFiles(dir);
  const issues = createIssues();
  const entries = [];
  for (const file of files) {
    const label = `${labelPrefix}${file}`;
    let data;
    try {
      data = evaluateVendorSource(readFileSync(join(dir, file), 'utf8'));
    } catch (error) {
      fail(issues, label, `cannot load vendor file: ${error.message}`);
      continue;
    }
    const fileIssues = validateVendorData(label, data, { currency });
    issues.errors.push(...fileIssues.errors);
    issues.warnings.push(...fileIssues.warnings);
    if (isPlainObject(data) && typeof data.vendor === 'string') entries.push({ file, label, data });
  }
  return { dir, files, entries, errors: issues.errors, warnings: issues.warnings, currency };
}

/**
 * Read and validate every vendor file in one directory.
 *
 * Files are ordered by name so catalog order is stable across machines. The
 * expected currency is inferred from the directory when it is one of the
 * curated sections (China → CNY, world → USD); other directories accept either
 * supported currency unless `options.currency` is passed explicitly.
 *
 * @param {string} [dir] - vendor directory (defaults to catalog/china).
 * @param {{ currency?: 'CNY' | 'USD' | null, labelPrefix?: string }} [options]
 * @returns {{
 *   dir: string,
 *   files: string[],
 *   vendors: Array<{ file: string, data: object }>,
 *   modelCount: number,
 *   currency: 'CNY' | 'USD' | null,
 *   errors: string[],
 *   warnings: string[],
 * }} the loaded data plus every issue; `errors` is non-empty when any file is
 *   unreadable, not a data-only default export, or fails the schema.
 * @throws {Error} when `dir` cannot be read at all.
 */
export function readVendorCatalogSync(dir = CHINA_DIR, options = {}) {
  const read = readVendorFilesSync(dir, options);
  const issues = { errors: [...read.errors], warnings: [...read.warnings] };
  crossFileIssues(read.entries, issues);
  return {
    dir,
    files: read.files,
    vendors: read.entries.map(({ file, data }) => ({ file, data })),
    modelCount: countModels(read.entries),
    currency: read.currency,
    errors: issues.errors,
    warnings: issues.warnings,
  };
}

/**
 * Read and validate several catalog sections (directories), in order.
 *
 * Used by `loadCatalog()` to combine `catalog/china` (CNY) and `catalog/world`
 * (USD). Each section may be `{ id, dir, currency, optional }`; `optional`
 * sections that do not exist on disk are treated as empty (the world data set
 * may still be under construction). Problems are collected, never thrown, so
 * the caller can report every rejected file across all sections at once.
 *
 * @param {Array<{ id?: string, dir: string, currency?: 'CNY' | 'USD' | null, optional?: boolean }>} [sections]
 * @returns {{
 *   sections: Array<{ id: string | null, dir: string, currency: 'CNY' | 'USD' | null,
 *     files: string[], vendors: Array<{ file: string, data: object }>, modelCount: number }>,
 *   files: string[],
 *   vendors: Array<{ file: string, data: object }>,
 *   modelCount: number,
 *   errors: string[],
 *   warnings: string[],
 * }} combined data and issues; file labels are prefixed with the section id
 *   (`china/…`, `world/…`) so they stay unambiguous across directories.
 */
export function readCatalogsSync(sections = CATALOG_SECTIONS) {
  const list = Array.isArray(sections) ? sections : [];
  const issues = createIssues();
  const allEntries = [];
  const allFiles = [];
  const resolvedSections = [];
  for (const section of list) {
    if (!isPlainObject(section) || typeof section.dir !== 'string' || section.dir === '') {
      fail(issues, 'catalog', 'section must declare a directory');
      continue;
    }
    const id = typeof section.id === 'string' && section.id !== '' ? section.id : null;
    const labelPrefix = id === null ? '' : `${id}/`;
    const currency = typeof section.currency === 'string' && Object.hasOwn(CURRENCIES, section.currency)
      ? section.currency
      : currencyForDir(section.dir);
    let read;
    try {
      read = readVendorFilesSync(section.dir, { currency, labelPrefix });
    } catch (error) {
      if (section.optional === true && !existsSync(section.dir)) {
        resolvedSections.push({ id, dir: section.dir, currency, files: [], vendors: [], modelCount: 0 });
        continue;
      }
      fail(issues, id ?? 'catalog', `cannot read ${section.dir}: ${error.message}`);
      continue;
    }
    const entries = read.entries.map(({ file, data }) => ({ file, data }));
    allEntries.push(...read.entries);
    allFiles.push(...read.files);
    resolvedSections.push({ id, dir: section.dir, currency, files: read.files, vendors: entries, modelCount: countModels(read.entries) });
    issues.errors.push(...read.errors);
    issues.warnings.push(...read.warnings);
  }
  crossFileIssues(allEntries, issues);
  return {
    sections: resolvedSections,
    files: allFiles,
    vendors: allEntries.map(({ file, data }) => ({ file, data })),
    modelCount: countModels(allEntries),
    errors: issues.errors,
    warnings: issues.warnings,
  };
}

function printReport(catalog) {
  for (const message of catalog.warnings) console.warn(`WARN  ${message}`);
  for (const message of catalog.errors) console.error(`ERROR ${message}`);
  console.log(`catalog: ${catalog.vendors.length} vendor(s), ${catalog.modelCount} model(s), ${catalog.errors.length} error(s), ${catalog.warnings.length} warning(s)`);
}

/** CLI entry point (kept synchronous so `node catalog/validate.js` has no async surface). */
export function main(argv = process.argv) {
  const directory = argv[2];
  if (typeof directory === 'string' && directory.trim() !== '') {
    const dir = isAbsolute(directory) ? directory : resolve(process.cwd(), directory);
    let catalog;
    try {
      catalog = readVendorCatalogSync(dir);
    } catch (error) {
      console.error(`catalog: cannot read ${dir}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    if (catalog.files.length === 0) {
      console.log(`catalog: no vendor files yet (${dir})`);
      return;
    }
    printReport(catalog);
    if (catalog.errors.length > 0) process.exitCode = 1;
    return;
  }

  const catalog = readCatalogsSync();
  if (catalog.files.length === 0 && catalog.errors.length === 0) {
    console.log('catalog: no vendor files yet (catalog/china/*.js, catalog/world/*.js)');
    return;
  }
  printReport(catalog);
  if (catalog.errors.length > 0) process.exitCode = 1;
}

const invokedDirectly = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
