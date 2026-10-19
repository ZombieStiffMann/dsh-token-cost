# Anthropic（Claude）— 证据笔记

- 读取日期：2026-10-20（北京日期）
- 价格来源（官方文档）：<https://platform.claude.com/docs/en/about-claude/pricing>
  - `https://docs.anthropic.com/en/docs/about-claude/pricing` 与 `https://www.anthropic.com/pricing` 均会重定向到官方页面；模型价格表取自 platform.claude.com 的 Pricing → Model pricing（同一张表也出现在 claude.com/pricing 的 API 区）。
- 模型 ID / 生命周期来源：
  - <https://platform.claude.com/docs/en/about-claude/models/overview>
  - <https://platform.claude.com/docs/en/about-claude/model-deprecations>（Model status 表，Active/Deprecated/Retired）
  - <https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions>
  - 各模型的 overview 页（`/docs/en/models/<slug>/overview`，其中 "Model IDs → Claude API" 即 wire id）
- 抓取方式：直接读取官方文档页面内嵌的表格与文本（服务端渲染 / RSC 数据），未使用第三方转述。

## 收录范围（15 个）

- 最新一代（docs 侧边栏 Latest models）：`claude-fable-5-1`、`claude-opus-5-5`、`claude-sonnet-5-5`、`claude-haiku-5-5`。
- 专用模型（Specialized models，需通过 Anthropic 验证计划，价格与对应 Fable 相同）：
  `claude-mythos-5-1`（同 Fable 5.1）、`claude-mythos-5`（同 Fable 5）。catalog 收录并在 model notes 中注明访问限制。
- 较早但仍在售（docs 侧边栏 Legacy models，Model status 均为 Active）：
  `claude-fable-5`、`claude-opus-5`、`claude-opus-4-8`、`claude-opus-4-7`、`claude-opus-4-6`、
  `claude-opus-4-5-20251101`（alias `claude-opus-4-5`）、`claude-sonnet-5`、`claude-sonnet-4-6`、
  `claude-haiku-4-5-20251001`（alias `claude-haiku-4-5`）。

**未收录（原因）**

- `claude-sonnet-4-5-20250929`：Model status 标为 Deprecated（2026-09-30），并将于 2026-11-30 退役，已有推荐替代 `claude-sonnet-5-5`，故不收录。
- 已 Retired：`claude-opus-4-1-20250805`、`claude-opus-4-20250514`、`claude-sonnet-4-20250514`、
  `claude-3-5-haiku-20241022`、`claude-3-haiku-20240307`，以及 `claude-mythos-preview`（Deprecated）。
- Claude API 没有 embedding/图像/音频/TTS/视频类 per-token 模型；Claude in AWS（CCU）、Claude in Microsoft Foundry（CCU）、Amazon Bedrock / Google Cloud 的转售定价为独立计费，未建模。

## 计价口径

- 表内单位即 USD / 百万 tokens（MTok），直接采用。
- 模型 ID：4.6 代及以后 `claude-xxx-y-z`（无日期）是钉死的正式模型 ID（不是 evergreen 别名）；更早的模型用带日期的快照 ID（如 `claude-opus-4-5-20251101`），官方同时提供更短别名（`claude-opus-4-5`、`claude-haiku-4-5`），已放入 `aliases`。没有其它已公布的 dated snapshot 需要列 alias。
- 思考 token 按 output 价计费（官方输出价已包含 thinking）；`output` 无需另加。

## 缓存

- `cacheWrite` = **5 分钟缓存写入价**（官方表 "5m writes"，约为 input 的 1.25×）。
- **1 小时缓存写入**为 input 的 2×（官方单独列出，如 Fable 5.1 $20、Opus 5.5 $8、Sonnet 5.5 $4、Haiku 5.5 高档 $1）。schema 只有一个 `cacheWrite`，未编码 1h 变体，使用时按 5m 价；需要 1h 计费时人工按 input×2 修正。
- `cacheHit` 为官方 "Hits and refreshes" 价：通常为 input 的 0.1×；例外（官方明示）：Fable 5.1 / Mythos 5.1 为 0.025×（$0.25），Opus 5.5 / Sonnet 5.5 为 0.05×（$0.20 / $0.10）。catalog 使用官方表逐模型给出的绝对值。

## 长上下文

- 官方说明：**Claude 4.6 及以后模型（Claude Haiku 5.5 除外）** 的完整 1M context 均按标准价计费（900k 请求与 9k 请求同单价），catalog 用 flat `rates`。
- **Claude Haiku 5.5 按单次请求提示长度分档**：提示 ≤100,000 tokens 与 >100,000 tokens 两档价格不同；提示长度计入所有输入 token（包括 cache read/write）。catalog 用 `tiers`：100000 / 1000000（上限取官方 model overview 的 1M context window）。
- Claude Opus 4.5（4.5 代，早于 4.6）价格表为单一档，无长上下文加价。

## 其它未建模的价格档

- Batch API：input/output 均 5 折（catalog 用标准价）。
- Fast mode（Opus 5.5 / Opus 5 / Opus 4.8）：$8/$40（Opus 5.5）、$10/$50（Opus 5/4.8），为加速档，未建模。
- 数据驻留（`inference_geo` 指定 US-only）：所有 token 类别（含 cache read/write）1.1×，未建模；默认 global routing 为标准价。
- 云平台转售（Amazon Bedrock / Google Cloud / Claude Platform on AWS / Microsoft Foundry）为独立定价或 CCU 计费，未建模。

## 备注

- 价格页未给生效日期；`asOf` 为读取日期。官方模型页标注的退役承诺（最早 2027 年）不影响当前价格。
