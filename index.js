/**
 * Host half of `dsh-token-cost`.
 *
 * Registers one session projection (`tokenCost`) that folds every durable
 * provider-reported token-usage sample of a session into an estimated cost:
 *
 *   cost(sample) = tokens x official unit rate x time-band multiplier
 *
 * Prices come from `cost-catalog.js`: the built-in + background-refreshed
 * DeepSeek official catalog, the curated China vendor catalogs under
 * `catalog/china/`, and optional user overrides from the plugin row config.
 * Each sample is priced with the vendor price and currency that match its route;
 * vendors with official time bands (DeepSeek) apply the band of the sample's own
 * timestamp, while flat-price vendors use their single published price.
 *
 * Usage samples are folded with the same replacement rules as the shipped
 * `tokenUsage` projection: a later sample of the same Turn/Step replaces the
 * earlier one, and `llm/retry-started` closes the replacement slot so a retried
 * attempt is billed separately.
 *
 * The wire view is the complete client-facing value: per-currency totals plus a
 * per-model breakdown (cost, token buckets, band split, official source link).
 */
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadCatalog } from './catalog/index.js';
import { buildCostCatalog } from './cost-catalog.js';
import { OFFICIAL_PRICE_URL, parseOfficialPricingPage } from './official-pricing.js';
import { DEFAULT_PRICING, isPeakForBilling, normalizePricing } from './pricing.js';

/** Projection key read by the client half. */
export const PROJECTION_KEY = 'tokenCost';

/** Bump whenever the fold state fields or their semantics change. */
const STATE_VERSION = 2;

/**
 * The projection registry and its checkpoint cache only ever call `parse()` on
 * a schema. These pass-through stand-ins keep the bundle dependency-free and
 * make the JSON validation boundary explicit.
 */
const JSON_SCHEMA = { parse: (value) => value };

/** Cost buckets of a usage sample and the catalog rate that prices each one. */
const BUCKET_RATES = {
  input: 'cacheMiss',
  cacheRead: 'cacheHit',
  cacheWrite: 'cacheWrite',
  output: 'output',
};
/** Cost-bucket keys in display and fold order. */
const BUCKETS = Object.keys(BUCKET_RATES);

function isCount(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function zeroTokens() {
  return { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 };
}

function zeroMicros() {
  return { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
}

function totalTokens(tokens) {
  return tokens.input + tokens.cacheRead + tokens.cacheWrite + tokens.output;
}

//#region event helpers
/**
 * The provider usage of one usage-bearing event, mirroring the shipped
 * token-meter fold: an `assistant/message` may carry `usage` directly, and both
 * `assistant/message` and `assistant/attempt` embed the provider stream whose
 * last `usage` chunk is authoritative when the event-level field is absent.
 */
function usageOf(event) {
  if (event.type === 'assistant/message' && isPlainObject(event.data) && event.data.usage !== undefined) {
    return event.data.usage;
  }
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return undefined;
  return lastStreamUsage(event.data?.stream);
}

/** Last provider `usage` chunk embedded in an assistant stream record list. */
function lastStreamUsage(stream) {
  if (!Array.isArray(stream)) return undefined;
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index];
    if (isPlainObject(record) && record.type === 'chunk' && isPlainObject(record.chunk) && record.chunk.type === 'usage') {
      return record.chunk.usage;
    }
  }
  return undefined;
}

/**
 * Normalize a provider usage record into the four disjoint billing buckets plus
 * reasoning (already contained in output). Mirrors the shipped guards: invalid
 * counts make the whole sample unbillable instead of guessing.
 */
function normalizeUsage(usage) {
  if (!isPlainObject(usage)) return null;
  const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens } = usage;
  if (!isCount(inputTokens) || !isCount(outputTokens)) return null;
  const cacheRead = cacheReadTokens === undefined ? 0 : cacheReadTokens;
  const cacheWrite = cacheWriteTokens === undefined ? 0 : cacheWriteTokens;
  const reasoning = reasoningTokens === undefined ? 0 : reasoningTokens;
  if (!isCount(cacheRead) || !isCount(cacheWrite) || !isCount(reasoning)) return null;
  if (reasoning > outputTokens) return null;
  return { input: inputTokens, cacheRead, cacheWrite, output: outputTokens, reasoning };
}

