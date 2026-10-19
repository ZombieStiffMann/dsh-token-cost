/**
 * Runtime price catalog for the `tokenCost` projection.
 *
 * Combines three price sources into one lookup:
 *   1. the built-in + refreshed DeepSeek official catalog (pricing.js),
 *   2. the curated China vendor catalogs (catalog/china/*.js),
 *   3. user overrides from the plugin row config (`config.models` /
 *      `config.aliases` / `config.fallbackModel`), which win over 1 and 2.
 *
 * The result is a small `{ resolve }` object the fold calls once per usage
 * sample. `resolve` returns the effective rates (tier-selected when the model
 * uses context-length tiers), the vendor's currency and time-band billing data,
 * or null when the route is unpriced.
 */
import { createLookup } from './catalog/lookup.js';
import { DEFAULT_TIME_ZONE_OFFSET_MINUTES, deepseekBilling, normalizePricing } from './pricing.js';

const RATE_KEYS = ['cacheHit', 'cacheMiss', 'cacheWrite', 'output'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** DeepSeek's vendor entry in the same normalized shape the China catalogs use. */
export function deepseekVendorFromPricing(pricing) {
  const billing = deepseekBilling(pricing);
  const models = Object.entries(pricing.models).map(([id, entry]) => ({
    id,
    name: entry.name ?? id,
    aliases: [],
    rates: {
      cacheMiss: entry.rates.cacheMiss,
      cacheHit: entry.rates.cacheHit,
      cacheWrite: isFiniteNonNegative(entry.rates.cacheWrite) ? entry.rates.cacheWrite : entry.rates.cacheMiss,
      output: entry.rates.output,
    },
  }));
  return {
    vendor: 'deepseek',
    name: 'DeepSeek',
    nameEn: 'DeepSeek',
    currency: { code: 'CNY', symbol: '¥' },
    source: pricing.source,
    asOf: pricing.asOf,
    providers: ['deepseek-official', 'deepseek-account', 'deepseek'],
    billing: { ...billing, holidaySet: new Set(billing.holidays) },
    models,
  };
}

/** Normalize one user-supplied model override into a catalog model entry. */
function normalizeOverrideModel(id, raw, base) {
  const entry = isPlainObject(raw) ? raw : {};
  const rates = isPlainObject(entry.rates) ? entry.rates : null;
  const tiers = Array.isArray(entry.tiers) ? entry.tiers : null;
  if (rates !== null && tiers !== null) return null;
  const name = typeof entry.name === 'string' && entry.name !== '' ? entry.name : base?.name ?? id;

  const normalizeRates = (candidate, inherited) => {
    const out = inherited !== undefined ? { ...inherited } : null;
    const result = out ?? {};
    if (out === null) {
      for (const key of ['cacheMiss', 'cacheHit', 'output']) {
        const value = candidate?.[key];
        if (!isFiniteNonNegative(value) || (key !== 'cacheHit' && value <= 0)) return null;
        result[key] = value;
      }
      const cacheWrite = candidate?.cacheWrite;
      result.cacheWrite = isFiniteNonNegative(cacheWrite) ? cacheWrite : result.cacheMiss;
      return result;
    }
    for (const key of RATE_KEYS) {
      const value = candidate?.[key];
      if (value === undefined) continue;
      if (!isFiniteNonNegative(value)) return null;
      out[key] = value;
    }
    if (!isFiniteNonNegative(out.cacheWrite)) out.cacheWrite = out.cacheMiss;
    return out;
  };

  let normalizedRates = null;
  let normalizedTiers = null;
  if (tiers !== null) {
    normalizedTiers = [];
    let previous = 0;
    for (const tier of tiers) {
      if (!isPlainObject(tier) || !Number.isSafeInteger(tier.maxInputTokens) || tier.maxInputTokens <= previous) return null;
      previous = tier.maxInputTokens;
      const tierRates = normalizeRates(tier.rates, undefined);
      if (tierRates === null) return null;
      normalizedTiers.push({ maxInputTokens: tier.maxInputTokens, rates: tierRates });
    }
  } else {
    normalizedRates = normalizeRates(rates, base?.rates);
    if (normalizedRates === null) return null;
  }

  const currency = isPlainObject(entry.currency) && typeof entry.currency.code === 'string' && entry.currency.code !== ''
    ? { code: entry.currency.code, symbol: typeof entry.currency.symbol === 'string' && entry.currency.symbol !== '' ? entry.currency.symbol : entry.currency.code }
    : base?.currency ?? { code: 'CNY', symbol: '¥' };
  return {
    id,
    name,
    aliases: Array.isArray(base?.aliases) ? [...base.aliases] : [],
    ...(base?.matchPrefixes === undefined ? {} : { matchPrefixes: [...base.matchPrefixes] }),
    ...(normalizedTiers === null ? { rates: normalizedRates } : { tiers: normalizedTiers }),
    source: typeof entry.source === 'string' && entry.source !== '' ? entry.source : base?.source,
    asOf: typeof entry.asOf === 'string' && entry.asOf !== '' ? entry.asOf : base?.asOf,
    currency,
  };
}

/** Apply `config.models` overrides to the vendor list, mutating copies only. */
function applyUserModels(vendors, userConfig) {
  if (!isPlainObject(userConfig.models)) return vendors;
  const overrides = Object.entries(userConfig.models).filter(([id, entry]) => typeof id === 'string' && id !== '' && isPlainObject(entry));
  if (overrides.length === 0) return vendors;
  const result = vendors.map((vendor) => ({
    ...vendor,
    models: vendor.models.map((model) => ({ ...model, rates: model.rates === undefined ? undefined : { ...model.rates }, aliases: [...(model.aliases ?? [])] })),
  }));
  const customModels = [];
  for (const [rawId, rawEntry] of overrides) {
    const id = rawId.trim();
    const lower = id.toLowerCase();
    let patched = false;
    for (const vendor of result) {
      const index = vendor.models.findIndex((model) => model.id.toLowerCase() === lower || (model.aliases ?? []).some((alias) => alias.toLowerCase() === lower));
      if (index < 0) continue;
      const base = vendor.models[index];
      const normalized = normalizeOverrideModel(base.id, rawEntry, { ...base, source: vendor.source, asOf: vendor.asOf, currency: vendor.currency });
      if (normalized === null) continue;
      vendor.models[index] = { ...normalized, id: base.id, name: normalized.name };
      if (typeof rawEntry.source === 'string' && rawEntry.source !== '') vendor.source = rawEntry.source;
      if (typeof rawEntry.asOf === 'string' && rawEntry.asOf !== '') vendor.asOf = rawEntry.asOf;
      patched = true;
      break;
    }
    if (patched) continue;
    const normalized = normalizeOverrideModel(id, rawEntry, undefined);
    if (normalized !== null) customModels.push(normalized);
  }
  if (customModels.length > 0) {
    // One synthetic vendor per currency, so a custom USD model never inherits
    // the CNY symbol of a custom CNY model.
    const groups = new Map();
    for (const model of customModels) {
      const code = model.currency?.code ?? 'CNY';
      const list = groups.get(code) ?? [];
      list.push(model);
      groups.set(code, list);
    }
    let first = true;
    for (const [code, models] of groups) {
      const sample = models[0];
      const vendorId = first ? 'custom' : `custom-${code.toLowerCase()}`;
      result.push({
        vendor: vendorId,
        name: '自定义',
        nameEn: 'Custom',
        currency: { code, symbol: sample.currency?.symbol ?? code },
        source: typeof userConfig.source === 'string' ? userConfig.source : '',
        asOf: typeof userConfig.asOf === 'string' ? userConfig.asOf : '',
        providers: [],
        models,
      });
      first = false;
    }
  }
  return result;
}

/** Resolve one model id through the global alias table, with a bounded chain. */
function canonicalId(aliases, model) {
  let current = model;
  for (let hop = 0; hop < 4; hop += 1) {
    if (typeof current !== 'string') return current;
    const next = aliases[current] ?? aliases[current.toLowerCase()];
    if (typeof next !== 'string' || next === current) return current;
    current = next;
  }
  return current;
}

/**
 * Build the runtime catalog.
 *
 * @param {object} options
 * @param {ReturnType<typeof normalizePricing>} options.deepseekPricing - resolved DeepSeek catalog.
 * @param {Array} [options.chinaVendors] - normalized `loadCatalog()` output.
 * @param {object} [options.userConfig] - plugin row config.
 */
export function buildCostCatalog({ deepseekPricing, chinaVendors = [], userConfig = {} }) {
  const aliases = {
    ...(isPlainObject(deepseekPricing.aliases) ? deepseekPricing.aliases : {}),
    ...(isPlainObject(userConfig.aliases) ? userConfig.aliases : {}),
  };
  const fallbackModel = typeof userConfig.fallbackModel === 'string' && userConfig.fallbackModel !== '' ? userConfig.fallbackModel : null;
  const vendors = applyUserModels([deepseekVendorFromPricing(deepseekPricing), ...chinaVendors], userConfig);
  for (const vendor of vendors) {
    if (vendor.billing !== undefined && vendor.billing !== null && vendor.billing.holidaySet === undefined) {
      vendor.billing = { ...vendor.billing, holidaySet: new Set(Array.isArray(vendor.billing.holidays) ? vendor.billing.holidays : []) };
    }
  }
  const lookup = createLookup(vendors);
  const resolve = ({ provider, model, promptTokens }) => {
    const canonical = canonicalId(aliases, model);
    const match = lookup.resolve({ provider, model: canonical, promptTokens });
    if (match !== null) return match;
    if (fallbackModel !== null) {
      const fallback = canonicalId(aliases, fallbackModel);
      if (fallback !== canonical) return lookup.resolve({ provider, model: fallback, promptTokens });
    }
    return null;
  };
  return {
    vendors,
    aliases,
    fallbackModel,
    resolve,
    /** Vendor metadata used by the view to link official price pages. */
    vendorOf(vendorId) {
      return vendors.find((vendor) => vendor.vendor === vendorId) ?? null;
    },
    /** Time zone a vendor's wall clock is stated in. */
    timeZoneOf(vendorId) {
      const vendor = vendors.find((entry) => entry.vendor === vendorId);
      return vendor?.billing?.timeZoneOffsetMinutes ?? DEFAULT_TIME_ZONE_OFFSET_MINUTES;
    },
  };
}
