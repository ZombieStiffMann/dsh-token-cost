# `catalog/` — curated vendor price catalogs

DeepSeek's own prices live in [`../pricing.js`](../pricing.js) (built-in snapshot
plus the official-page refresh). Everything here is the **curated, offline copy**
of other vendors' published per-token prices, so routes from providers such as
`zai`, `moonshot`, `dashscope`, `openai` or `anthropic` can be priced without a
network call.

There are two sections, each with its own currency:

| Section | Directory | Currency | Contents |
| --- | --- | --- | --- |
| China | `catalog/china/*.js` | CNY `¥` | mainland-China vendors |
| World | `catalog/world/*.js` | USD `$` | international vendors |

## Layout

| Path | What it is |
| --- | --- |
| `china/SCHEMA.md` | **The shared data contract.** Read it before adding a vendor. |
| `world/SCHEMA.md` | World-section delta: USD currency and section-specific rules. |
| `china/_template.js` | Copy this to start a new vendor file. `_`-prefixed files are ignored. |
| `china/<vendor>.js` | One data-only module per vendor: `export default { ... }`. |
| `world/<vendor>.js` | Same shape, `currency: { code: 'USD', symbol: '$' }`. |
| `china/notes/<vendor>.md`, `world/notes/<vendor>.md` | Short evidence notes: source URLs, read date, uncertainties. |
| `validate.js` | Schema validator + synchronous loader core. Run it after every edit. |
| `index.js` | `loadCatalog()` — loads, validates and normalizes both sections. |
| `lookup.js` | `createLookup(vendors)` — provider/model/tier price lookup for the Host fold. |

## Adding a vendor

1. Pick the section: mainland-China vendor → `china/`, international vendor →
   `world/`. Copy `china/_template.js` to `<section>/<kebab-vendor-id>.js`.
2. Read the vendor's **own official pricing page** and record the current price
   per 1,000,000 tokens in that section's currency (`cacheHit`, `cacheMiss`,
   `output`, optional `cacheWrite`; use `tiers` for context-length pricing).
   Never convert USD/CNY, never guess, never use resellers or blog summaries.
3. Set `currency` to `{ code: 'CNY', symbol: '¥' }` in `china/` or
   `{ code: 'USD', symbol: '$' }` in `world/` — the validator rejects anything
   else. Fill `source` (the exact https URL), `asOf` (the day you read it) and
   `providers` (best-effort DSH provider ids; `[]` when unsure).
4. Put URLs and caveats in `<section>/notes/<vendor>.md`, not in the data file.
5. Validate:

   ```sh
   node catalog/validate.js                  # both sections
   node catalog/validate.js catalog/world    # one directory
   ```

   The command exits non-zero and prints one line per problem, prefixed with the
   offending file (`china/…` or `world/…`). A vendor whose price cannot be
   verified is better left out (with a note) than added with a guessed number.

## Runtime use (Host only)

```js
import { loadCatalog, CHINA_DIR, WORLD_DIR } from './catalog/index.js';
import { createLookup } from './catalog/lookup.js';

const vendors = loadCatalog();                 // sync: China (CNY) first, then world (USD)
const lookup = createLookup(vendors);          // normalized catalogs (+ synthetic DeepSeek vendor)

const match = lookup.resolve({ provider: 'openai', model: 'gpt-5.2', promptTokens: 12000 });
// → null when unpriced, otherwise:
// { vendor, vendorName, currency, source, asOf,          // currency is CNY or USD
//   model: { id, name, notes? },
//   rates: { cacheHit, cacheMiss, cacheWrite, output },  // tier-selected when tiered
//   tier: null | { maxInputTokens },
//   billing: null | { windows, offPeakMultiplier, weekdays, holidays } }
```

`loadCatalog()` is synchronous because the Host plugin builds its runtime
catalog inside the synchronous `apply()`. It returns, in order: China vendors
(sorted by file name), then world vendors (sorted by file name). It throws a
`CatalogError` naming every invalid file across both sections — activation
catches it and keeps pricing with the DeepSeek catalog; tests let it fail. A
missing or empty `world/` directory is valid, so contributors can land vendor
files one at a time; pass `loadCatalog({ minVendors: n })` to opt into a stricter
check. `loadCatalog({ dir })` loads a single directory; `CHINA_DIR` and
`WORLD_DIR` are exported for tooling.

Lookup order: provider-exact model id → model id → alias → documented
`matchPrefixes` (longest wins) → `null`. Matching is case-insensitive; tier
selection uses the first tier whose `maxInputTokens >= promptTokens`, or the
largest tier past the published bound. The result's `currency` comes from the
matched vendor catalog (or per-model override), so CNY and USD amounts are never
mixed.

## Rules of thumb

- One file per vendor, data only — no imports, no helpers, no side effects.
- Only current, published prices; no retired models, no invented ids.
- Rates are per 1,000,000 tokens **in the section's currency**; no conversion.
- Omit `cacheWrite` when the vendor has no separate cache-write price (writes
  then bill at `cacheMiss`); `cacheHit === cacheMiss` when only one input price
  is published.
- Don't add DeepSeek here. Its catalog is maintained in `pricing.js`.