/** Route recorded on a settled Assistant message, when present. */
function routeOf(event) {
  if (event.type !== 'assistant/message') return null;
  const source = event.data?.message?.source;
  if (!isPlainObject(source)) return null;
  const { provider, model } = source;
  if (typeof provider !== 'string' || provider === '' || typeof model !== 'string' || model === '') return null;
  return { provider, model };
}
//#endregion

//#region pricing contributions
/**
 * Build one sample's priced contribution. `micro` is the amount in
 * micro-currency units (tokens x price-per-1M-tokens = micro-currency, since
 * one currency unit is 1e6 micro units).
 */
function pricedContribution(tokens, route, timeMs, match) {
  const banded = match.billing !== null && match.billing !== undefined;
  const holidaySet = banded ? match.billing.holidaySet ?? new Set(match.billing.holidays ?? []) : null;
  const peak = banded && holidaySet !== null ? isPeakForBilling(match.billing, timeMs, holidaySet) : false;
  const multiplier = banded && !peak ? match.billing.offPeakMultiplier : 1;
  const micros = zeroMicros();
  let micro = 0;
  let saving = 0;
  for (const bucket of BUCKETS) {
    const rate = match.rates[BUCKET_RATES[bucket]];
    const actual = Math.round(tokens[bucket] * rate * multiplier);
    micros[bucket] = actual;
    micro += actual;
    if (banded) saving += Math.round(tokens[bucket] * rate) - actual;
  }
  return {
    priced: true,
    provider: route.provider,
    model: route.model,
    name: match.model?.name ?? route.model,
    vendor: match.vendor,
    vendorName: match.vendorName,
    currency: { code: match.currency.code, symbol: match.currency.symbol },
    source: match.source ?? null,
    asOf: match.asOf ?? null,
    tier: match.tier ?? null,
    banded,
    peak,
    tokens,
    micros,
    micro,
    saving,
    peakMicro: banded && peak ? micro : 0,
    offPeakMicro: banded && !peak ? micro : 0,
    time: timeMs,
    events: 1,
  };
}

/** Contribution of a route with no catalog price: tokens are counted, cost is not invented. */
function unpricedContribution(tokens, route, timeMs) {
  return {
    priced: false,
    provider: route.provider,
    model: route.model,
    name: route.model,
    vendor: null,
    vendorName: null,
    currency: null,
    source: null,
    asOf: null,
    tier: null,
    banded: false,
    peak: false,
    tokens,
    micros: null,
    micro: 0,
    saving: 0,
    peakMicro: 0,
    offPeakMicro: 0,
    time: timeMs,
    events: 1,
  };
}
//#endregion

//#region fold state
function emptyState() {
  return {
    currencies: {},
    tokens: zeroTokens(),
    models: {},
    events: 0,
    firstTime: null,
    lastTime: null,
    route: null,
    last: null,
  };
}

function modelStateKey(contribution) {
  return `${contribution.provider}\u0000${contribution.model}`;
}

function emptyCurrencyState(code, symbol) {
  return {
    code,
    symbol,
    micro: 0,
    saving: 0,
    tokens: zeroTokens(),
    micros: zeroMicros(),
    peakMicro: 0,
    offPeakMicro: 0,
  };
}

function emptyModelState(contribution) {
  return {
    provider: contribution.provider,
    model: contribution.model,
    name: contribution.name,
    vendor: contribution.vendor,
    vendorName: contribution.vendorName,
    priced: contribution.priced,
    currency: contribution.currency,
    source: contribution.source,
    asOf: contribution.asOf,
    banded: contribution.banded,
    tierMaxInputTokens: contribution.tier === undefined || contribution.tier === null ? null : contribution.tier.maxInputTokens,
    micro: 0,
    micros: contribution.micros === null ? null : zeroMicros(),
    tokens: zeroTokens(),
    peakMicro: 0,
    offPeakMicro: 0,
  };
}

