# Google Gemini — 证据笔记

- 读取日期：2026-10-20（北京日期）；价格页标注 Last updated 2026-10-16 UTC
- 价格来源：<https://ai.google.dev/gemini-api/docs/pricing>（Gemini Developer API pricing，Paid Tier，per 1M tokens in USD）
- 模型 ID 来源：<https://ai.google.dev/gemini-api/docs/models>（各模型表的 Endpoint 列 + 模型详情页）
- 生命周期来源：<https://ai.google.dev/gemini-api/docs/deprecations>（Shutdown date）
- 抓取方式：直接读取官方文档页面内嵌的 HTML 表格（服务端渲染），未使用第三方转述。

## 收录范围（10 个）

取自「Standard / 标准实时」价表的文本 chat 模型：

| 模型（页面名） | wire id | 输入 | 输出 | 缓存命中 |
| --- | --- | --- | --- | --- |
| Gemini 4 Argon | `gemini-4-argon` | $2.00* | $10.00* | $0.10* |
| Gemini 3.8 Flash | `gemini-3.8-flash` | $0.75* | $3.75* | $0.075* |
| Gemini 3.6 Flash | `gemini-3.6-flash` | $0.75* | $3.75* | $0.075* |
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | $0.30 | $2.50 | $0.03 |
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | $0.25 | $1.50 | $0.025 |
| Gemini 3.1 Pro Preview | `gemini-3.1-pro-preview` | $2.00 / $4.00（>200k） | $12.00 / $18.00 | $0.20 / $0.40 |
| Gemini 3 Flash Preview | `gemini-3-flash-preview` | $0.50 | $3.00 | $0.05 |
| Gemini 2.5 Pro | `gemini-2.5-pro` | $1.25 / $2.50（>200k） | $10.00 / $15.00 | $0.125 / $0.25 |
| Gemini 2.5 Flash | `gemini-2.5-flash` | $0.30 | $2.50 | $0.03 |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | $0.10 | $0.40 | $0.01 |

（单位：USD / 百万 tokens；`*` 为限时价，见下。）

**未收录（原因）**

- Live/实时音频模型：Gemini 3.8 Live、3.8 Live Extended Thinking、3.1 Flash Live；语音翻译/转写（3.5 Live Translate / 3.5 Transcribe）。
- 音频生成：3.8 Flash TTS、3.8 Flash-Lite TTS、3.1 Flash TTS、2.5 Flash/Pro TTS、2.5 Flash Native Audio。
- Gemini Omni Flash（页面归类为生成式视频模型：视频生成/编辑等）。
- 图像模型（Nano Banana 2.1 / 2 / 2 Lite / Pro）、Veo 3.1、Lyria、Gemini Embedding 2、Gemini Robotics、Gemma 4（Paid Tier 无价格）、Gemini Deep Research / 托管 agent。
- 已关停（deprecations 页 Shutdown date 已过或标记 Shut down）：Gemini 2.0 系列、Gemini 3 Pro Preview、各旧 preview 等。

## 限时价格（重要）

- **Gemini 4 Argon**：$2.00 / $10.00 / 缓存 $0.10，有效期至 **2026-11-30**；**2026-12-01 起**为 $4.00 / $20.00 / 缓存 $0.20。catalog 采用当前（今天）的限时价。
- **Gemini 3.8 Flash、Gemini 3.6 Flash**：$0.75 / $3.75 / 缓存 $0.075，有效期至 **2026-12-31**；**2027-01-01 起**为 $1.50 / $7.50 / 缓存 $0.15。同样采用当前限时价。
- 其余收录模型为表内固定价，无到期日。

## 缓存

- `cacheHit` = 官方 "Context caching price"（缓存输入价），逐模型直接给出；未做换算。
- **上下文缓存存储费另计**：显式缓存按 `$X / 1,000,000 tokens per hour` 收存储费（3.8/3.6 Flash 现为 $0.50/h、2027-01-01 起 $1.00/h；3.5/3.1 Flash-Lite、3 Flash、2.5 Flash/Flash-Lite 为 $1.00/h；3.1 Pro 与 2.5 Pro 为 $4.50/h）。该费用不是 per-token，schema 无法建模，未收录。
- **Gemini 4 Argon 仅支持隐式缓存**（不支持显式缓存），因此没有存储费；其缓存命中价 $0.10（12-01 起 $0.20）。
- 没有 per-token 的显式缓存写入价，`cacheWrite` 省略（插件回退按 cacheMiss 计）。

## 长上下文 / tiers

- **Gemini 3.1 Pro Preview** 与 **Gemini 2.5 Pro** 按单次请求提示长度分档：`prompts <= 200k tokens` 与 `prompts > 200k tokens`。catalog 用 `tiers`：200000 / 1048576（第二档上限取模型详情页的 Input token limit 1,048,576；超过 1M 的请求会被 API 拒绝）。
- 其余收录模型为单一价格档，用 flat `rates`。

## 未建模的价格档 / 费用

- **Batch**：约为 Standard 5 折；**Flex**：与 Batch 同价；**Priority**：约为 Standard 1.8×；**Contributor**（允许用数据改进产品）：约为 Standard 5 折。catalog 只放 Standard 实时价。
- 音频/视频等多模态输入的单独价格（如 3.1 Flash-Lite 音频 $0.50、3 Flash Preview 音频 $1.00、2.5 Flash 音频 $1.00、2.5 Flash-Lite 音频 $0.30；3.5 Flash-Lite 音频与文本同价）未建模，catalog 取文本输入价。
- Grounding with Google Search/Maps、URL context、code execution、File Search 等工具费用未建模。
- 输出价已包含 thinking tokens（官方列名 "Output price (including thinking tokens)"）。

## 别名

- 官方 models 页只公布各模型的精确 endpoint（如 `gemini-3.8-flash`），本文件全部使用该 endpoint 作为 `id`。
- models 页说明命名约定里有 `latest` 别名（如 `gemini-flash-latest`）和 dated preview（如 `gemini-2.5-flash-preview-09-2025`），但没有公布 `latest` 别名与具体模型的映射，因此未写入 `aliases` / `matchPrefixes`。
- `gemini-3.1-flash-lite` 已公布 shutdown date 2027-05-07，但当前仍是 Stable 在售，故收录；`gemini-3.1-pro-preview`、`gemini-3-flash-preview` 为 Preview（无 shutdown date）。

## 备注

- 价格为官方 Paid Tier 列表价；Google AI Studio 内的使用免费，不反映 API 账单。
- `asOf` 为读取日期；限时价的到期日见上，Lead 更新 catalog 时需留意 2026-12-01 / 2027-01-01 的调价。
