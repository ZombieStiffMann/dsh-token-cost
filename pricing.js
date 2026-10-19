/**
 * Default price catalog and configuration normalization for
 * `dsh-token-cost`.
 *
 * Source of truth (read 2026-10-19):
 *   https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *
 * The official table is quoted in CNY per one million tokens and lists peak and
 * off-peak columns; off-peak is exactly half of peak. Peak means Beijing time
 * (UTC+8) Monday through Friday, excluding Chinese statutory holidays, between
 * 09:00-12:00 and 14:00-18:00. Every other moment - including weekends and the
 * whole of statutory holidays - is off-peak. There is no cache-write charge.
 *
 * Only current prices are kept on purpose: the requested figure is "the
 * latest official price x the time band when the tokens were consumed".
 * Historical price changes (V4 pricing since 2026-08-16 16:00 UTC, V4.1 since
 * 2026-09-10) are therefore deliberately not replayed; see README.md.
 */

/** Rate keys understood by the fold: uncached input, cache-hit input, cache-write input, output. */
export const RATE_KEYS = ['cacheMiss', 'cacheHit', 'cacheWrite', 'output'];

/**
 * Chinese statutory holidays (all-day public holidays) in 2026, per
 * 国办发明电〔2025〕7号 (published 2025-11-04):
 *   https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm
 *
 * Only statutory holidays matter for peak/off-peak: weekends are off-peak
 * anyway, so 调休 make-up workdays that fall on a weekend stay off-peak under
 * the official wording ("周一至周五" = Monday through Friday). The 2027
 * arrangement had not been published as of 2026-10-19; add future dates through
 * the plugin config (`holidays` / `additionalHolidays`) once announced.
 */
export const DEFAULT_HOLIDAYS_2026 = [
  // 元旦
  '2026-01-01', '2026-01-02', '2026-01-03',
  // 春节
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  // 清明节
  '2026-04-04', '2026-04-05', '2026-04-06',
  // 劳动节
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  // 端午节
  '2026-06-19', '2026-06-20', '2026-06-21',
  // 中秋节
  '2026-09-25', '2026-09-26', '2026-09-27',
  // 国庆节
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
];

/**
 * Built-in catalog. `rates` are the official **peak** prices in the currency
 * unit per one million tokens; the off-peak band multiplies them by
 * `offPeakMultiplier`.
 */
export const DEFAULT_PRICING = {
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
  asOf: '2026-10-19',
  timeZoneOffsetMinutes: 480,
  timeZoneLabel: '北京时间 (UTC+8)',
  /** Peak windows as [startMinute, endMinute) of the local wall clock. */
  peakWindows: [[540, 720], [840, 1080]],
  offPeakMultiplier: 0.5,
  holidays: DEFAULT_HOLIDAYS_2026,
  models: {
    'deepseek-flash': {
      name: 'DeepSeek-V4.1-Flash',
      // cacheWrite is omitted on purpose: the official table has no
      // cache-write price, so writes are billed at the cache-miss rate.
      rates: { cacheMiss: 2, cacheHit: 0.04, output: 8 },
    },
    'deepseek-v4-pro': {
      name: 'DeepSeek-V4-Pro',
      rates: { cacheMiss: 9, cacheHit: 0.3, output: 27 },
    },
  },
  /**
   * Legacy model ids still accepted by the gateway but billed at Flash prices.
   * https://api-docs.deepseek.com/zh-cn/quick_start/pricing footnote (1)
   */
  aliases: {
    'deepseek-v4-flash': 'deepseek-flash',
    'deepseek-v4-flash-vision-exp': 'deepseek-flash',
    'deepseek-chat': 'deepseek-flash',
    'deepseek-reasoner': 'deepseek-flash',
  },
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isFiniteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Parse a `HH:MM` local wall-clock string into minutes after midnight. */
function parseClock(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  if (hours === 24 && minutes !== 0) return null;
  return hours * 60 + minutes;
}

/** Normalize one configured window: [startMinute, endMinute) or ["HH:MM","HH:MM"]. */
function normalizeWindow(raw) {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const start = typeof raw[0] === 'number' ? raw[0] : parseClock(raw[0]);
  const end = typeof raw[1] === 'number' ? raw[1] : parseClock(raw[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end > 1440 || start >= end) return null;
  return [start, end];
}

/** Normalize a date-like value to `YYYY-MM-DD`, or null when invalid. */
function normalizeDate(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value.trim());
  if (match === null) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3])) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeCurrency(raw, fallback) {
  if (typeof raw === 'string' && raw.trim() !== '') return { code: raw.trim(), symbol: fallback.symbol };
  if (!isPlainObject(raw)) return cloneJson(fallback);
  const code = typeof raw.code === 'string' && raw.code.trim() !== '' ? raw.code.trim() : fallback.code;
  const symbol = typeof raw.symbol === 'string' && raw.symbol !== '' ? raw.symbol : fallback.symbol;
  return { code, symbol };
}

