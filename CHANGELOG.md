# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
