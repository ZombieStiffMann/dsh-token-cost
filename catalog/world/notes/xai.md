# xAI (Grok) — 证据笔记

- 读取日期：2026-10-20（北京日期）
- 价格来源（官方）：
  - <https://docs.x.ai/developers/pricing>（xAI 官方 API 定价页 “Text API” 表；标准价与长上下文价均逐字读取）
  - <https://docs.x.ai/docs/models> 现 308 跳转到 <https://docs.x.ai/developers/models>（模型页入口）
  - 各模型页 `.../developers/models/<id>`（Model ID、Aliases、Context window、Pricing 明细）
  - 缓存计费：<https://docs.x.ai/developers/advanced-api-usage/prompt-caching/usage-and-pricing>
  - 下线说明：<https://docs.x.ai/developers/migration/may-15-retirement>

## 收录范围（8 个，均为当前 Text API 定价表所列模型）

| 模型 id | 上下文 | 单价（input / cached / output，USD/1M） | 长上下文（>200K） |
| --- | ---: | --- | --- |
| `grok-4.7` | 500,000 | 2.00 / 0.50 / 6.00 | 4.00 / 1.00 / 12.00 |
| `grok-4.6` | 500,000 | 2.00 / 0.50 / 6.00 | 4.00 / 1.00 / 12.00 |
| `grok-4.5` | 500,000 | 2.00 / 0.30 / 6.00 | 4.00 / 0.60 / 12.00 |
| `grok-4.3` | 1,000,000 | 1.25 / 0.20 / 2.50 | 2.50 / 0.40 / 5.00 |
| `grok-4.20-0309-reasoning` | 1,000,000 | 1.25 / 0.20 / 2.50 | 2.50 / 0.40 / 5.00 |
| `grok-4.20-0309-non-reasoning` | 1,000,000 | 1.25 / 0.20 / 2.50 | 2.50 / 0.40 / 5.00 |
| `grok-4.20-multi-agent-0309` | 1,000,000 | 1.25 / 0.20 / 2.50 | 2.50 / 0.40 / 5.00 |
| `grok-build-0.1` | 256,000 | 1.00 / 0.20 / 2.00 | 2.00 / 0.40 / 4.00 |

- `aliases` 全部取自各模型页的 “Aliases” 段（如 `grok-4.20` → reasoning 版；`grok-4.5-latest`、
  `grok-build-latest`、`grok-code-fast-1` 等）；未自行编造别名。
- `grok-4.7` / `grok-4.6` 模型页无 Aliases 段，故不填 aliases。

## 长上下文（tiers）

- 模型页写 “Higher context pricing: 请求超过 200K context window 时适用”；定价页列头写
  “Long context ≥ 200k tokens”。两处表述在恰好 200K 处略有出入，catalog 取
  `maxInputTokens = 200000` 为短档上限、上下文档上限＝各模型 context window。
- 长上下文价对**整请求**适用：官方说明 “bill the long context rates for all tokens in a request
  once its prompt reaches the model's long context threshold”；缓存与非缓存 token 都按长上下文价。

## 缓存与推理 token

- 无单独的 cache-write 价：缓存文档只区分 “Cached prompt tokens / 未缓存 prompt tokens”，
  写入按普通 prompt token 价计费，故省略 `cacheWrite`（插件回退 cacheMiss，等价）。
- 推理 token 按 completion（output）价计费（缓存页 Token type 表：Reasoning tokens → Full completion
  token price），已含在 `output` 中。
- 未建模：Priority Processing 为 2x；美国区域端点（`us.api.x.ai`）为 1.1x；Batch API 仅对
  `grok-4.3` 与 `grok-4.20-*` 开放且为 20% 折扣（4.7/4.6/4.5/build 不支持 Batch）；
  Grok 4.7 Fast 仅存在于 Cursor/Grok Build，不对公开 API 出售。

## 未收录（原因）

- 已下线（2026-05-15 retirement）：`grok-4-1-fast-reasoning`、`grok-4-1-fast-non-reasoning`、
  `grok-4-fast-reasoning`、`grok-4-fast-non-reasoning`、`grok-4-0709`、`grok-3` 等；旧 slug 会被路由到
  `grok-4.3`/`grok-build-0.1`，仅 `grok-code-fast-1` 系列作为 `grok-build-0.1` 的官方别名保留。
- 非文本类别：Imagine（图像/视频）、Voice（STS/TTS/STT）、Embedding 等按次/秒/字符/小时计价，不属 token
  文本模型目录。
- 定价页 “Imagine / Voice API” 与 “Tools / Files & Collections” 等价格为工具/存储/调用计费，未建模。