/** Add (sign +1) or remove (sign -1) one contribution; state stays plain JSON. */
function applyContribution(state, contribution, sign) {
  const money = contribution.priced;
  const symbol = contribution.currency === null ? '' : contribution.currency.symbol;
  const code = contribution.currency === null ? '' : contribution.currency.code;

  const tokens = {};
  for (const key of Object.keys(state.tokens)) tokens[key] = state.tokens[key] + sign * contribution.tokens[key];

  let currencies = state.currencies;
  if (money) {
    const previousCurrency = state.currencies[code] ?? emptyCurrencyState(code, symbol);
    const currencyTokens = {};
    for (const key of Object.keys(previousCurrency.tokens)) currencyTokens[key] = previousCurrency.tokens[key] + sign * contribution.tokens[key];
    const currencyMicros = {};
    for (const key of BUCKETS) currencyMicros[key] = previousCurrency.micros[key] + sign * contribution.micros[key];
    const nextCurrency = {
      ...previousCurrency,
      micro: previousCurrency.micro + sign * contribution.micro,
      saving: previousCurrency.saving + sign * contribution.saving,
      tokens: currencyTokens,
      micros: currencyMicros,
      peakMicro: previousCurrency.peakMicro + sign * contribution.peakMicro,
      offPeakMicro: previousCurrency.offPeakMicro + sign * contribution.offPeakMicro,
    };
    currencies = { ...state.currencies, [code]: nextCurrency };
  }

  const key = modelStateKey(contribution);
  const previousModel = state.models[key] ?? emptyModelState(contribution);
  const modelTokens = {};
  for (const name of Object.keys(previousModel.tokens)) modelTokens[name] = previousModel.tokens[name] + sign * contribution.tokens[name];
  const modelMicros = previousModel.micros === null
    ? null
    : (() => {
        const next = {};
        for (const name of BUCKETS) next[name] = previousModel.micros[name] + sign * contribution.micros[name];
        return next;
      })();
  const nextModel = {
    ...previousModel,
    // A later price refresh can change the vendor metadata; the latest sample wins.
    name: contribution.name,
    vendor: contribution.vendor,
    vendorName: contribution.vendorName,
    currency: contribution.currency,
    source: contribution.source,
    asOf: contribution.asOf,
    banded: contribution.banded,
    tierMaxInputTokens: contribution.tier === undefined || contribution.tier === null ? previousModel.tierMaxInputTokens : contribution.tier.maxInputTokens,
    micro: previousModel.micro + sign * contribution.micro,
    micros: modelMicros,
    tokens: modelTokens,
    peakMicro: previousModel.peakMicro + sign * contribution.peakMicro,
    offPeakMicro: previousModel.offPeakMicro + sign * contribution.offPeakMicro,
  };
  const models = { ...state.models, [key]: nextModel };
  if (sign < 0 && nextModel.micro === 0 && totalTokens(modelTokens) === 0 && modelTokens.reasoning === 0) {
    delete models[key];
  }
  return {
    ...state,
    currencies,
    tokens,
    models,
    events: state.events + sign * contribution.events,
    firstTime: sign > 0 && (state.firstTime === null || contribution.time < state.firstTime) ? contribution.time : state.firstTime,
    lastTime: sign > 0 && (state.lastTime === null || contribution.time > state.lastTime) ? contribution.time : state.lastTime,
  };
}

/**
 * The projection fold. Mirrors the shipped `tokenUsage` replacement rules so the
 * cost total and the token pill always describe the same samples.
 */
