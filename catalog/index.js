/**
 * Loader for the curated vendor price catalogs.
 *
 * Two sections are loaded, in this order:
 *   1. `catalog/china/*.js` — mainland-China vendors, prices in CNY (¥);
 *   2. `catalog/world/*.js` — international vendors, prices in USD ($).
 *
 * Files are ordered by name inside each section, so the result order is stable
 * across machines and runs. DeepSeek itself is deliberately not here: its
 * official catalog and refresh logic live in `pricing.js`, and the runtime
 * catalog builder (`cost-catalog.js`) prepends it. This module only loads the
 * vendored data files, validates each one against the SCHEMA (shared contract in
 * `catalog/china/SCHEMA.md`) and normalizes the result into the shape the lookup
 * engine (`./lookup.js`) and the cost fold consume.
 *
 * `loadCatalog()` is synchronous on purpose: the Host plugin builds its runtime
 * catalog inside the synchronous `apply()`. It throws a `CatalogError` that
 * names every rejected file (across both directories) instead of silently
 * loading a partial catalog; the caller may catch it (activation keeps working
 * with the DeepSeek catalog only) or let it fail loudly in tests. The world
 * directory may legitimately be missing or empty while the curated data is
 * being filled in, in which case only the China vendors are returned.
 *
 * @module catalog/index
 */
import {
  CATALOG_SECTIONS,
  CHINA_DIR,
  WORLD_DIR,
  readCatalogsSync,
  readVendorCatalogSync,
} from './validate.js';

export { CHINA_DIR, WORLD_DIR };

/**
 * Error thrown by {@link loadCatalog} when a directory cannot be read, at least
 * one vendor file is invalid, or an explicit `minVendors` expectation is not
 * met. `errors` contains one entry per problem (each prefixed with the file
 * name/label where applicable).
 */
export class CatalogError extends Error {
  /**
   * @param {string[]} errors - one message per problem.
   * @param {{ dir?: string | null, dirs?: string[] | null }} [options]
   */
  constructor(errors, { dir = null, dirs = null } = {}) {
    const list = (Array.isArray(errors) ? errors : [errors]).map((message) => String(message));
    const scope = dir !== null && dir !== undefined
      ? ` in ${dir}`
      : Array.isArray(dirs) && dirs.length > 0
        ? ` in ${dirs.join(' and ')}`
        : '';
    super(`invalid vendor catalog${scope} (${list.length} error(s)):\n${list.map((message) => `  ${message}`).join('\n')}`);
    this.name = 'CatalogError';
    /** @type {string[]} */
    this.errors = list;
    /** @type {string | null} - directory for a single-directory load. */
    this.dir = dir ?? null;
    /** @type {string[] | null} - directories for a multi-section load. */
    this.dirs = Array.isArray(dirs) ? [...dirs] : null;
  }
}

/**
 * Normalized rate set: per 1,000,000 tokens in the vendor's currency.
 * `cacheWrite` always exists; it defaults to `cacheMiss` when the vendor has no
 * separate cache-write price (SCHEMA.md rule 4).
 *
 * @typedef {Object} NormalizedRateSet
 * @property {number} cacheHit
 * @property {number} cacheMiss
 * @property {number} cacheWrite
 * @property {number} output
 */

/**
 * One context-length tier, ascending by `maxInputTokens`.
 *
 * @typedef {Object} NormalizedTier
 * @property {number} maxInputTokens - inclusive upper bound of the request's prompt tokens
 * @property {NormalizedRateSet} rates
 */

/**
 * Normalized model price entry.
 *
 * @typedef {Object} NormalizedModelPrice
 * @property {string} id - the exact wire model id, trimmed
 * @property {string} name - display name
 * @property {string[]} aliases - other exact ids billed at the same price (always present)
 * @property {string[]} [matchPrefixes] - documented snapshot prefixes billed at this price
 * @property {NormalizedRateSet} [rates] - flat price; present when the model is not tiered
 * @property {NormalizedTier[]} [tiers] - context-length tiers; present when the model is tiered
 * @property {number} [offPeakMultiplier] - per-model override of the vendor band
 * @property {number[][]} [peakWindows] - per-model override of the vendor windows
 * @property {string} [notes] - one short user-facing note
 */

