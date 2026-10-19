/**
 * Host half of `dsh-token-cost`.
 *
 * Registers one session projection (`tokenCost`) that folds every durable
 * provider-reported token-usage sample of a session into an estimated cost:
 *
 *   cost(sample) = tokens x official unit rate x time-band multiplier
 *
 * The multiplier comes from the sample's own timestamp (peak / off-peak, with
 * Chinese statutory holidays treated as off-peak), and the unit rates come from
 * the latest official price catalog. The catalog starts as the built-in
 * snapshot in pricing.js, is restored from the last successful page read, and is
 * refreshed in the background by fetching the public pricing page: a successful
 * read swaps the catalog for usages that happen afterwards, so an official
 * price change takes effect on later tokens without restarting the app. A
 * failed or unrecognizable page keeps the previous catalog.
 *
 * Usage samples are folded with the same replacement rules as the shipped
 * `tokenUsage` projection: a later sample of the same Turn/Step replaces the
 * earlier one, and `llm/retry-started` closes the replacement slot so a retried
 * attempt is billed separately.
 *
 * The unit's wire view is the complete client-facing value; the Web client's
 * generic `useProjection("tokenCost")` reader receives it without folding any
 * session events itself.
 */
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { OFFICIAL_PRICE_URL, parseOfficialPricingPage } from './official-pricing.js';
import { DEFAULT_PRICING, isPeakTime, normalizePricing, pricingKeyOf } from './pricing.js';

/** Projection key read by the client half. */
export const PROJECTION_KEY = 'tokenCost';

/** Bump whenever the fold state fields or their semantics change. */
const STATE_VERSION = 1;

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

/** Effective unit rate of one bucket; an absent cache-write column bills at cache-miss. */
function rateFor(rates, bucket) {
  const rate = rates[BUCKET_RATES[bucket]];
  if (rate !== undefined) return rate;
  return bucket === 'cacheWrite' ? rates.cacheMiss : 0;
}

