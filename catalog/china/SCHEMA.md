# China vendor price catalog — data contract

One file per vendor under `catalog/china/`, exporting **one** `VendorCatalog`
object as the default export. These files are data only: no imports, no code
beyond `export default { ... }`.

```js
/**
 * @typedef {Object} RateSet
 * @property {number} cacheHit    CNY per 1,000,000 cached-input tokens
 * @property {number} cacheMiss   CNY per 1,000,000 uncached-input tokens
 * @property {number} output      CNY per 1,000,000 output tokens
 * @property {number} [cacheWrite] CNY per 1,000,000 cache-write tokens
 *                                 (omit when the vendor has no separate cache-write
 *                                 price; it then bills at cacheMiss)
 */

/**
 * @typedef {Object} ModelPrice
 * @property {string} id                 exact model id accepted by the vendor API
 * @property {string} name               display name, e.g. "GLM-4.6"
 * @property {string[]} [aliases]        other exact ids billed at the same price
 *                                       (e.g. a dated snapshot id)
 * @property {string[]} [matchPrefixes]  documented snapshot prefixes billed at this
 *                                       price, e.g. "glm-4.6-" for dated ids.
 *                                       Only add when the vendor documents it.
 * @property {RateSet} [rates]           flat price; required when no tiers
 * @property {{maxInputTokens: number, rates: RateSet}[]} [tiers]
 *                                       context-length tiers, ascending by
 *                                       maxInputTokens; required when no rates.
 *                                       maxInputTokens is the upper bound of the
 *                                       request's prompt tokens for that tier.
 * @property {number} [offPeakMultiplier] per-model override; usually omit
 * @property {number[][]} [peakWindows]  per-model override of vendor windows
 * @property {string} [notes]            one short user-facing fact if it matters
 *                                       (e.g. "batch API has separate pricing")
 */

/**
 * @typedef {Object} VendorCatalog
 * @property {string} vendor     stable kebab-case id, e.g. "zhipu"
 * @property {string} name       Chinese display name, e.g. "智谱 AI"
 * @property {string} nameEn     English display name, e.g. "Zhipu AI"
 * @property {{code: 'CNY', symbol: '¥'}} currency  CNY for every China vendor
 * @property {string} source     official pricing page URL (https)
 * @property {string} asOf       YYYY-MM-DD the prices were read
 * @property {string[]} providers best-effort DeepSeek Harness provider ids that
 *                               route to this vendor (e.g. ["zai"]); may be []
 * @property {{
 *   windows: number[][],        // [[startMinute, endMinute)] Beijing wall clock
 *   offPeakMultiplier: number,
 *   weekdays?: number[],        // 0=Sunday..6=Saturday, default [1,2,3,4,5]
 *   holidays?: string[]         // YYYY-MM-DD, default []
 * }} [billing]                 time bands; omit for flat pricing (most vendors)
 * @property {ModelPrice[]} models
 */

export default {
  vendor: 'example',
  name: '示例厂商',
  nameEn: 'Example AI',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://example.com/pricing',
  asOf: '2026-10-19',
  providers: ['example'],
  models: [
    {
      id: 'example-chat',
      name: 'Example Chat',
      rates: { cacheMiss: 2, cacheHit: 0.4, output: 8 },
    },
  ],
};
```

## Data rules

1. **Only CNY prices published on the vendor's own official site** (mainland
   China pricing page). Never convert USD, never guess, never use resellers, blog
   posts, or third-party summaries as the price source.
2. **Only models the vendor currently sells** and whose price is stated in that
   table. Omit retired models and models without a published price.
3. `rates`/`tiers` are **per 1,000,000 tokens, CNY**. Reasoning/thinking tokens
   are already billed inside the output price unless the official table states
   otherwise — put that nuance in `notes`.
4. Do not add a cache price the vendor does not publish: a vendor with only a
   single input price uses the same number for `cacheHit` and `cacheMiss`.
5. `id` must be the exact model string a client sends on the wire (usually
   lowercase). List dated snapshot ids under `aliases`, not invented ids.
   `matchPrefixes` only when the vendor documents that dated versions share the
   price.
6. `asOf` is the day the page was read (YYYY-MM-DD). `source` is that page.
7. Keep `notes` to one short sentence, only when a user needs it to avoid a wrong
   reading (tiering, cache caveats, batch-only pricing).
8. No long quotes or page copies: record facts and the URL. Notes files
   (`catalog/china/notes/<vendor>.md`) may list URLs and short evidence.

## Validation

```text
node catalog/validate.js
```

It checks the shape, numbers, currency, dates, billing windows, duplicate ids and
the tier/rates rule. Any error means the file is not accepted.