/**
 * Normalized vendor time-band descriptor. Extra vendor-specific fields are not
 * kept in the normalized catalog, but the lookup passes them through when a
 * runtime vendor object carries them (e.g. the DeepSeek synthetic vendor).
 *
 * @typedef {Object} NormalizedBilling
 * @property {number[][]} windows - `[startMinute, endMinute)` local wall clock
 * @property {number} offPeakMultiplier
 * @property {number[]} weekdays - 0=Sunday..6=Saturday; defaults to [1,2,3,4,5]
 * @property {string[]} holidays - `YYYY-MM-DD`; defaults to []
 */

/**
 * Normalized vendor catalog, in the shape `createLookup()` and the Host fold
 * consume. Display names, source, asOf and currency are kept as published.
 *
 * @typedef {Object} NormalizedVendorCatalog
 * @property {string} vendor - stable kebab-case vendor id
 * @property {string} name - Chinese or English display name (as published)
 * @property {string} nameEn - English display name
 * @property {{ code: 'CNY' | 'USD', symbol: string }} currency
 * @property {string} source - official pricing page URL
 * @property {string} asOf - `YYYY-MM-DD` the prices were read
 * @property {string[]} providers - best-effort provider ids routing to this vendor
 * @property {NormalizedBilling} [billing] - omitted for flat-price vendors
 * @property {NormalizedModelPrice[]} models
 */

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function nonEmptyStrings(value) {
  return (Array.isArray(value) ? value : [])
    .map(trimString)
    .filter((entry) => typeof entry === 'string' && entry !== '');
}

/**
 * @param {Object} rates - declared rate set.
 * @returns {NormalizedRateSet}
 */
function normalizeRateSet(rates) {
  const cacheMiss = rates.cacheMiss;
  return {
    cacheHit: rates.cacheHit,
    cacheMiss,
    cacheWrite: rates.cacheWrite ?? cacheMiss,
    output: rates.output,
  };
}

/**
 * @param {Object} tier - declared tier.
 * @returns {NormalizedTier}
 */
function normalizeTier(tier) {
  return {
    maxInputTokens: tier.maxInputTokens,
    rates: normalizeRateSet(isPlainObject(tier.rates) ? tier.rates : {}),
  };
}

/**
 * @param {Object} model - declared model entry.
 * @returns {NormalizedModelPrice}
 */
function normalizeModel(model) {
  /** @type {NormalizedModelPrice} */
  const normalized = {
    id: trimString(model.id),
    name: trimString(model.name),
    aliases: nonEmptyStrings(model.aliases),
  };
  const matchPrefixes = nonEmptyStrings(model.matchPrefixes);
  if (matchPrefixes.length > 0) normalized.matchPrefixes = matchPrefixes;
  if (Array.isArray(model.tiers) && model.tiers.length > 0) {
    normalized.tiers = model.tiers.filter(isPlainObject).map(normalizeTier);
  } else if (isPlainObject(model.rates)) {
    normalized.rates = normalizeRateSet(model.rates);
  }
  if (typeof model.offPeakMultiplier === 'number') normalized.offPeakMultiplier = model.offPeakMultiplier;
  if (Array.isArray(model.peakWindows)) normalized.peakWindows = model.peakWindows.map((window) => [window[0], window[1]]);
  if (typeof model.notes === 'string' && model.notes.trim() !== '') normalized.notes = model.notes.trim();
  return normalized;
}

/**
 * @param {Object} billing - declared billing block.
 * @returns {NormalizedBilling}
 */
function normalizeBilling(billing) {
  return {
    windows: (Array.isArray(billing.windows) ? billing.windows : []).map((window) => [window[0], window[1]]),
    offPeakMultiplier: typeof billing.offPeakMultiplier === 'number' ? billing.offPeakMultiplier : 1,
    weekdays: Array.isArray(billing.weekdays) && billing.weekdays.length > 0 ? [...billing.weekdays] : [1, 2, 3, 4, 5],
    holidays: Array.isArray(billing.holidays) ? [...billing.holidays] : [],
  };
}