function isCount(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function zeroTokens() {
  return { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 };
}

function totalTokens(tokens) {
  return tokens.input + tokens.cacheRead + tokens.cacheWrite + tokens.output;
}

function emptyState() {
  return {
    micro: 0,
    saving: 0,
    tokens: zeroTokens(),
    micros: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
    peakMicro: 0,
    offPeakMicro: 0,
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

/**
 * Build one sample's cost contribution. `micro` is the amount in
 * micro-currency units: tokens x (currency per 1M tokens) = micro-currency,
 * because one currency unit is 1e6 micro units.
 *
 * @param {{input:number,cacheRead:number,cacheWrite:number,output:number,reasoning:number}} tokens
 * @param {{provider:string,model:string}} route
 * @param {number} timeMs - the event timestamp the band is read at.
 * @param {ReturnType<typeof normalizePricing>} pricing
 * @param {Set<string>} holidaySet
 */
function contributionOf(tokens, route, timeMs, pricing, holidaySet) {
  const key = pricingKeyOf(pricing, route.model);
  const entry = key === null ? undefined : pricing.models[key];
  const base = {
    micro: 0,
    saving: 0,
    tokens,
    micros: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
    provider: route.provider,
    model: route.model,
    pricingKey: key,
    priced: entry !== undefined,
    peak: false,
    time: timeMs,
    events: 1,
  };
  if (entry === undefined) return base;
  const peak = isPeakTime(pricing, timeMs, holidaySet);
  const multiplier = peak ? 1 : entry.offPeakMultiplier;
  const micros = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  let micro = 0;
  let saving = 0;
  for (const bucket of BUCKETS) {
    const rate = rateFor(entry.rates, bucket);
    const actual = Math.round(tokens[bucket] * rate * multiplier);
    micros[bucket] = actual;
    micro += actual;
    saving += Math.round(tokens[bucket] * rate) - actual;
  }
  return { ...base, micro, saving, micros, peak };
}

/**
 * Add (sign +1) or remove (sign -1) one contribution. State stays pure JSON and
 * immutable: every touched container is copied.
 */
function addContribution(state, contribution, sign) {
  const tokens = {};
  for (const key of Object.keys(state.tokens)) tokens[key] = state.tokens[key] + sign * contribution.tokens[key];
  const micros = {};
  for (const key of BUCKETS) micros[key] = state.micros[key] + sign * contribution.micros[key];
  const key = modelStateKey(contribution);
  const previous = state.models[key];
  const modelTokens = {};
  for (const name of Object.keys(state.tokens)) modelTokens[name] = (previous?.tokens[name] ?? 0) + sign * contribution.tokens[name];
  const modelEntry = {
    provider: contribution.provider,
    model: contribution.model,
    pricingKey: contribution.pricingKey,
    priced: contribution.priced,
    micro: (previous?.micro ?? 0) + sign * contribution.micro,
    tokens: modelTokens,
  };
  const models = { ...state.models, [key]: modelEntry };
  if (sign < 0 && modelEntry.micro === 0 && totalTokens(modelTokens) === 0 && modelTokens.reasoning === 0) {
    delete models[key];
  }
  return {
    ...state,
    micro: state.micro + sign * contribution.micro,
    saving: state.saving + sign * contribution.saving,
    tokens,
    micros,
    peakMicro: state.peakMicro + sign * (contribution.peak ? contribution.micro : 0),
    offPeakMicro: state.offPeakMicro + sign * (contribution.peak ? 0 : contribution.micro),
    models,
    events: state.events + sign * contribution.events,
    // Bounds are only widened on add. Removing a superseded sample can leave
    // them one sample stale, which costs nothing: replacements land moments
    // later, inside the same Turn/Step.
    firstTime: sign > 0 && (state.firstTime === null || contribution.time < state.firstTime) ? contribution.time : state.firstTime,
    lastTime: sign > 0 && (state.lastTime === null || contribution.time > state.lastTime) ? contribution.time : state.lastTime,
  };
}

/**
 * The projection fold. Mirrors the shipped `tokenUsage` replacement rules so the
 * cost total and the token pill always describe the same samples.
 */
function applyEvent(state, event, pricing, holidaySet) {
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
  const contribution = contributionOf(tokens, effectiveRoute, event.time, pricing, holidaySet);

  const previous = state.last !== null && state.last.turn === turn && state.last.step === step ? state.last : null;
  let next = previous === null ? state : addContribution(state, previous, -1);
  next = addContribution(next, contribution, 1);
  next.last = { ...contribution, turn, step };
  return next;
}

/** Client-facing value: complete, JSON-safe and self-describing. */
function buildView(state, pricing) {
  const models = Object.values(state.models)
    .filter((model) => model.micro !== 0 || totalTokens(model.tokens) !== 0 || model.tokens.reasoning !== 0)
    .map((model) => ({
      provider: model.provider,
      model: model.model,
      pricingKey: model.pricingKey,
      priced: model.priced,
      micro: model.micro,
      tokens: model.tokens,
      tokensTotal: totalTokens(model.tokens),
    }));
  const unpriced = models.filter((model) => !model.priced);
  const rates = {};
  for (const [id, entry] of Object.entries(pricing.models)) {
    rates[id] = {
      name: entry.name,
      rates: {
        cacheMiss: entry.rates.cacheMiss,
        cacheHit: entry.rates.cacheHit,
        cacheWrite: entry.rates.cacheWrite ?? entry.rates.cacheMiss,
        output: entry.rates.output,
      },
      offPeakMultiplier: entry.offPeakMultiplier,
    };
  }
  return {
    currency: pricing.currency,
    micro: state.micro,
    tokens: state.tokens,
    tokensTotal: totalTokens(state.tokens),
    micros: state.micros,
    peakMicro: state.peakMicro,
    offPeakMicro: state.offPeakMicro,
    saving: state.saving,
    models,
    unpricedModels: [...new Set(unpriced.map((model) => model.model))],
    unpricedTokens: unpriced.reduce((sum, model) => sum + model.tokensTotal, 0),
    events: state.events,
    firstTime: state.firstTime,
    lastTime: state.lastTime,
    price: {
      asOf: pricing.asOf,
      source: pricing.source,
      timeZoneOffsetMinutes: pricing.timeZoneOffsetMinutes,
      timeZoneLabel: pricing.timeZoneLabel,
      offPeakMultiplier: pricing.offPeakMultiplier,
      peakWindows: pricing.peakWindows,
      models: rates,
    },
  };
}

/**
 * Build the `tokenCost` projection unit for one resolved pricing catalog.
 *
 * The catalog is read through a mutable reference on every event and view, so
 * a successful background price refresh changes how later samples are priced
 * without re-registering the unit (projection cells already folded keep the
 * cost they were charged at the time they happened).
 *
 * @param {{ current: ReturnType<typeof normalizePricing> }} pricingRef
 */
export function createCostProjectionDefinition(pricingRef) {
  const holidaySets = new WeakMap();
  const holidaySetOf = (pricing) => {
    let holidaySet = holidaySets.get(pricing);
    if (holidaySet === undefined) {
      holidaySet = new Set(pricing.holidays);
      holidaySets.set(pricing, holidaySet);
    }
    return holidaySet;
  };
  return {
    key: PROJECTION_KEY,
    stateVersion: STATE_VERSION,
    stateSchema: JSON_SCHEMA,
    init: () => emptyState(),
    apply: (state, event) => {
      const pricing = pricingRef.current;
      return applyEvent(state, event, pricing, holidaySetOf(pricing));
    },
    wire: {
      viewSchema: JSON_SCHEMA,
      view: (state) => buildView(state, pricingRef.current),
    },
  };
}

/** Cordis service dependency: the session projection registry. */
export const inject = ['sessionProjections'];

/** Default location of the last successfully fetched official-price catalog. */
function defaultCacheFile() {
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh');
  return join(home, 'storages', 'token-cost-official-prices.json');
}

/** Whether a raw JSON object looks like a catalog this module can price with. */
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

/** Rebuild a catalog base from a cached page-read record, or null when unusable. */
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

/** Catalog base from one successful page read, keeping the built-in display names. */
function catalogFromOfficial(parsed) {
  const models = {};
  for (const [id, entry] of Object.entries(parsed.models)) {
    models[id] = {
      ...entry,
      name: DEFAULT_PRICING.models[id]?.name ?? id,
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

/** Read the cached catalog without blocking plugin activation for I/O errors. */
function readCachedCatalog(file) {
  try {
    return catalogFromCache(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

/** Persist the page-read record fire-and-forget; a failure only costs a refetch. */
async function saveCachedCatalog(file, parsed) {
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify({ fetchedAt: parsed.fetchedAt, asOf: parsed.asOf, source: parsed.source, peakWindows: parsed.peakWindows, models: parsed.models }),
      'utf8',
    );
  } catch {
    // Non-fatal: the next process start falls back to the built-in snapshot and
    // the next refresh attempt.
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
 * Refresh the official price catalog now and then on a fixed interval. The
 * first read usually completes while the first turns are still running; later
 * tokens are priced with the refreshed catalog.
 */
function startPriceRefresh(ctx, userConfig, pricingRef, cacheFile) {
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
        pricingRef.current = normalizePricing(userConfig, catalogFromOfficial(parsed));
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
  const base = readCachedCatalog(cacheFile) ?? DEFAULT_PRICING;
  const pricingRef = { current: normalizePricing(userConfig, base) };
  ctx.sessionProjections.register(createCostProjectionDefinition(pricingRef));
  if (userConfig.refresh !== false) startPriceRefresh(ctx, userConfig, pricingRef, cacheFile);
}