function normalizeModel(id, raw, base, pricing) {
  const entry = isPlainObject(raw) ? raw : {};
  if (base === undefined && !isPlainObject(entry.rates)) return null;
  const name = typeof entry.name === 'string' && entry.name !== '' ? entry.name : base !== undefined ? base.name : id;
  const declaredRates = isPlainObject(entry.rates) ? entry.rates : {};
  const rates = {};
  for (const key of RATE_KEYS) {
    const declared = declaredRates[key];
    if (declared !== undefined) {
      if (!isFiniteNonNegative(declared)) return null;
      rates[key] = declared;
      continue;
    }
    const inherited = base?.rates?.[key];
    if (isFiniteNonNegative(inherited)) {
      rates[key] = inherited;
      continue;
    }
    // The official table has no cache-write column: the fold bills writes at
    // cacheMiss, so a missing cacheWrite rate is data, not an error.
    if (key === 'cacheWrite') continue;
    // Any other missing bucket would silently price tokens at zero.
    return null;
  }
  const rawMultiplier = entry.offPeakMultiplier;
  const multiplier = isFiniteNonNegative(rawMultiplier) && rawMultiplier <= 1
    ? rawMultiplier
    : base !== undefined && isFiniteNonNegative(base.offPeakMultiplier) && base.offPeakMultiplier <= 1
      ? base.offPeakMultiplier
      : pricing.offPeakMultiplier;
  return { name, rates, offPeakMultiplier: multiplier };
}

/**
 * Merge a user configuration over a catalog base. The base is either the
 * built-in catalog or a freshly parsed official-price catalog, so a successful
 * background refresh keeps applying while explicit user overrides still win.
 * Every override is optional; invalid values fall back instead of throwing,
 * because a typo in a profile patch must not take the whole plugin (and with it
 * the projection key) down.
 *
 * @param {unknown} raw - the plugin row's `config` value.
 * @param {typeof DEFAULT_PRICING} [base] - catalog the config is layered over.
 * @returns {typeof DEFAULT_PRICING} resolved pricing configuration.
 */
export function normalizePricing(raw, base = DEFAULT_PRICING) {
  const config = isPlainObject(raw) ? raw : {};
  const pricing = {
    currency: normalizeCurrency(config.currency, base.currency),
    source: typeof config.source === 'string' && config.source.trim() !== '' ? config.source.trim() : base.source,
    asOf: typeof config.asOf === 'string' && config.asOf.trim() !== '' ? config.asOf.trim() : base.asOf,
    timeZoneOffsetMinutes: Number.isInteger(config.timeZoneOffsetMinutes) && config.timeZoneOffsetMinutes >= -720 && config.timeZoneOffsetMinutes <= 840
      ? config.timeZoneOffsetMinutes
      : base.timeZoneOffsetMinutes,
    timeZoneLabel: typeof config.timeZoneLabel === 'string' && config.timeZoneLabel !== '' ? config.timeZoneLabel : base.timeZoneLabel,
    peakWindows: [],
    offPeakMultiplier: isFiniteNonNegative(config.offPeakMultiplier) && config.offPeakMultiplier <= 1
      ? config.offPeakMultiplier
      : base.offPeakMultiplier,
    holidays: [],
    models: {},
    aliases: { ...base.aliases },
  };

  const rawWindows = Array.isArray(config.peakWindows) ? config.peakWindows : base.peakWindows;
  for (const rawWindow of rawWindows) {
    const window = normalizeWindow(rawWindow);
    if (window !== null) pricing.peakWindows.push(window);
  }
  if (pricing.peakWindows.length === 0) {
    pricing.peakWindows = base.peakWindows.map((window) => [...window]);
  }

  const holidays = new Set(Array.isArray(base.holidays) && base.holidays.length > 0 ? base.holidays : DEFAULT_HOLIDAYS_2026);
  for (const list of [config.holidays, config.additionalHolidays]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const date = normalizeDate(entry);
      if (date !== null) holidays.add(date);
    }
  }
  pricing.holidays = [...holidays].sort();

  const rawModels = isPlainObject(config.models) ? config.models : {};
  const ids = new Set([...Object.keys(base.models), ...Object.keys(rawModels)]);
  for (const id of ids) {
    const model = normalizeModel(id, rawModels[id], base.models[id], pricing);
    if (model !== null) {
      pricing.models[id] = model;
    } else if (base.models[id] !== undefined) {
      // A rejected override of a catalog model keeps the catalog entry: a typo
      // must not silently remove a model from the catalog.
      pricing.models[id] = cloneJson(base.models[id]);
    }
  }
  if (Object.keys(pricing.models).length === 0) {
    pricing.models = cloneJson(base.models);
  }

  if (isPlainObject(config.aliases)) {
    for (const [from, to] of Object.entries(config.aliases)) {
      if (typeof from === 'string' && from !== '' && typeof to === 'string' && to !== '') pricing.aliases[from] = to;
    }
  }
  pricing.fallbackModel = typeof config.fallbackModel === 'string' && config.fallbackModel !== '' ? config.fallbackModel : null;
  return pricing;
}