/**
 * Normalize one *already validated* vendor data object: trim strings, expand
 * the documented defaults (`cacheWrite`, billing `weekdays`/`holidays`) and keep
 * the published display metadata (including the declared `currency`) untouched.
 *
 * Exported so the Host can normalize a synthetic vendor entry (the DeepSeek one
 * built from `pricing.js`) with exactly the same rules. Invalid data is the
 * caller's responsibility: `loadCatalog()` validates before calling this.
 *
 * @param {Object} data - a schema-shaped VendorCatalog object.
 * @returns {NormalizedVendorCatalog}
 */
export function normalizeVendor(data) {
  const currency = isPlainObject(data.currency) ? data.currency : {};
  /** @type {NormalizedVendorCatalog} */
  const vendor = {
    vendor: trimString(data.vendor),
    name: trimString(data.name),
    nameEn: trimString(data.nameEn),
    currency: { code: trimString(currency.code), symbol: trimString(currency.symbol) },
    source: trimString(data.source),
    asOf: trimString(data.asOf),
    providers: nonEmptyStrings(data.providers),
    models: (Array.isArray(data.models) ? data.models : []).filter(isPlainObject).map(normalizeModel),
  };
  if (isPlainObject(data.billing)) vendor.billing = normalizeBilling(data.billing);
  return vendor;
}

/**
 * Load, validate and normalize an explicit ordered list of catalog sections.
 *
 * `loadCatalog()` is built on this helper. Each section is
 * `{ dir, id?, currency?, optional? }`; labels in error messages are prefixed
 * with `id` when present. Useful for tests and for alternate catalog layouts.
 *
 * @param {Array<{ dir: string, id?: string, currency?: 'CNY' | 'USD' | null, optional?: boolean }>} sections
 * @param {{ minVendors?: number }} [options]
 * @returns {NormalizedVendorCatalog[]}
 * @throws {CatalogError} listing every invalid file across the sections.
 */
export function loadCatalogSections(sections, { minVendors = 0 } = {}) {
  const catalog = readCatalogsSync(sections);
  const dirs = catalog.sections.map((section) => section.dir);
  if (catalog.errors.length > 0) throw new CatalogError(catalog.errors, { dirs });
  if (catalog.vendors.length < minVendors) {
    throw new CatalogError([`expected at least ${minVendors} vendor catalog(s), found ${catalog.vendors.length}`], { dirs });
  }
  return catalog.vendors.map(({ data }) => normalizeVendor(data));
}

/**
 * Load, validate and normalize the curated vendor catalogs.
 *
 * With no arguments this loads both sections synchronously: `catalog/china`
 * (CNY vendors) first, then `catalog/world` (USD vendors), each in stable
 * alphabetical file order. `_`-prefixed files are ignored. An empty or partial
 * world directory is not an error — the catalog may still be under construction
 * — so only the China vendors are returned when no world vendor exists yet, and
 * any file that *is* present must be valid. Pass `minVendors` to opt into a
 * stricter expectation once the data is complete.
 *
 * With `{ dir }`, only that directory is loaded; the expected currency is
 * inferred for the curated directories (China → CNY, world → USD) and any
 * custom directory may hold either supported currency.
 *
 * @param {object} [options]
 * @param {string} [options.dir] - load a single vendor directory instead of both sections.
 * @param {number} [options.minVendors] - throw unless at least this many vendors load.
 * @returns {NormalizedVendorCatalog[]} validated and normalized vendors, in load order.
 * @throws {CatalogError} listing every invalid file (or the unmet `minVendors`).
 */
export function loadCatalog(options = {}) {
  const { dir, minVendors = 0 } = isPlainObject(options) ? options : {};
  if (dir !== undefined && dir !== null) {
    let catalog;
    try {
      catalog = readVendorCatalogSync(dir);
    } catch (error) {
      throw new CatalogError([`cannot read vendor directory: ${error.message}`], { dir });
    }
    if (catalog.errors.length > 0) throw new CatalogError(catalog.errors, { dir });
    if (catalog.vendors.length < minVendors) {
      throw new CatalogError([`expected at least ${minVendors} vendor catalog(s), found ${catalog.vendors.length}`], { dir });
    }
    return catalog.vendors.map(({ data }) => normalizeVendor(data));
  }
  return loadCatalogSections(CATALOG_SECTIONS, { minVendors });
}
