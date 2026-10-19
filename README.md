# dsh-token-cost

[![tests](https://github.com/ZombieStiffMann/dsh-token-cost/actions/workflows/test.yml/badge.svg)](https://github.com/ZombieStiffMann/dsh-token-cost/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) plugin
that shows **how much the current session has cost so far**, right next to the
built-in token-usage pill below the composer. It prices every provider-reported
usage sample with the official rate of the model that produced it — **17 vendors**
in CNY and USD (DeepSeek, Qwen, GLM, Kimi, Doubao, Hunyuan, ERNIE, MiniMax,
StepFun, SenseNova, Xiaomi MiMo, OpenAI, Anthropic, Google Gemini, xAI, Mistral,
Cohere) — and splits the breakdown per model in a tabbed dialog.

> Unofficial third-party plugin. Not affiliated with or endorsed by any vendor.
> Cost figures are estimates; the official bill remains authoritative.

## Preview

The pill sits after the shipped activity/usage pills. Click it and each model has
its own tab — a tab only shows the billing dimensions that model actually has:

![Cost popover with the DeepSeek tab, K/M token counts, peak/off-peak rows and the official price link with its data date](docs/preview.png)

The gear in the title row opens the language and display-currency settings (see
[Settings](#settings)).

```text
Token 费用                              ¥2.32
──────────────────────────────────────────────
[ DeepSeek-V4.1-Flash ¥1.97 ] [ MiMo-V2.6-Pro ¥0.35 ]
──────────────────────────────────────────────
未命中缓存输入       288.3K        ¥0.29
缓存命中输入          44.2M        ¥0.88
输出                 198.2K        ¥0.79
Token 合计            44.7M
──────────────────────────────────────────────
高峰时段费用                        ¥0.00
空闲时段费用                        ¥1.97
```

The DeepSeek tab above shows cache-hit/miss buckets *plus* peak/off-peak time
bands, because DeepSeek bills by time of day. A flat-price vendor (MiMo, Qwen,
GLM, Kimi, ...) has a different tab that shows cache-hit/miss input and output
only, with a short note that the vendor has no peak/off-peak bands. Every tab
also discloses the price data date next to its official price link, so you can
tell how fresh the number is.

International models are billed in USD: their tabs show `$` amounts, and a mixed
session shows both currencies side by side (`¥2.32 · $0.14`) without ever adding
or converting them.

## Supported vendors

Prices are curated from each vendor's own official price page and refreshed with
releases — the DeepSeek catalog is the only one that also refreshes itself from
the official page in the background. Each vendor's source URL and read date are
in `catalog/china/notes/` and `catalog/world/notes/`. Chinese vendors are quoted
and billed in CNY:

| Vendor | Suggested DSH provider ids | Models | Official price source |
|---|---|---|---|
| DeepSeek | `deepseek-official`, `deepseek-account` | 2 | <https://api-docs.deepseek.com/zh-cn/quick_start/pricing> (auto-refresh) |
| 智谱 AI (GLM) | `zai` | 12 | <https://docs.bigmodel.cn/cn/guide/start/pricing> |
| 阿里云百炼 (Qwen) | `dashscope` | 22 | <https://help.aliyun.com/zh/model-studio/model-pricing> |
| 字节跳动火山方舟 (Doubao) | `volcengine` | 10 | <https://docs.volcengine.com/docs/ark/model-pricing> |
| 腾讯混元 (Hunyuan) | `hunyuan` | 7 | <https://cloud.tencent.com/document/product/1823/130055> |
| 百度智能云千帆 (ERNIE) | `qianfan` | 5 | <https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya> |
| 月之暗面 Kimi | `moonshotai-cn`, `moonshotai` | 4 | <https://platform.kimi.com/docs/pricing/chat> |
| MiniMax | `minimax-cn`, `minimax` | 2 | <https://platform.minimax.cn/docs/pricing/overview> |
| 阶跃星辰 StepFun | `stepfun` | 4 | <https://platform.stepfun.com/docs/zh/guides/pricing/details> |
| 商汤日日新 SenseNova | `sensenova` | 8 | <https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/pricing/> |
| 小米 MiMo | `xiaomi` | 3 | <https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go> |

International vendors are quoted and billed in USD (read 2026-10-20):

| Vendor | Suggested DSH provider ids | Models | Official price source |
|---|---|---|---|
| OpenAI | `openai` (also `azure`) | 19 | <https://developers.openai.com/api/docs/pricing> |
| Anthropic (Claude) | `anthropic` | 15 | <https://platform.claude.com/docs/en/about-claude/pricing> |
| Google Gemini | `google`, `google-vertex` | 10 | <https://ai.google.dev/gemini-api/docs/pricing> |
| xAI (Grok) | `xai` | 8 | <https://docs.x.ai/developers/pricing> |
| Mistral AI | `mistral` | 8 | <https://docs.mistral.ai/inference/pricing.md> |
| Cohere | `cohere` (hand-declared route) | 6 | <https://cohere.com/pricing> |

Provider ids are hints: a model is matched by its wire id first, then aliases
(including the ids DSH's pi-ai catalog actually ships, e.g. `mistral-medium-3.5`),
then documented snapshot prefixes, so any user-chosen pi-ai provider name still
matches its model. Models that are not in any catalog are shown as `未定价`
instead of being counted as free.

To use a foreign vendor you still need a route for it in your pi-ai config (the
`providers` entry in the profile patch with an API key); the plugin only prices
models that actually produce usage. See `catalog/world/notes/provider-map.md` for
the provider ids this DSH build ships and their model ids.

## How the cost is calculated

For every durable `assistant/message` / `assistant/attempt` usage sample:

```text
cost = Σ tokens_in_bucket × official_rate(bucket) × band_multiplier(timestamp)
```

- The four billing buckets are cache-hit input, cache-miss input, cache-write
  input and output. Reasoning tokens are already part of the output count and are
  not billed twice; a vendor with no separate cache-write price bills writes at
  the cache-miss rate.
- **DeepSeek** applies its official peak/off-peak time bands: peak on Beijing
  time (UTC+8) Monday–Friday 09:00–12:00 and 14:00–18:00 excluding Chinese
  statutory holidays, off-peak at 50% of peak otherwise. Vendors in
  `catalog/china/` and `catalog/world/` are flat-priced unless their data adds a
  `billing` block.
- Context-length tiered models use the tier that contains the request's prompt
  size (used by OpenAI long-context, xAI long-context, Gemini long-context,
  Claude Haiku 5.5 and some Chinese vendors).
- Currencies are never summed across each other by default: a session that uses
  both CNY and USD models shows `¥1.23 · $0.45`, and each model tab keeps its
  own currency. The optional display-currency setting converts amounts for
  display only, at a user-set FX rate; the stored totals and the official bill
  stay in the vendor's original currency.
- Samples are folded with the same replacement/retry rules as the shipped
  `tokenUsage` projection, so token totals match the built-in usage pill.

## Price data

- **DeepSeek** refreshes itself: at startup (from a local cache) and every 24
  hours it fetches <https://api-docs.deepseek.com/zh-cn/quick_start/pricing> and
  swaps the catalog for usage that happens afterwards. A network or layout
  failure keeps the previous catalog; a parsed ratio/window change is picked up
  when recognizable.
- **Other vendors** are curated data files under `catalog/china/` (CNY) and
  `catalog/world/` (USD). They are updated in this repository (see
  [Adding or updating a vendor](#adding-or-updating-a-vendor)), not fetched at
  runtime — so a price field can never be silently injected by a third-party
  page.
- Curated prices carry a read date. A few are promotional and will change (OpenAI
  GPT-5.6 Sol through at least 2026-11-21; Gemini 4 Argon through 2026-11-30;
  Gemini 3.8/3.6 Flash through 2026-12-31; Mistral Large 4 Public Preview). Each
  vendor note records the regular price and the change date.
- Already-counted tokens keep the cost they were charged at their own time; a
  refresh or a new release only changes later samples.
- No session content, token text, or identifiers are sent anywhere. The only
  outbound request is the DeepSeek price page GET, and `refresh: false` disables
  it.

## Install

Requirements: a DeepSeek Harness build with the Plugin Manager (`plugin_manager`
tool or the **Plugins** page), plus `git` and network access for a GitHub install.

```text
plugin_manager install_bundle target=github:ZombieStiffMann/dsh-token-cost
```

Pin a release:

```text
plugin_manager install_bundle target=github:ZombieStiffMann/dsh-token-cost#v0.1.0
```

For local development, point the manager at a checkout instead:

```text
plugin_manager install_bundle target=<absolute path to this directory>
```

Refresh the page after the first install so the new client module loads. Remove
or disable it later from the **Plugins** page (or
`plugin_manager remove_bundle target=dsh-token-cost`).

## Settings

Inside the cost popover, the gear button in the title row opens a small settings
panel (bilingual, following the plugin language):

- **Language**: 跟随应用 / 中文 / English. The plugin ships zh and en
  dictionaries; *follow the app* is the default, and the override applies to
  every string immediately.
- **Display currency**: 原币种 / CNY ¥ / USD $. *Native* is the default: each
  model tab and the pill show the money in the vendor's own currency, and a
  mixed session shows both currencies side by side without conversion. Choosing
  CNY or USD converts every displayed amount at the configured rate and shows a
  single total.
- **Exchange rate**: CNY per 1 USD (default 7.20), editable. Conversion is a
  **display-only estimate** at a user-set rate — it never changes the Host's
  accounting, the stored per-currency totals, or the official bill. The dialog
  shows the active rate next to an `estimate` label.

Preferences are stored in the browser (`localStorage` key
`dsh-token-cost.settings.v1`) and survive reloads. The plugin still registers
both locales, so the default follows the Harness language.

## Configuration

Override the `token-cost` row in the profile patch layer
(`%DSH_PROFILE_DIR%\cordis.patch.yml`; it is applied after every bundle layer).
Every field is optional; explicit model entries win over curated and fetched
prices.

```yaml
- id: token-cost
  name: 'dsh-token-cost'
  config:
    # DeepSeek official-page refresh (the other vendors are repo-curated data)
    refresh: true            # false = cached/built-in catalog only
    refreshHours: 24         # 1..168
    priceUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing'

    # Override a catalog model by its wire id (inherits unset rate keys), or add
    # a model that no catalog covers, e.g. another provider:
    models:
      deepseek-flash:
        rates: { cacheMiss: 2, cacheHit: 0.04, output: 8 }
      my-custom-model:
        name: My Custom Model
        rates: { cacheMiss: 10, cacheHit: 1, output: 20 }
        currency: { code: CNY, symbol: '¥' }
        source: 'https://example.com/pricing'
      my-usd-model:
        name: My USD Model
        rates: { cacheMiss: 3, cacheHit: 0.3, output: 15 }
        currency: { code: USD, symbol: '$' }
        source: 'https://example.com/usd-pricing'

    # Global id aliases (wire id -> catalog model id) and a fallback price
    aliases: { my-alias: glm-4.6 }
    fallbackModel: deepseek-v4-pro

    # DeepSeek time bands (Beijing wall clock, [startMinute, endMinute))
    peakWindows: [[540, 720], [840, 1080]]
    offPeakMultiplier: 0.5
    timeZoneOffsetMinutes: 480
    additionalHolidays: ['2027-01-01']
```

The 2026 Chinese statutory holidays are built in (国办发明电〔2025〕7号). Add
future dates with `additionalHolidays` once announced.

## Adding or updating a vendor

The catalog is plain data, one file per vendor:

1. Copy `catalog/china/_template.js` to `catalog/china/<vendor>.js` (CNY) or to
   `catalog/world/<vendor>.js` (USD) and fill in `vendor`, display names, the
   official `source` URL, `asOf`, `providers`, and the models with their rates.
   Read `catalog/china/SCHEMA.md` and `catalog/world/SCHEMA.md` first; the
   directory decides the currency (`china/` = CNY/¥, `world/` = USD/$).
2. Add `catalog/china/notes/<vendor>.md` or `catalog/world/notes/<vendor>.md`
   with the source URLs, read date, what was included/excluded and why.
3. Run `npm run validate:catalog` and `npm test`. The validator checks both
   directories, rejects malformed rates, dates, windows, duplicate ids, a
   rates/tiers conflict and a wrong currency for the directory.
4. Open a PR. Never guess a price: leave a model out (it then shows `未定价`)
   rather than publishing an unverified number.

## Development

| path | role |
|---|---|
| `index.js` | Host half: `tokenCost` projection, per-sample pricing, DeepSeek refresh/cache |
| `pricing.js` | DeepSeek catalog defaults, config normalization, band rules |
| `cost-catalog.js` | Runtime catalog: curated vendors + DeepSeek + user overrides/aliases/fallback |
| `catalog/index.js` | Sync loader/normalizer for `catalog/china/*.js` + `catalog/world/*.js` |
| `catalog/lookup.js` | Provider → model id → alias → prefix matching, tier selection |
| `catalog/validate.js` | Data-contract validator and loader core (both directories) |
| `catalog/china/` | Curated CNY vendor price data + evidence notes per vendor |
| `catalog/world/` | Curated USD vendor price data + evidence notes + provider map |
| `client.js` | Client half: cost pill and per-model tabbed breakdown dialog |
| `cordis.patch.yml` | Bundle patch that inserts the Host `token-cost` row |
| `test/` | Host fold, official-page parser, catalog engine and client render tests |

Run everything offline (Node 20+; CI runs 20/22/24):

```bash
npm test                 # all suites
npm run test:fold        # pricing fold, bands, retries/replacements, multi-currency
npm run test:parser      # DeepSeek official-page parser against a minimized fixture
npm run test:catalog     # catalog loader/validator + multi-vendor lookup engine
npm run test:component   # renders the real client.js in a DOM-less stub
npm run validate:catalog # data contract check for catalog/china + catalog/world
```

No dependencies, no build step: everything ships as plain ESM/JS.

## Compatibility

- Tested with DeepSeek Harness **0.2.1-rc.2** (desktop, Windows 11, Web UI).
- Uses only documented plugin surfaces: a Host session projection
  (`ctx.sessionProjections`) and one `conversation.composer.dock` slot entry.
- Harness is in developer preview, so plugin APIs may change between releases.

## Limitations

- Estimates only. The official bill remains authoritative, and prices change —
  curated data carries its `asOf` date and is updated by releases.
- **Currency conversion is display-only.** Choosing CNY or USD in the settings
  converts amounts at a rate you enter (default 1 USD = 7.20 CNY); it is not a
  bank/card rate and does not change the stored per-currency totals or the
  official bill. Use 原币种 (native) when you need the vendor's exact currency
  amounts.
- **Batch / flex / priority / fast / subscription plans are not modelled.** The
  catalog holds the vendor's standard pay-as-you-go online price (batch calls are
  often 50–60% of it); coding/token plans are subscriptions, and their per-token
  cost is not comparable.
- **Foreign vendors only price what your pi-ai config actually routes.** A vendor
  with no route/API key produces no usage to price; the catalogue still works for
  models routed through any provider name (matched by wire id).
- **Reseller/enterprise routes can differ.** The USD prices are the vendor's own
  first-party API list; Azure, Amazon Bedrock, Google Vertex, OpenRouter and other
  gateways may bill different rates, so a model routed through them is priced at
  the first-party list price. The `azure` provider hint is only a best effort.
- **Free models are not representable yet**: a ¥0 / $0 model shows as `未定价`
  rather than `¥0.00`.
- Some vendors publish two-dimensional prices (input-length × output-length) or
  split thinking/non-thinking output prices; the catalog uses one bracket
  (documented in the vendor note), so edge cases can differ by a constant factor.
- Some model ids are inferred from a vendor's documented naming pattern; an
  unknown id simply stays `未定价`.
- **Foreign caching nuances**: Anthropic cache writes use the standard 5-minute
  TTL price (the 1-hour TTL is 2× input and cannot be represented by one number);
  Gemini context-cache storage is billed per token-hour and is not modelled; xAI
  has no cache-write price, so writes bill as normal input. Provider-reported
  cache-read tokens are priced with the vendor's published cached-input rate.
- Promotional prices are encoded as currently effective; the vendor note records
  the regular price and the advertised change date (e.g. Gemini 4 Argon through
  2026-11-30, OpenAI GPT-5.6 Sol through at least 2026-11-21, Mistral Large 4
  Public Preview).
- Dynamic aliases (`chat-latest`, `gemini-flash-latest`, ...) can re-point to a
  different snapshot at any time; they are either included with a note or left
  `未定价` instead of guessing.
- 讯飞星火 is not included yet: its official pages show conflicting live/static
  discounts. See `catalog/china/notes/xunfei.md`; PRs with a verified id + price
  are welcome.
- A fork's inherited prefix is included in the fork's cost, matching the shipped
  `tokenUsage` projection.
- Tokens consumed before 2026-08-16 (when DeepSeek's peak/off-peak pricing
  started) are priced with the current table and band rule by design.

## License

[MIT](LICENSE) © 2026 zombiestiffmann.

DeepSeek, Qwen, GLM, Kimi, Doubao, Hunyuan, ERNIE, MiniMax, StepFun, SenseNova,
MiMo, OpenAI, ChatGPT, Claude, Anthropic, Gemini, Google, Grok, xAI, Mistral,
Cohere and related marks belong to their owners. Official price data is
reproduced only as short facts (rates + source links) to compute estimates.
