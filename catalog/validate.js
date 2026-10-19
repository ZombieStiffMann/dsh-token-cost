#!/usr/bin/env node
// Validator and synchronous loader core for the China vendor price catalog.
//
// Usage:
//   node catalog/validate.js            # validate catalog/china/*.js
//   node catalog/validate.js <dir>      # validate another vendor directory
//
// It checks every vendor data file against the data contract in
// catalog/china/SCHEMA.md and prints warnings and errors. It exits 1 on any
// error, 0 otherwise.
//
// These pure helpers are also imported by catalog/index.js, whose
// `loadCatalog()` must be synchronous: the Host plugin builds its runtime
// catalog inside the synchronous `apply()`. Static ESM imports cannot enumerate
// a directory that other contributors are still filling in (and must not fail
// when an optional vendor file is not ready yet), so the vendor files are read
// as text and evaluated as one data expression. SCHEMA.md guarantees they are
// data-only (`export default { ... }`, no imports, no other code), which makes
// this equivalent to importing them, without top-level await and on Node 20+.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Directory holding one data module per China vendor. */
export const VENDOR_DIR = join(HERE, 'china');

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
 * @param {string} file - file name used as the prefix of every issue.
 * @param {unknown} data - the module's default export.
 * @returns {{ errors: string[], warnings: string[] }} all issues found (empty when valid).
 */
export function validateVendorData(file, data) {
  const issues = createIssues();
  const where = file;
  if (!isPlainObject(data)) {
    fail(issues, where, 'default export must be an object');
    return issues;
  }
  if (typeof data.vendor !== 'string' || !VENDOR_RE.test(data.vendor)) fail(issues, where, 'vendor must be a kebab-case id');
  if (typeof data.name !== 'string' || data.name.trim() === '') fail(issues, where, 'name is required');
  if (typeof data.nameEn !== 'string' || data.nameEn.trim() === '') fail(issues, where, 'nameEn is required');
  if (!isPlainObject(data.currency) || data.currency.code !== 'CNY' || data.currency.symbol !== '¥') fail(issues, where, 'currency must be { code: "CNY", symbol: "¥" }');
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
export function listVendorFiles(dir = VENDOR_DIR) {
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

function crossFileIssues(entries, issues) {
  const vendorIds = new Map();
  const modelIds = new Map();
  for (const { file, data } of entries) {
    if (vendorIds.has(data.vendor)) fail(issues, file, `duplicate vendor id ${data.vendor} (also ${vendorIds.get(data.vendor)})`);
    else vendorIds.set(data.vendor, file);
    for (const model of Array.isArray(data.models) ? data.models : []) {
      if (!isPlainObject(model) || typeof model.id !== 'string') continue;
      const id = model.id.trim().toLowerCase();
      if (modelIds.has(id)) warn(issues, file, `model id ${model.id} also appears in ${modelIds.get(id)}; provider mapping decides`);
      else modelIds.set(id, file);
      for (const alias of Array.isArray(model.aliases) ? model.aliases : []) {
        if (typeof alias !== 'string') continue;
        const key = alias.trim().toLowerCase();
        if (modelIds.has(key)) warn(issues, file, `alias ${alias} collides with ${modelIds.get(key)}`);
        else modelIds.set(key, file);
      }
    }
  }
}

/**
 * Read and validate every vendor file in `dir`.
 *
 * Serialization uses the same rule as the loader: files are ordered by name so
 * the catalog order is stable across machines and runs.
 *
 * @param {string} [dir] - vendor directory (defaults to catalog/china).
 * @returns {{
 *   dir: string,
 *   files: string[],
 *   vendors: Array<{ file: string, data: object }>,
 *   modelCount: number,
 *   errors: string[],
 *   warnings: string[],
 * }} the loaded data plus every issue; `errors` is non-empty when any file is
 *   unreadable, not a data-only default export, or fails the schema.
 * @throws {Error} when `dir` cannot be read at all.
 */
export function readVendorCatalogSync(dir = VENDOR_DIR) {
  const files = listVendorFiles(dir);
  const issues = createIssues();
  const entries = [];
  for (const file of files) {
    let data;
    try {
      data = evaluateVendorSource(readFileSync(join(dir, file), 'utf8'));
    } catch (error) {
      fail(issues, file, `cannot load vendor file: ${error.message}`);
      continue;
    }
    const fileIssues = validateVendorData(file, data);
    issues.errors.push(...fileIssues.errors);
    issues.warnings.push(...fileIssues.warnings);
    if (isPlainObject(data) && typeof data.vendor === 'string') entries.push({ file, data });
  }
  crossFileIssues(entries, issues);
  const modelCount = entries.reduce((sum, { data }) => sum + (Array.isArray(data.models) ? data.models.length : 0), 0);
  return { dir, files, vendors: entries, modelCount, errors: issues.errors, warnings: issues.warnings };
}

function printReport(catalog) {
  for (const message of catalog.warnings) console.warn(`WARN  ${message}`);
  for (const message of catalog.errors) console.error(`ERROR ${message}`);
  console.log(`catalog: ${catalog.vendors.length} vendor(s), ${catalog.modelCount} model(s), ${catalog.errors.length} error(s), ${catalog.warnings.length} warning(s)`);
}

/** CLI entry point (kept synchronous so `node catalog/validate.js` has no async surface). */
export function main(argv = process.argv) {
  const directory = argv[2];
  const dir = typeof directory === 'string' && directory.trim() !== ''
    ? (isAbsolute(directory) ? directory : resolve(process.cwd(), directory))
    : VENDOR_DIR;
  let catalog;
  try {
    catalog = readVendorCatalogSync(dir);
  } catch (error) {
    console.error(`catalog: cannot read ${dir}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  if (catalog.files.length === 0) {
    console.log(dir === VENDOR_DIR ? 'catalog: no vendor files yet (catalog/china/*.js)' : `catalog: no vendor files yet (${dir})`);
    return;
  }
  printReport(catalog);
  if (catalog.errors.length > 0) process.exitCode = 1;
}

const invokedDirectly = typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
