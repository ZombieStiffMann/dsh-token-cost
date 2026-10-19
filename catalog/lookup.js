/**
 * Dependency-free price lookup engine over a list of normalized vendor
 * catalogs (`loadCatalog()` output plus any synthetic entry such as the
 * DeepSeek vendor built from `pricing.js`).
 *
 * `createLookup(vendors)` returns a resolver. Matching is deliberately ordered
 * and case-insensitive, so an explicit provider mapping always wins over a
 * coincidental model-id collision:
 *
 *   1. exact model id within a vendor whose `providers` contains the route's
 *      provider (case-insensitive);
 *   2. exact model id across all vendors, in catalog order;
 *   3. exact alias across all vendors, in catalog order;
 *   4. documented `matchPrefixes` (e.g. dated snapshot ids); the longest
 *      matching prefix wins, ties go to the earlier catalog entry;
 *   5. otherwise `null`: the route is unpriced and the caller must not invent a
 *      price.
 *
 * The result carries the rates selected for the request's prompt size (the
 * smallest tier bound that covers `promptTokens`, i.e. the first tier in the
 * documented ascending order, else the largest tier), the vendor's currency and
 * time-band descriptor. Everything is a fresh plain object; the input catalogs
 * are never mutated.
 *
 * This module is pure: no filesystem, no network, no import-time side effects.
 *
 * @module catalog/lookup
 */
import { isPlainObject } from './validate.js';

/**
 * @typedef {Object} LookupRateSet
 * @property {number} cacheHit - price per 1,000,000 cache-hit input tokens
 * @property {number} cacheMiss - price per 1,000,000 uncached input tokens
 * @property {number} cacheWrite - price per 1,000,000 cache-write tokens (defaults to cacheMiss)
 * @property {number} output - price per 1,000,000 output tokens
 */

/**
 * Time-band descriptor of the matched vendor, normalized with the documented
 * defaults. Vendor-specific fields present on the input billing object (for
 * example the DeepSeek synthetic vendor's `timeZoneOffsetMinutes` and prebuilt
 * `holidaySet`) are passed through unchanged so the Host fold can compute
 * peak/off-peak cost without rebuilding them.
 *
 * @typedef {Object} LookupBilling
 * @property {number[][]} windows - `[startMinute, endMinute)` local wall clock
 * @property {number} offPeakMultiplier
 * @property {number[]} weekdays - 0=Sunday..6=Saturday (defaults to [1,2,3,4,5])
 * @property {string[]} holidays - `YYYY-MM-DD` (defaults to [])
 */

/**
 * One resolved price. `tier` is `null` for flat-price models; `billing` is
 * `null` for flat-price (time-band-free) vendors.
 *
 * @typedef {Object} LookupResult
 * @property {string | null} vendor - vendor id
 * @property {string | null} vendorName - vendor display name
 * @property {{ code: string, symbol: string }} currency
 * @property {string | null} source - official pricing page URL
 * @property {string | null} asOf - `YYYY-MM-DD` the prices were read
 * @property {{ id: string, name: string, notes?: string }} model
 * @property {LookupRateSet} rates - rates selected for `promptTokens` when tiered
 * @property {{ maxInputTokens: number } | null} tier - chosen tier, if tiered
 * @property {LookupBilling | null} billing - vendor time bands, if any
 */

/**
 * @typedef {Object} LookupQuery
 * @property {string} [provider] - route provider id; skipped when empty
 * @property {string} model - route model id (case-insensitive)
 * @property {number} [promptTokens] - prompt size used to select a context-length tier
 */

function lowerString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function lowerStrings(value) {
  return (Array.isArray(value) ? value : [])
    .map(lowerString)
    .filter((entry) => entry !== '');
}

/** Normalize a rate set, defaulting `cacheWrite` to `cacheMiss`. */
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
 * Normalize the vendor's `billing` block with the documented defaults while
 * keeping any extra fields (`timeZoneOffsetMinutes`, `holidaySet`, ...). Arrays
 * are copied so callers cannot mutate the catalog through a result.
 *
 * @param {unknown} billing
 * @returns {LookupBilling | null}
 */