function applyEvent(state, event, catalog) {
  if (event.type === 'request/header') {
    const config = event.data?.header?.config;
    const provider = config?.provider;
    const model = config?.model;
    if (typeof provider !== 'string' || provider === '' || typeof model !== 'string' || model === '') return state;
    if (state.route !== null && state.route.provider === provider && state.route.model === model) return state;
    return { ...state, route: { provider, model } };
  }

  if (event.type === 'llm/retry-started') {
    // A retried attempt is billed in addition to the previous one: clearing the
    // replacement slot (without touching the totals) makes the next sample add
    // instead of replacing. Same rule as the shipped `tokenUsage` projection.
    const last = state.last;
    if (last === null || last.turn !== event.data?.turn || last.step !== event.data?.step) return state;
    return { ...state, last: null };
  }

  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return state;

  const tokens = normalizeUsage(usageOf(event));
  if (tokens === null) return state;

  const explicitRoute = routeOf(event);
  const route = explicitRoute ?? state.route;
  const turn = event.data?.turn;
  const step = event.data?.step;
  if (!Number.isSafeInteger(turn) || !Number.isSafeInteger(step)) return state;
  const effectiveRoute = route ?? { provider: 'unknown', model: 'unknown' };
  const promptTokens = tokens.input + tokens.cacheRead + tokens.cacheWrite;
  const match = catalog.resolve({ provider: effectiveRoute.provider, model: effectiveRoute.model, promptTokens });
  const contribution = match === null
    ? unpricedContribution(tokens, effectiveRoute, event.time)
    : pricedContribution(tokens, effectiveRoute, event.time, match);

  const previous = state.last !== null && state.last.turn === turn && state.last.step === step ? state.last : null;
  let next = previous === null ? state : applyContribution(state, previous, -1);
  next = applyContribution(next, contribution, 1);
  next.last = { ...contribution, turn, step };
  return next;
}
//#endregion

//#region wire view
function sortedCurrencies(currencies) {
  return Object.values(currencies)
    .filter((currency) => currency.micro !== 0 || totalTokens(currency.tokens) !== 0)
    .sort((left, right) => {
      if (left.micro === right.micro) return left.code < right.code ? -1 : 1;
      return right.micro - left.micro;
    })
    .map((currency) => ({
      code: currency.code,
      symbol: currency.symbol,
      micro: currency.micro,
      tokens: currency.tokens,
      micros: currency.micros,
      peakMicro: currency.peakMicro,
      offPeakMicro: currency.offPeakMicro,
      saving: currency.saving,
    }));
}

function viewModels(models) {
  const list = Object.values(models)
    .filter((model) => model.micro !== 0 || totalTokens(model.tokens) !== 0 || model.tokens.reasoning !== 0)
    .map((model) => ({
      key: `${model.provider}/${model.model}`,
      provider: model.provider,
      model: model.model,
      name: model.name,
      vendor: model.vendor,
      vendorName: model.vendorName,
      // Legacy clients address the old per-vendor rate table by this key.
      pricingKey: model.vendor,
      priced: model.priced,
      currency: model.currency,
      micro: model.micro,
      tokens: model.tokens,
      tokensTotal: totalTokens(model.tokens),
      micros: model.micros,
      peakMicro: model.banded ? model.peakMicro : null,
      offPeakMicro: model.banded ? model.offPeakMicro : null,
      source: model.source,
      asOf: model.asOf,
    }));
  return list.sort((left, right) => {
    if (left.priced !== right.priced) return left.priced ? -1 : 1;
    if (left.micro !== right.micro) return right.micro - left.micro;
    if (right.tokensTotal !== left.tokensTotal) return right.tokensTotal - left.tokensTotal;
    return left.name < right.name ? -1 : 1;
  });
}

/** Client-facing value: complete, JSON-safe and self-describing. */
function buildView(state) {
  const unpricedModels = Object.values(state.models).filter((model) => !model.priced);
  const currencies = sortedCurrencies(state.currencies);
  const models = viewModels(state.models);
  const primary = currencies.find((currency) => currency.code === 'CNY') ?? currencies[0] ?? null;
  const primaryModel = models.find((model) => model.priced && model.source !== null) ?? models.find((model) => model.priced) ?? null;
  return {
    currencies,
    tokens: state.tokens,
    tokensTotal: totalTokens(state.tokens),
    models,
    unpricedModels: [...new Set(unpricedModels.map((model) => model.model))],
    unpricedTokens: unpricedModels.reduce((sum, model) => sum + totalTokens(model.tokens), 0),
    lastUpdated: state.lastTime,
    // Legacy single-currency shape kept for a browser tab still running the
    // previous client build across an upgrade. New clients ignore these fields.
    currency: primary === null ? { code: 'CNY', symbol: '¥' } : { code: primary.code, symbol: primary.symbol },
    micro: primary === null ? 0 : primary.micro,
    micros: primary === null ? zeroMicros() : primary.micros,
    peakMicro: primary === null ? 0 : primary.peakMicro,
    offPeakMicro: primary === null ? 0 : primary.offPeakMicro,
    saving: primary === null ? 0 : primary.saving,
    price: primaryModel === null ? null : { source: primaryModel.source, asOf: primaryModel.asOf, models: {} },
  };
}
//#endregion

