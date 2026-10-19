# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