function normalizeBilling(billing) {
  if (!isPlainObject(billing)) return null;
  return {
    ...billing,
    windows: (Array.isArray(billing.windows) ? billing.windows : []).map((window) => [window[0], window[1]]),
    offPeakMultiplier: typeof billing.offPeakMultiplier === 'number' ? billing.offPeakMultiplier : 1,
    weekdays: Array.isArray(billing.weekdays) && billing.weekdays.length > 0 ? [...billing.weekdays] : [1, 2, 3, 4, 5],
    holidays: Array.isArray(billing.holidays) ? [...billing.holidays] : [],
  };
}

/**
 * Pick the context-length tier that applies to a request.
 *
 * The first tier (ascending by `maxInputTokens`) whose bound is `>= promptTokens`
 * wins; if a hand-edited file lists the tiers out of order, the smallest
 * covering bound still wins. A request larger than every published bound falls
 * back to the largest tier. A missing/invalid `promptTokens` is treated as the
 * smallest request, so the first (cheapest) tier applies; `Infinity` selects the
 * largest tier.
 * @param {Object | null | undefined} model - model entry with optional `tiers`.
 * @param {number} [promptTokens]
 * @returns {Object | null} the chosen tier, or `null` when the model is not tiered.
 */
export function selectTier(model, promptTokens) {
  const tiers = Array.isArray(model?.tiers) ? model.tiers.filter(isPlainObject) : [];
  if (tiers.length === 0) return null;
  let tokens = 0;
  if (typeof promptTokens === 'number' && !Number.isNaN(promptTokens) && promptTokens > 0) tokens = promptTokens;
  // The documented order is ascending, in which case this is the first tier that
  // covers the request; picking the smallest bound by value keeps the result
  // deterministic even if a hand-edited file ever lists the tiers out of order.
  let chosen = null;
  for (const tier of tiers) {
    if (typeof tier.maxInputTokens !== 'number' || tier.maxInputTokens < tokens) continue;
    if (chosen === null || tier.maxInputTokens < chosen.maxInputTokens) chosen = tier;
  }
  if (chosen !== null) return chosen;
  let largest = tiers[0];
  for (const tier of tiers) {
    if (typeof tier.maxInputTokens === 'number' && typeof largest.maxInputTokens === 'number' && tier.maxInputTokens > largest.maxInputTokens) largest = tier;
  }
  return largest;
}

/**
 * Build one result object from a matched (vendor, model) pair.
 *
 * @param {{ vendor: Object, model: Object }} entry
 * @param {number} [promptTokens]
 * @returns {LookupResult | null} `null` when the entry has no usable rate set.
 */
function buildResult(entry, promptTokens) {
  const { vendor, model } = entry;
  const tier = selectTier(model, promptTokens);
  const rateSet = isPlainObject(tier?.rates ?? null)
    ? tier.rates
    : isPlainObject(model.rates)
      ? model.rates
      : null;
  if (rateSet === null) return null;
  const currency = isPlainObject(model.currency)
    ? model.currency
    : isPlainObject(vendor.currency)
      ? vendor.currency
      : { code: 'CNY', symbol: '¥' };
  const source = model.source ?? vendor.source;
  const asOf = model.asOf ?? vendor.asOf;
  /** @type {{ id: string, name: string, notes?: string }} */
  const modelResult = {
    id: model.id,
    name: typeof model.name === 'string' && model.name !== '' ? model.name : model.id,
  };
  if (typeof model.notes === 'string' && model.notes !== '') modelResult.notes = model.notes;
  return {
    vendor: typeof vendor.vendor === 'string' ? vendor.vendor : null,
    vendorName: typeof vendor.name === 'string' ? vendor.name : typeof vendor.nameEn === 'string' ? vendor.nameEn : null,
    currency: { code: currency.code, symbol: currency.symbol },
    source: typeof source === 'string' ? source : null,
    asOf: typeof asOf === 'string' ? asOf : null,
    model: modelResult,
    rates: normalizeRateSet(rateSet),
    tier: tier === null ? null : { maxInputTokens: tier.maxInputTokens },
    billing: normalizeBilling(vendor.billing),
  };
}

/**
 * Flatten every model of every vendor into one ordered list. Intended for
 * diagnostics and tests (e.g. asserting catalog contents); it performs no
 * matching and no validation.
 *
 * @param {Object[]} vendors - normalized (or schema-shaped) vendor catalogs.
 * @returns {Array<{
 *   vendor: string | null,
 *   vendorName: string | null,
 *   id: string | null,
 *   name: string | null,
 *   aliases: string[],
 *   matchPrefixes: string[],
 *   tierCount: number,
 * }>}
 */