//#region projection definition
/**
 * Build the `tokenCost` projection unit for one mutable runtime catalog.
 *
 * @param {{ current: ReturnType<typeof buildCostCatalog> }} catalogRef
 */
export function createCostProjectionDefinition(catalogRef) {
  return {
    key: PROJECTION_KEY,
    stateVersion: STATE_VERSION,
    stateSchema: JSON_SCHEMA,
    init: () => emptyState(),
    apply: (state, event) => applyEvent(state, event, catalogRef.current),
    wire: {
      viewSchema: JSON_SCHEMA,
      view: (state) => buildView(state),
    },
  };
}
//#endregion

//#region plugin lifecycle
/** Cordis service dependency: the session projection registry. */
export const inject = ['sessionProjections'];

/** Default location of the last successfully fetched official-price catalog. */
function defaultCacheFile() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh');
  return join(home, 'storages', 'token-cost-official-prices.json');
}

/** DeepSeek-only knobs that a profile patch may retune. */
function deepseekConfigOf(userConfig) {
  const subset = {};
  for (const key of ['peakWindows', 'offPeakMultiplier', 'additionalHolidays', 'holidays', 'timeZoneOffsetMinutes', 'timeZoneLabel']) {
    if (userConfig[key] !== undefined) subset[key] = userConfig[key];
  }
  return subset;
}

/** Whether a raw JSON object looks like a DeepSeek catalog this module can price with. */
function isCatalogShape(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const models = value.models;
  if (typeof models !== 'object' || models === null || Array.isArray(models) || Object.keys(models).length === 0) return false;
  for (const entry of Object.values(models)) {
    if (typeof entry !== 'object' || entry === null) return false;
    const rates = entry.rates;
    if (typeof rates !== 'object' || rates === null) return false;
    if (![rates.cacheMiss, rates.cacheHit, rates.output].every((rate) => typeof rate === 'number' && Number.isFinite(rate) && rate >= 0)) return false;
    if (entry.offPeakMultiplier !== undefined && !(typeof entry.offPeakMultiplier === 'number' && entry.offPeakMultiplier > 0 && entry.offPeakMultiplier <= 1)) return false;
  }
  return true;
}

/** Rebuild a DeepSeek catalog base from a cached page-read record, or null. */
function catalogFromCache(raw) {
  if (!isCatalogShape(raw)) return null;
  const models = {};
  for (const [id, entry] of Object.entries(raw.models)) {
    models[id] = {
      name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : id,
      rates: {
        cacheMiss: entry.rates.cacheMiss,
        cacheHit: entry.rates.cacheHit,
        output: entry.rates.output,
      },
      offPeakMultiplier: typeof entry.offPeakMultiplier === 'number' ? entry.offPeakMultiplier : DEFAULT_PRICING.offPeakMultiplier,
    };
  }
  const windows = Array.isArray(raw.peakWindows)
    ? raw.peakWindows.filter((window) => Array.isArray(window) && window.length === 2 && Number.isInteger(window[0]) && Number.isInteger(window[1]) && window[0] >= 0 && window[1] <= 1440 && window[0] < window[1])
    : [];
  return {
    ...DEFAULT_PRICING,
    asOf: typeof raw.asOf === 'string' && raw.asOf !== '' ? raw.asOf : DEFAULT_PRICING.asOf,
    source: typeof raw.source === 'string' && raw.source !== '' ? raw.source : OFFICIAL_PRICE_URL,
    ...(windows.length === 0 ? {} : { peakWindows: windows }),
    models,
  };
}

/** Catalog base from one successful official page read, keeping the built-in names. */
function catalogFromOfficial(parsed) {
  const models = {};
  for (const [id, entry] of Object.entries(parsed.models)) {
    models[id] = {
      ...entry,
      name: DEFAULT_PRICING.models[id]?.name ?? entry.name ?? id,
    };
  }
  return {
    ...DEFAULT_PRICING,
    asOf: parsed.asOf,
    source: parsed.source,
    models,
    ...(parsed.peakWindows === null ? {} : { peakWindows: parsed.peakWindows }),
  };
}

