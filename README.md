# dsh-token-cost

[![tests](https://github.com/ZombieStiffMann/dsh-token-cost/actions/workflows/test.yml/badge.svg)](https://github.com/ZombieStiffMann/dsh-token-cost/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) plugin
that shows **how much the current session has cost so far**, right next to the
built-in token-usage pill below the composer. Costs are computed from the
provider-reported usage of every model call, priced at the official DeepSeek
rate **and the peak/off-peak band of the moment each token was consumed**.

> Unofficial third-party plugin. Not affiliated with or endorsed by DeepSeek.
> Cost figures are estimates; the official bill remains authoritative.

## Preview

The pill sits after the shipped activity/usage pills. Click it for the breakdown:

![Token cost pill and breakdown dialog in the DeepSeek Harness composer](docs/preview.png)

```text
Token 费用                    ¥1.97
────────────────────────────
未命中缓存输入   288.3K      ¥0.29
缓存命中输入      44.2M      ¥0.88
输出             198.2K      ¥0.79
Token 合计        44.7M
────────────────────────────
高峰时段费用                ¥0.00
空闲时段费用                ¥1.97
────────────────────────────
DeepSeek 官方价格
https://api-docs.deepseek.com/zh-cn/quick_start/pricing
```

## Features

- Per-session cost beside the existing token-usage pill; no layout replacement.
- Prices follow the **official page**, not a stale hardcoded snapshot: the Host
  half re-reads it at startup and every 24 hours and swaps the catalog for later
  tokens (fail-safe parsing; see below).
- Peak / off-peak billing: Beijing-time weekday peak windows with Chinese
  statutory holidays treated as off-peak, at the official off-peak multiplier.
- Token counts in K/M, money in two-decimal CNY, per-bucket costs, per-model
  rows when more than one route is used, and one link to the official price page.
- Zero runtime dependencies. Reads no data other than the session's own durable
  usage events, and makes exactly one kind of outbound request (the price page).
- The pill hides itself until the session has billable usage, and marks models
  without a price as `未定价` instead of counting them as free.

## How the cost is calculated

For every durable `assistant/message` / `assistant/attempt` usage sample of the
session:

```text
cost = Σ tokens_in_bucket × official_rate(bucket) × band_multiplier(timestamp)
```

The four billing buckets are cache-hit input, cache-miss input, cache-write
input and output. Reasoning tokens are already part of the output count and are
not billed twice; the official table has no cache-write column, so cache writes
bill at the cache-miss rate. The multiplier comes from the sample's own
timestamp: peak on Beijing-time (UTC+8) Monday–Friday 09:00–12:00 and
14:00–18:00, excluding Chinese statutory holidays; every other moment is
off-peak at 50% of peak. Tokens are folded with the same replacement/retry rules
as the shipped `tokenUsage` projection, so the totals match the built-in usage
pill.

CNY per one million tokens (current official table, peak / off-peak):

| model | cache-hit input | cache-miss input | output |
|---|---|---|---|
| `deepseek-flash` (DeepSeek-V4.1-Flash) | ¥0.04 / ¥0.02 | ¥2 / ¥1 | ¥8 / ¥4 |
| `deepseek-v4-pro` (DeepSeek-V4-Pro) | ¥0.30 / ¥0.15 | ¥9.0 / ¥4.5 | ¥27.0 / ¥13.5 |

Tokens consumed before 2026-08-16 (when peak/off-peak pricing started) are
priced with the current table and band rule by design.

## Price updates

- On startup the plugin restores the last catalog it read successfully from
  `%DSH_HOME%\storages\token-cost-official-prices.json`, then fetches
  <https://api-docs.deepseek.com/zh-cn/quick_start/pricing> in the background,
  and repeats once every 24 hours.
- A successful read replaces the catalog for **tokens consumed afterwards**;
  tokens already counted keep the cost they were charged at their own time.
- A network error, an unexpected page layout, or inconsistent peak/off-peak
  ratios keep the previous catalog — a half-parsed page can never change prices.
  Renamed peak windows in the page footnote are picked up when recognizable.
- Disable it with `refresh: false` (see Configuration). No session content,
  tokens, or identifiers are sent anywhere: the request is a plain page GET.

## Install

Requirements: a DeepSeek Harness build with the Plugin Manager (`plugin_manager`
tool or the **Plugins** page), plus `git` and network access for a GitHub
install.

Install from GitHub with the manager tool:

```text
plugin_manager install_bundle target=github:zombiestiffmann/dsh-token-cost
```

Pin a release:

```text
plugin_manager install_bundle target=github:zombiestiffmann/dsh-token-cost#v0.1.0
```

For local development, point the manager at a checkout instead:

```text
plugin_manager install_bundle target=<absolute path to this directory>
```

Refresh the page after the first install so the new client module loads. Remove
or disable it later from the **Plugins** page (or
`plugin_manager remove_bundle target=dsh-token-cost`).

## Configuration

Override the `token-cost` row in the profile patch layer
(`%DSH_PROFILE_DIR%\cordis.patch.yml`; it is applied after every bundle layer).
Every field is optional.

```yaml
- id: token-cost
  name: 'dsh-token-cost'
  config:
    # Background official-price refresh
    refresh: true            # false = use the cached/built-in catalog only
    refreshHours: 24         # 1..168
    priceUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing'

    # Manual price override (wins over the fetched catalog; omitted rate keys
    # inherit the fetched/built-in entry)
    models:
      deepseek-flash:
        name: DeepSeek-V4.1-Flash
        rates: { cacheMiss: 2, cacheHit: 0.04, output: 8 }

    # Peak windows as [startMinute, endMinute) of the Beijing-time wall clock
    peakWindows: [[540, 720], [840, 1080]]
    offPeakMultiplier: 0.5
    timeZoneOffsetMinutes: 480
    # Additive holiday dates; 2026 statutory holidays are built in
    additionalHolidays: ['2027-01-01']
    currency: { code: CNY, symbol: '¥' }
```

The 2026 Chinese statutory holidays are built in (国办发明电〔2025〕7号). The
2027 arrangement was not published as of 2026-10-19, so add future dates with
`additionalHolidays` once announced.

## Compatibility

- Tested with DeepSeek Harness **0.2.1-rc.2** (desktop, Windows 11, Web UI).
- Uses only the documented plugin surfaces: a Host session projection
  (`ctx.sessionProjections`) and one `conversation.composer.dock` slot entry.
- Harness is in developer preview, so plugin APIs may change between releases.
  Issues and PRs for newer Harness versions are welcome.

## Development

Repository layout:

| path | role |
|---|---|
| `index.js` | Host half: `tokenCost` session projection, price refresh and cache |
| `pricing.js` | Built-in catalog, config normalization, peak/off-peak band rules |
| `official-pricing.js` | Pure official-page parser (fail-safe, no network/file I/O) |
| `client.js` | Client half: composer-dock cost pill and breakdown dialog |
| `cordis.patch.yml` | Bundle patch that inserts the Host `token-cost` row |
| `locale/` | Plugin Manager display metadata (en/zh) |
| `docs/preview.png` | Screenshot used by this README |
| `test/` | Offline tests and the minimized pricing-page fixture |

Run the tests (Node 20+; CI runs them on 20/22/24):

```bash
npm test                 # all offline tests
npm run test:fold        # pricing fold, bands, holidays, retry/replacement rules
npm run test:parser      # official-page parser against a minimized fixture
npm run test:component   # renders the real client.js in a DOM-less stub
```

No dependencies and no build step: everything ships as plain ESM/JS.

## Limitations

- Cost is an estimate from the official price and time band at each usage
  timestamp, not a billing record.
- Only prices models present in the official table; other providers (for example
  pi-ai routes) are reported as unpriced, not estimated.
- A forked session's inherited prefix is included in the fork's cost, matching
  the shipped `tokenUsage` projection.
- The page reader understands the current page shape; when it changes, the last
  good catalog is kept and can be overridden manually.

## License

[MIT](LICENSE) © 2026 zombiestiffmann.

DeepSeek, DeepSeek Harness and related marks belong to their owners. The official
price data is used only to compute estimates for this plugin.
