# `catalog/` — curated China vendor price catalog

DeepSeek's own prices live in [`../pricing.js`](../pricing.js) (built-in snapshot
plus the official-page refresh). Everything here is the **curated, offline copy**
of other Chinese vendors' published CNY prices, so routes from providers such as
`zai`, `moonshot` or `dashscope` can be priced without a network call.

## Layout

| Path | What it is |
| --- | --- |
| `china/SCHEMA.md` | **The data contract.** Read it before adding a vendor. |
| `china/_template.js` | Copy this to start a new vendor file. `_`-prefixed files are ignored. |
| `china/<vendor>.js` | One data-only module per vendor: `export default { ... }`. |
| `china/notes/<vendor>.md` | Short evidence notes: source URLs, read date, uncertainties. |
| `validate.js` | Schema validator + synchronous loader core. Run it after every edit. |
| `index.js` | `loadCatalog()` — loads, validates and normalizes every vendor file. |
| `lookup.js` | `createLookup(vendors)` — provider/model/tier price lookup for the Host fold. |

## Adding a vendor

1. Copy `china/_template.js` to `china/<kebab-vendor-id>.js`.
2. Read the vendor's **own official mainland pricing page** and record the
   current CNY price per 1,000,000 tokens (`cacheHit`, `cacheMiss`, `output`,
   optional `cacheWrite`; use `tiers` for context-length pricing). Never
   convert USD, never guess, never use resellers or blog summaries.
3. Fill `source` (the exact https URL), `asOf` (the day you read it) and
   `providers` (best-effort DSH provider ids; `[]` when unsure).
4. Put URLs and caveats in `china/notes/<vendor>.md`, not in the data file.
5. Validate:

   ```sh
   node catalog/validate.js
   ```

   The command exits non-zero and prints one line per problem, prefixed with the
   offending file. A vendor whose price cannot be verified is better left out
   (with a note) than added with a guessed number.

## Runtime use (Host only)

```js
import { loadCatalog } from './catalog/index.js';
import { createLookup } from './catalog/lookup.js';

const vendors = loadCatalog();                 // sync; [] while the data set is empty
const lookup = createLookup(vendors);          // normalized catalogs (+ synthetic DeepSeek vendor)

const match = lookup.resolve({ provider: 'zai', model: 'glm-4.6', promptTokens: 12000 });
// → null when unpriced, otherwise:
// { vendor, vendorName, currency, source, asOf,
//   model: { id, name, notes? },
//   rates: { cacheHit, cacheMiss, cacheWrite, output },  // tier-selected when tiered
//   tier: null | { maxInputTokens },
//   billing: null | { windows, offPeakMultiplier, weekdays, holidays } }
```

`loadCatalog()` is synchronous because the Host plugin builds its runtime
catalog inside the synchronous `apply()`. It throws a `CatalogError` naming every
invalid file — activation catches it and keeps pricing with the DeepSeek
catalog; tests let it fail. An empty/partial `china/` directory is not an error,
so contributors can land vendor files one at a time; pass
`loadCatalog({ minVendors: n })` to opt into a stricter check.

Lookup order: provider-exact model id → model id → alias → documented
`matchPrefixes` (longest wins) → `null`. Matching is case-insensitive; tier
selection uses the first tier whose `maxInputTokens >= promptTokens`, or the
largest tier past the published bound.

## Rules of thumb

- One file per vendor, data only — no imports, no helpers, no side effects.
- Only current, published prices; no retired models, no invented ids.
- Omit `cacheWrite` when the vendor has no separate cache-write price (writes
  then bill at `cacheMiss`); `cacheHit === cacheMiss` when only one input price
  is published.
- Don't add DeepSeek here. Its catalog is maintained in `pricing.js`.