/** Read the cached DeepSeek catalog without blocking plugin activation. */
function readCachedCatalog(file) {
  try {
    return catalogFromCache(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

/** Persist the last page-read record fire-and-forget. */
async function saveCachedCatalog(file, parsed) {
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({ fetchedAt: parsed.fetchedAt, asOf: parsed.asOf, source: parsed.source, peakWindows: parsed.peakWindows, models: parsed.models }),
      'utf8',
    );
  } catch {
    // Non-fatal: next start falls back to the built-in snapshot.
  }
}

/** Fetch a page body with a bounded wait. */
async function fetchText(url, timeoutMs) {
  if (typeof fetch !== 'function') throw new Error('fetch is unavailable in this Host');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'text/html', 'user-agent': 'dsh-token-cost/0.2 (official price refresh)' },
    });
    if (!response.ok) throw new Error(`price page returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Refresh the DeepSeek official price catalog now and then on a fixed interval.
 * A successful read rebuilds the runtime catalog for samples that happen
 * afterwards; the curated China vendor catalogs come from the repository and do
 * not change at runtime.
 */
function startPriceRefresh(ctx, { userConfig, catalogRef, cacheFile, curatedVendors, deepseekConfig }) {
  const url = typeof userConfig.priceUrl === 'string' && userConfig.priceUrl !== '' ? userConfig.priceUrl : OFFICIAL_PRICE_URL;
  const hours = typeof userConfig.refreshHours === 'number' && Number.isFinite(userConfig.refreshHours) ? Math.min(Math.max(userConfig.refreshHours, 1), 168) : 24;
  ctx.effect(() => {
    let disposed = false;
    const run = async () => {
      if (disposed) return;
      try {
        const html = await fetchText(url, 20000);
        if (disposed) return;
        const parsed = parseOfficialPricingPage(html, { now: Date.now(), sourceUrl: url });
        if (parsed === null || disposed) return;
        const deepseekPricing = normalizePricing(deepseekConfig, catalogFromOfficial(parsed));
        catalogRef.current = buildCostCatalog({ deepseekPricing, curatedVendors, userConfig });
        await saveCachedCatalog(cacheFile, parsed);
      } catch {
        // Keep the previous catalog: a network or layout failure must never
        // change how tokens are priced.
      }
    };
    void run();
    const timer = setInterval(() => void run(), hours * 3600 * 1000);
    if (typeof timer.unref === 'function') timer.unref();
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, 'token-cost: official price refresh');
}

/**
 * Mount the cost projection. Registration is an effect on the mounting fiber, so
 * unloading the plugin removes the key again.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {unknown} config - plugin row config from the profile patch layer.
 */
export function apply(ctx, config) {
  const userConfig = typeof config === 'object' && config !== null && !Array.isArray(config) ? config : {};
  const cacheFile = typeof userConfig.cacheFile === 'string' && userConfig.cacheFile !== '' ? userConfig.cacheFile : defaultCacheFile();

  let curatedVendors = [];
  try {
    curatedVendors = loadCatalog();
  } catch (error) {
    // A rejected data file must not take the whole plugin (and its projection
    // key) down: keep DeepSeek pricing and let unknown routes show as unpriced.
    console.warn('[dsh-token-cost] China price catalog rejected:', error instanceof Error ? error.message : error);
  }

  const deepseekConfig = deepseekConfigOf(userConfig);
  const deepseekBase = readCachedCatalog(cacheFile) ?? DEFAULT_PRICING;
  const deepseekPricing = normalizePricing(deepseekConfig, deepseekBase);
  const catalogRef = { current: buildCostCatalog({ deepseekPricing, curatedVendors, userConfig }) };

  ctx.sessionProjections.register(createCostProjectionDefinition(catalogRef));

  if (userConfig.refresh !== false) {
    startPriceRefresh(ctx, { userConfig, catalogRef, cacheFile, curatedVendors, deepseekConfig });
  }
}
//#endregion