/** Resolve a route model id to the catalog key that prices it, or null. */
export function pricingKeyOf(pricing, model) {
  if (typeof model !== 'string' || model === '') return null;
  const aliased = pricing.aliases[model] ?? model;
  if (Object.hasOwn(pricing.models, aliased)) return aliased;
  if (typeof pricing.fallbackModel === 'string' && Object.hasOwn(pricing.models, pricing.fallbackModel)) return pricing.fallbackModel;
  return null;
}

/** Calendar date (`YYYY-MM-DD`) and minute-of-day of one instant in the pricing time zone. */
export function localParts(pricing, timeMs) {
  const offsetMs = pricing.timeZoneOffsetMinutes * 60000;
  const shifted = timeMs + offsetMs;
  const date = new Date(shifted);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const minuteOfDay = (((shifted % 86400000) + 86400000) % 86400000) / 60000;
  return { date: `${year}-${month}-${day}`, weekday: date.getUTCDay(), minuteOfDay };
}

/**
 * Whether one instant falls in the official peak band: Beijing time Monday to
 * Friday, excluding Chinese statutory holidays, 09:00-12:00 or 14:00-18:00.
 */
export function isPeakTime(pricing, timeMs, holidaySet) {
  return isPeakForBilling(deepseekBilling(pricing), timeMs, holidaySet);
}

/** Time zone every Chinese vendor's wall-clock pricing rule is stated in. */
export const DEFAULT_TIME_ZONE_OFFSET_MINUTES = 480;

/**
 * Normalized billing descriptor of the DeepSeek official catalog, in the same
 * shape a vendor catalog's `billing` block normalizes to.
 */
export function deepseekBilling(pricing) {
  return {
    timeZoneOffsetMinutes: Number.isInteger(pricing.timeZoneOffsetMinutes) ? pricing.timeZoneOffsetMinutes : DEFAULT_TIME_ZONE_OFFSET_MINUTES,
    windows: (Array.isArray(pricing.peakWindows) ? pricing.peakWindows : []).map(([start, end]) => [start, end]),
    offPeakMultiplier: pricing.offPeakMultiplier,
    weekdays: [1, 2, 3, 4, 5],
    holidays: Array.isArray(pricing.holidays) ? [...pricing.holidays] : [],
  };
}

/**
 * Whether one instant is peak under a vendor billing descriptor (Beijing time).
 *
 * @param {object | null | undefined} billing - windows/offPeakMultiplier/weekdays/holidays.
 * @param {number} timeMs - epoch milliseconds of the usage sample.
 * @param {Set<string>} holidaySet - statutory holidays of the vendor, `YYYY-MM-DD`.
 */
export function isPeakForBilling(billing, timeMs, holidaySet) {
  if (billing === null || billing === undefined) return false;
  const timeZoneOffsetMinutes = Number.isInteger(billing.timeZoneOffsetMinutes) ? billing.timeZoneOffsetMinutes : DEFAULT_TIME_ZONE_OFFSET_MINUTES;
  const parts = localParts({ timeZoneOffsetMinutes }, timeMs);
  const weekdays = Array.isArray(billing.weekdays) && billing.weekdays.length > 0 ? billing.weekdays : [1, 2, 3, 4, 5];
  if (!weekdays.includes(parts.weekday)) return false;
  if (holidaySet.has(parts.date)) return false;
  return billing.windows.some(([start, end]) => parts.minuteOfDay >= start && parts.minuteOfDay < end);
}

