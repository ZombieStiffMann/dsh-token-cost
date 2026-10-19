# World vendor price catalog — USD data contract

One data file per international vendor under `catalog/world/`, exporting **one**
`VendorCatalog` object as the default export.

The contract is the same as the China catalog: read
[`../china/SCHEMA.md`](../china/SCHEMA.md) first for the full `VendorCatalog`,
`RateSet` and `ModelPrice` definitions and for the data rules. Only the currency
and the directory differ:

| | China section | World section |
| --- | --- | --- |
| directory | `catalog/china/*.js` | `catalog/world/*.js` |
| `currency` | `{ code: 'CNY', symbol: '¥' }` | `{ code: 'USD', symbol: '$' }` |
| `rates` / `tiers` | CNY per 1,000,000 tokens | USD per 1,000,000 tokens |
| `source` | vendor's mainland-China pricing page | vendor's official USD pricing page |

Everything else is unchanged: one file per vendor, data only (`export default
{ ... }`, no imports, no code), files starting with `_` are ignored, exactly one
of `rates`/`tiers` per model, `cacheWrite` omitted when writes bill at the
uncached input rate, `providers` best-effort DSH provider ids (may be `[]`),
`asOf` the day the page was read, `source` the exact https URL.

## Layout

```text
catalog/world/<vendor>.js        # one vendor, e.g. openai.js
catalog/world/notes/<vendor>.md  # evidence: official URL(s), read date, caveats
```

Copy [`../china/_template.js`](../china/_template.js) to start a new file, then
change `currency` to `{ code: 'USD', symbol: '$' }` and fill in the published USD
prices.

## Data rules specific to this section

1. **USD prices only, as published by the vendor.** Never convert CNY/USD, never
   use resellers, blogs or third-party summaries.
2. Model the **standard realtime per-token price**. Batch, flex/priority,
   subscription and provisioned-throughput prices are not part of this schema;
   when they exist, note them in `notes/<vendor>.md` instead.
3. Include only currently sold text/chat models with a published per-token USD
   price. Omit embeddings, audio, image, video, realtime and retired models.
4. If long context is priced differently, use `tiers` (ascending
   `maxInputTokens`, exactly like the China files) and explain the boundaries in
   the notes.
5. Cache reads go in `cacheHit`; explicit cache-write prices go in `cacheWrite`
   (omit when there is no separate write price). Cache **storage** charges that
   are not per-token cannot be modeled — note them.
6. Reasoning/thinking tokens are already billed inside `output` unless the
   vendor's table states otherwise; mention the nuance in `notes`.

## Validation

```sh
node catalog/validate.js                  # validates both sections
node catalog/validate.js catalog/world    # validates this directory only
```

The validator enforces the directory currency: a world vendor declaring anything
other than `{ code: 'USD', symbol: '$' }` is rejected, and so is a China vendor
declaring anything other than `{ code: 'CNY', symbol: '¥' }`.
