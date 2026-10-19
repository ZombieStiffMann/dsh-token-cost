# Cohere — 价格证据

- **读取日期**: 2026-10-20（北京日期）
- **价格页**: https://cohere.com/pricing
  （渲染后的页面含：模型卡列表、Model Vault 实例价、FAQ。逐 token 的 USD 价格出现在模型卡的
  Input/Output 行与 FAQ 的旧模型/研究模型说明中。）
- **模型 ID / 在售状态 / 单价交叉核对（Cohere 官方文档）**:
  - https://docs.cohere.com/docs/models — 各模型 Status（Live / Deprecated）与 Model Name
  - https://docs.cohere.com/docs/command-a 、/docs/command-a-plus 、/docs/command-r 、
    /docs/command-r-plus 、/docs/command-r7b 、/docs/aya-expanse — 每页 “Pricing Input/Output $x / 1M tokens”
    与 “Model ID”
  - 官方模型页把各 Command 模型单价与 pricing 页 FAQ 对齐（如 Command R+ 08-2024 $2.50/$10.00；
    Aya Expanse $0.50/$1.50）。

## 收录（6 个，美元/百万 tokens，标准实时价）

| 模型 | wire model id | Input | Output | 依据 |
| --- | --- | --- | --- | --- |
| Command A | `command-a-03-2025` | $2.50 | $10.00 | 官方模型页 pricing；pricing 页模型卡同一价位 |
| Command A+ | `command-a-plus-05-2026` | $2.50 | $10.00 | cohere.com/pricing 模型卡（见下方注意） |
| Command R+ (08-2024) | `command-r-plus-08-2024` | $2.50 | $10.00 | 官方模型页 pricing + pricing 页 FAQ |
| Command R (08-2024) | `command-r-08-2024` | $0.15 | $0.60 | 官方模型页 pricing |
| Command R7B (12-2024) | `command-r7b-12-2024` | $0.0375 | $0.15 | 官方模型页 pricing |
| Aya Expanse 32B | `c4ai-aya-expanse-32b` | $0.50 | $1.50 | pricing 页 FAQ（Aya Expanse 8B/32B on the API 同价） |

- **缓存价**：Cohere 的价格页与模型文档只列 Input/Output，无 cached-input/cache-write 公开单价 →
  按契约把输入价同时用于 `cacheHit` 与 `cacheMiss`，不填 `cacheWrite`。
- **Command A+ 注意**：cohere.com/pricing 的 Command A+ 模型卡列出 Input $2.50 / Output $10.00，但
  官方模型页（docs.cohere.com/docs/command-a-plus）写 “For both trial keys and production keys,
  Command A+ is free until rate limits are reached… can be used in production through Cohere's Model
  Vault”。即该 $2.50/$10 是否适用于生产 API 调用未核实（很可能是 Command A 的价位）。目录按
  pricing 页收录并在 note 标注，Lead 可决定是否移除。
- **Aya Expanse 8B**：pricing 页 FAQ 说 8B 与 32B 同价，但官方模型页仅核实到 32B 的 wire id
  （`c4ai-aya-expanse-32b`），8B 的精确 id 未核实 → 只收录 32B。

## 未收录及原因

- **Command A Reasoning / Command A Vision / Command A Translate**（`command-a-reasoning-08-2025`、
  `command-a-vision-07-2025`、`command-a-translate-08-2025`）：状态 Live，但官方模型页写
  trial/production key “free until rate limits are reached”，生产接入需联系 sales / 走 Model Vault，
  没有公开的 per-token USD 单价 → 不收录。
- **North Small Translate / North Mini Code**（`north-small-translate-09-2026`、`north-mini-code-1-0`）：
  Live（API 评测用），pricing 页无 per-token 价格 → 不收录。
- **旧版 Command / Command-light / Command R 03-2024 / Command R+ 04-2024**：状态 Deprecated
  （2025-09-15 起），pricing 页的旧价列表写 “For existing customers” → 不是当前在售价，不收录。
- **Embed 4/5、Rerank 4、Parse 5、Transcribe、Aya Vision/Tiny Aya**：非文本/chat token 模型
  （embedding、rerank、解析、语音等），或未公布 per-token USD 价 → 不收录。
- **Model Vault / North 平台**：按实例小时/月计费（pricing 页：Small $3.00/hr / $2,000/mo 等），
  不是 per-token，本目录不建模。

## 数据缺口

- pricing 页没有渲染出完整的逐模型 API 价格表（Command A+ 卡是唯一带 USD/token 价格行的当前模型卡）；
  本目录的其他 Command 价格来自 Cohere 官方文档模型页（仍是厂商自有官方来源），逐项 URL 见上。
  若要求“价格只能来自 cohere.com/pricing 本身”，则仅 Command A+ 与 Aya Expanse (FAQ) 可保留。