export function listModels(vendors) {
  const list = [];
  for (const vendor of Array.isArray(vendors) ? vendors : []) {
    if (!isPlainObject(vendor)) continue;
    for (const model of Array.isArray(vendor.models) ? vendor.models : []) {
      if (!isPlainObject(model)) continue;
      list.push({
        vendor: typeof vendor.vendor === 'string' ? vendor.vendor : null,
        vendorName: typeof vendor.name === 'string' ? vendor.name : null,
        id: typeof model.id === 'string' ? model.id : null,
        name: typeof model.name === 'string' ? model.name : null,
        aliases: Array.isArray(model.aliases) ? [...model.aliases] : [],
        matchPrefixes: Array.isArray(model.matchPrefixes) ? [...model.matchPrefixes] : [],
        tierCount: Array.isArray(model.tiers) ? model.tiers.filter(isPlainObject).length : 0,
      });
    }
  }
  return list;
}

/**
 * Build the price resolver for a vendor list.
 *
 * The vendors should be normalized catalogs, but the matcher only reads
 * `vendor`/`name`/`nameEn`/`currency`/`source`/`asOf`/`providers`/`billing` and
 * `model.id`/`name`/`aliases`/`matchPrefixes`/`rates`/`tiers`, so schema-shaped
 * objects (and the Host's synthetic DeepSeek vendor) work as-is. No validation
 * happens here; `loadCatalog()` validates curated data before this.
 *
 * @param {Object[]} vendors - vendor catalogs, in lookup-priority order.
 * @returns {((query: LookupQuery) => LookupResult | null) & {
 *   resolve: (query: LookupQuery) => LookupResult | null,
 *   listModels: () => ReturnType<typeof listModels>,
 * }} the resolver (callable directly or via `.resolve`), with
 *   `.listModels()` bound to the same vendor list.
 */
export function createLookup(vendors = []) {
  const list = Array.isArray(vendors) ? vendors : [];
  /** @type {Array<{ vendor: Object, model: Object, idKey: string, aliasKeys: string[], prefixKeys: string[] }>} */
  const entries = [];
  /** @type {Map<string, typeof entries>} */
  const byProvider = new Map();

  for (const vendor of list) {
    if (!isPlainObject(vendor)) continue;
    const providers = lowerStrings(vendor.providers);
    for (const model of Array.isArray(vendor.models) ? vendor.models : []) {
      if (!isPlainObject(model) || typeof model.id !== 'string' || model.id.trim() === '') continue;
      const entry = {
        vendor,
        model,
        idKey: model.id.trim().toLowerCase(),
        aliasKeys: lowerStrings(model.aliases),
        prefixKeys: lowerStrings(model.matchPrefixes),
      };
      entries.push(entry);
      for (const provider of providers) {
        let scoped = byProvider.get(provider);
        if (scoped === undefined) byProvider.set(provider, (scoped = []));
        scoped.push(entry);
      }
    }
  }

  /** @param {unknown} query @returns {LookupResult | null} */
  function resolve(query) {
    if (!isPlainObject(query)) return null;
    const modelKey = lowerString(query.model);
    if (modelKey === '') return null;
    const promptTokens = typeof query.promptTokens === 'number' ? query.promptTokens : undefined;

    const providerKey = lowerString(query.provider);
    if (providerKey !== '') {
      const scoped = byProvider.get(providerKey) ?? [];
      for (const entry of scoped) {
        if (entry.idKey !== modelKey) continue;
        const match = buildResult(entry, promptTokens);
        if (match !== null) return match;
      }
    }

    for (const entry of entries) {
      if (entry.idKey !== modelKey) continue;
      const match = buildResult(entry, promptTokens);
      if (match !== null) return match;
    }

    for (const entry of entries) {
      if (!entry.aliasKeys.includes(modelKey)) continue;
      const match = buildResult(entry, promptTokens);
      if (match !== null) return match;
    }

    let best = null;
    let bestLength = 0;
    for (const entry of entries) {
      for (const prefix of entry.prefixKeys) {
        if (prefix.length <= bestLength || !modelKey.startsWith(prefix)) continue;
        best = entry;
        bestLength = prefix.length;
      }
    }
    if (best === null) return null;
    return buildResult(best, promptTokens);
  }

  resolve.resolve = resolve;
  resolve.listModels = () => listModels(list);
  return resolve;
}
