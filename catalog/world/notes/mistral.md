# Mistral AI — 价格证据

- **读取日期**: 2026-10-20（北京日期，见任务要求）
- **价格表（实际读取来源）**: https://docs.mistral.ai/inference/pricing.md
  Mistral 官方文档 “API pricing”，按 family 列出模型 API name 与美元/百万 tokens 单价。
- **公开定价页**: https://mistral.ai/pricing
  （2026-10-20 实际渲染的是 Vibe / Studio 订阅套餐页 + API 计费 FAQ；其 FAQ 写 “Mistral Large costs
  $0.5 /M tokens in and $1.5 /M tokens out”，与文档价格表 Mistral Large 3 一致。API 的完整分模型
  价目表在官方文档的 pricing 页，故文件 `source` 取文档价目表 URL。）
- **模型 API name 与生命周期**: https://docs.mistral.ai/models.md（GA / Public Preview / Deprecated /
  Retired 状态与 `API name` 列；以 API name 作为目录 `id`）

## 收录（8 个，美元/百万 tokens，标准实时价）

| 模型 | API name | Input | Cached input | Output | 备注 |
| --- | --- | --- | --- | --- | --- |
| Mistral Large 4 | `mistral-large-4` | $1.36（现促销 $0.68） | $0.14（促销 $0.07） | $4.18（促销 $2.09） | Public Preview；目录取现促销价 |
| Mistral Large 3 | `mistral-large-2512` | $0.5 | 无公布 | $1.5 | GA |
| Mistral Medium 3.5 | `mistral-medium-3-5` | $1.5 | 无公布 | $7.5 | GA |
| Mistral Small 4 | `mistral-small-2603` | $0.15 | 无公布 | $0.6 | GA |
| Ministral 3 14B | `ministral-14b-2512` | $0.2 | 无公布 | $0.2 | GA |
| Ministral 3 8B | `ministral-8b-2512` | $0.15 | 无公布 | $0.15 | GA |
| Ministral 3 3B | `ministral-3b-2512` | $0.1 | 无公布 | $0.1 | GA |
| Codestral | `codestral-2508` | $0.3 | 无公布 | $0.9 | 代码补全/FIM 模型 |

- **缓存价**：价目表只对 Mistral Large 4 公布 cached input 价；其余模型只列单一 Input 价，按契约把
  输入价同时用于 `cacheHit` 与 `cacheMiss`，不填 `cacheWrite`（官方无 cache-write 单价）。
- **促销价**：Mistral Large 4 价格表明确写 “sale price, regular $1.36 / $0.14 / $4.18”，目录取当前促销价
  并在模型 note 说明原价；官方未给促销结束日期。
- **Batch / Priority**：pricing 页 FAQ 说 batch 处理打 5 折（另有 Priority Tier），不属于标准实时价，
  本目录不建模，仅在此说明。

## 未收录及原因

- **第三方托管模型**（如 `zai-glm-5-3`）：经 Mistral 托管但不属于 Mistral 自有模型，不收录。
- **非 token 计费**：OCR 4.1（$/千页）、Voxtral Mini Transcribe 2（$/分钟）、Voxtral TTS（$/百万字符）、
  Mistral Moderation 2（免费）——不属文本/chat per-token 目录。
- **Embedding 模型**：Codestral Embed（`codestral-embed-2505`，$0.15/百万 tokens，embedding 用途）不收录。
- **Deprecated / Retired**（models.md 状态列，含 deprecation/retirement 日期）：Mistral Medium 3.1、
  Mistral Medium 3、Mistral Medium 1.0、Mistral Large 2.1、Pixtral Large、Pixtral 12B、Mistral Nemo 12B、
  Devstral 2 / Devstral Medium 1.0 / Devstral Small 1.0、Magistral 各版本、Ministral 3B/8B（2024 代）、
  Mistral Small 3.x / 2.0 / 1.0、Mistral 7B 等——均已下架或退休，不收录。
- **`-latest` 别名**（如 pi-ai 目录里的 `mistral-large-latest`）未在官方 API name 列中作为独立价目出现，
  本目录不写 `aliases`；是否等价需另行核对官方 API 文档（unverified）。

## 与 DSH 内置 pi-ai 目录的差异（供 Lead 复核）

本机 DSH 桌面版 app.asar 内 pi-ai 的 `mistral` 目录（api.mistral.ai，40 个 id）中，`Mistral Medium 3.5`
写作 **`mistral-medium-3.5`（点号）** 且另有 `mistral-medium-2604`，而官方 API name 是
`mistral-medium-3-5`。目录按官方 wire id 记录；若要按 pi-ai 目录 id 计价，需要 alias/映射（见
`notes/provider-map.md`）。
