# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-20

Bilingual settings dialog with display-currency conversion.

### Added

- A small settings dialog inside the cost popover (gear button in the title row):
  - **Language**: 跟随应用 / 中文 / English — an in-plugin override of the
    Harness locale, applied to every string immediately.
  - **Display currency**: 原币种 (native, the default) / CNY ¥ / USD $ — converts
    every displayed amount into one currency, with an explicit, user-editable
    exchange rate (`1 USD = ¥7.20` by default) shown as an estimate line.
  - Preferences persist in `localStorage` (`dsh-token-cost.settings.v1`); the
    panel is fully bilingual and safe when storage is unavailable.
- Localized copy for the settings panel, FX estimate line and all existing
  labels in both zh and en.

### Changed

- Converted display mode shows a single target-currency total in the pill/title,
  converts per-model bucket and peak/off-peak amounts, and never mixes symbols;
  native mode keeps the previous per-currency behaviour.
- README documents the settings panel, conversion semantics and the accuracy
  caveat (conversion is a display estimate at a user-set rate).

## [0.3.0] - 2026-10-20

Per-model tabs, upgrade compatibility and international (USD) vendor prices.

### Added

- Curated USD price catalogs for six international vendors, read from each
  vendor's own official pricing page on 2026-10-20: OpenAI (19 models),
  Anthropic (15), Google Gemini (10), xAI (8), Mistral AI (8) and Cohere (6) —
  66 USD models with per-vendor evidence notes under `catalog/world/notes/`.
- A provider/model-id survey of this DSH build's installed pi-ai catalog
  (`catalog/world/notes/provider-map.md`), so provider hints and foreign model
  ids match what the app actually routes.
- The catalog subsystem now loads two directories: `catalog/china/` (CNY/¥) and
  `catalog/world/` (USD/$). `loadCatalog()` returns both, the validator checks
  both, and a directory's currency is enforced (`node catalog/validate.js`).
- Context-length pricing tiers for foreign vendors that publish them (OpenAI and
  xAI long context, Gemini long context, Claude Haiku 5.5).
- Aliases bridge official wire ids and the ids shipped by DSH's pi-ai catalog
  where they differ (e.g. `mistral-medium-3.5` → `mistral-medium-3-5`).
- Each model tab now discloses the price data date next to its official price
  link (`数据日期 2026-10-20` / `Data as of 2026-10-20`).

### Changed

- The cost dialog is now strictly one tab per model. The aggregate tab is gone:
  every tab shows only the billing dimensions that model actually has —
  cache-hit input, cache-miss input and output, plus peak/off-peak cost rows for
  vendors with official time bands (DeepSeek). Flat-price vendors (Qwen, GLM,
  Kimi, MiMo, ...) show a short localized note that they have no peak/off-peak
  bands instead of meaningless rows.
- Sessions that mix CNY and USD models show both totals side by side
  (`¥2.32 · $0.14`); currencies are never converted or summed together.
- The README documents the international vendor table, provider setup, promo
  prices, the data-date disclosure and the foreign-pricing limitations.

### Fixed

- A browser tab still running the previous client build across an upgrade no
  longer loses the cost pill: the wire view also carries the legacy
  single-currency fields, and the client upgrades a legacy projection value in
  place instead of rejecting it.

## [0.2.0] - 2026-10-19

Multi-vendor pricing with a tabbed per-model breakdown.

### Added

- Curated CNY price catalogs for 10 Chinese vendors (智谱 GLM, 阿里云百炼 Qwen,
  字节跳动火山方舟 Doubao, 腾讯混元, 百度千帆 ERNIE, 月之暗面 Kimi, MiniMax,
  阶跃星辰 StepFun, 商汤日日新 SenseNova, 小米 MiMo), with per-vendor source URLs,
  read dates and evidence notes under `catalog/china/notes/`.
- `catalog/` subsystem: a synchronous loader/normalizer, a data-contract
  validator (`npm run validate:catalog`) and a multi-vendor price lookup engine
  (provider hint → exact model id → alias → documented snapshot prefix, with
  context-length tier selection).
- Per-model tabs in the cost dialog: an aggregate "全部" tab plus one tab per
  model, each with its token buckets, costs in that model's currency, the
  vendor's peak/off-peak split when it has time bands, and its official price
  link.
- Multi-currency accounting: CNY and USD totals stay separate in state, the pill
  and the dialog (never summed or converted).
- User overrides may now patch any catalog model or add a custom model/price from
  the plugin config; global aliases and a fallback model are supported.
- Chinese vendor data contract (`catalog/china/SCHEMA.md`) and contributor flow.

### Changed

- The session projection state version is now 2 (per-currency totals plus
  per-model state); checkpoints from 0.1.0 are discarded and rebuilt from the log.
- The DeepSeek official-page refresh remains, but now rebuilds the whole runtime
  catalog (DeepSeek + curated vendors + user overrides) after a successful read.
- Model prices use the exact wire model id; dated snapshots are aliases, and
  unknown ids are disclosed as `未定价` instead of being priced by a guess.

### Removed

- The single-vendor global price block in the projection view (`price.models`):
  the dialog now takes each vendor's source/asOf from its own model entry.

## [0.1.0] - 2026-10-19

Initial public release.

### Added

- Session projection `tokenCost`: folds each durable provider-reported token
  usage sample of the current session and prices it with the official unit rate
  and the peak/off-peak band of that sample's timestamp.
- Cost pill next to the shipped token-usage pill below the composer, with a
  click-open breakdown: token counts in K/M, two-decimal CNY costs, peak and
  off-peak band cost, per-model rows when more than one route is used, and a
  link to the official DeepSeek price page.
- Official price page reader: background refresh at startup and every 24 hours,
  with fail-safe parsing (unexpected layout, network or ratio failures keep the
  previous catalog).
- Local cache of the last successful page read (`%DSH_HOME%/storages/`), so a
  restart can price immediately without network access.
- Manual price/peak-window/holiday overrides through the plugin row config.
- Built-in 2026 Chinese statutory holiday calendar; peak windows in Beijing time.
- Fail-safe fallbacks: built-in catalog snapshot, unpriced-model disclosure, and
  invalid-configuration backoff to the built-in table.
- Offline tests: cost fold and band rules, official-page parser (with a
  minimized fixture), and a client render-path suite.
