# OpenAI — 证据笔记

- 读取日期：2026-10-20（北京日期）
- 价格来源（官方）：
  - <https://developers.openai.com/api/docs/pricing>（OpenAI API 官方定价页，本文件所有标准价均来自此页；
    同页的 Markdown 版 `.../pricing.md` 含完整 "Standard" 表的短/长上下文档，逐字读取）
  - <https://openai.com/api/pricing/>（营销站上的同一定价入口；对自动抓取返回 403/JS 渲染，
    `platform.openai.com/docs/pricing` 会跳到上面 developers 页，故以 developers 页为准）
- 模型 ID / 上下文 / 快照（aliases）来源：
  - <https://developers.openai.com/api/docs/models>（完整模型目录）与各模型页 `.../api/docs/models/<id>.md`
  - 每个模型页的 "Model ID"、"Snapshots"、"Maximum input tokens"、"Pricing → Text tokens" 段
- 生命周期 / 停用来源：<https://developers.openai.com/api/docs/deprecations>

## 收录范围（19 个）

按官方标准（Standard，实时）价收录当前在售、未宣布停用的文本/聊天模型：

- 最新旗舰：`gpt-6-astra`、`gpt-6.1-sol`、`gpt-6-luna`、`gpt-6-sol`。
- GPT-5.6 代：`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`、`gpt-5.6-cyber`（Cyber 需 Daybreak 计划获批）。
- GPT-5.5 代：`gpt-5.5`、`gpt-5.5-pro`、`gpt-5.5-cyber`（仅限 Daybreak 计划；官方无公开模型页，价格取自定价页）。
- GPT-5.4 代：`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.4-pro`。
- GPT-5.2 代：`gpt-5.2`、`gpt-5.2-pro`。
- 专用：`chat-latest`（ChatGPT 最新 Instant 模型的滚动别名，API 可调用）。
- 生命科学（trusted-access 计划，仅限获批机构）：`gpt-rosalind-research`、`gpt-rosalind-discovery`
  （官方无公开模型页，wire id 与价格取自定价页 Life sciences 表）。

## 未收录（原因）

- **已宣布停用（deprecated，有 shutdown date）**：`gpt-5.3-codex`（2027-04-01）、`gpt-5.4-nano`（2027-04-01）、
  `gpt-5.1`（2027-04-01）、`gpt-4o` / `gpt-4o-mini` / `gpt-4.1` / `gpt-4.1-mini`（2027-01-14）、
  `gpt-5*` 旧快照与 `o3` / `o3-pro`（2026-12-11）、`gpt-3.5-turbo`/`gpt-4`/`gpt-4-turbo`/`gpt-4.1-nano`/
  `gpt-4o-2024-05-13`/`o1`/`o1-pro`/`o3-mini`/`o4-mini`（2026-10-23）等。
- **已下线（shutdown 已过）**：`babbage-002`、`davinci-002`、`gpt-3.5-turbo-instruct`、`gpt-3.5-turbo-1106`
  （2026-09-28）等；定价页仍保留其历史价格，但不属于当前在售模型。
- **非文本/聊天类别**：Embedding、Moderation、Image、Audio/Realtime、TTS、Transcription、Video 模型。
- **无按 token 公开 API 价格**：open-weight 的 `gpt-oss-20b/120b`、fine-tuned 模型价（仅存量用户）、
  `gpt-5-search-api`（Search 类别专用接口）、deep-research 模型。

## 长上下文（tiers）

- 官方规则：**提示词超过 272K input tokens 时，整请求按 2x input/cache、1.5x output 计价**
  （部分模型写作 ">272K"）。catalog 用 `tiers`：
  - 短档 `maxInputTokens = 272000`（即 ≤272K）；
  - 长档上限取官方模型页的 **context window = 1,050,000**（同族模型页还写明 Maximum input tokens
    = 922,000 = context 1,050,000 − max output 128,000；上限只影响校验，超出时 lookup 用最大档）。
- 该分档适用于：gpt-6 系列（astra/6.1-sol/6-luna/6-sol）、gpt-5.6 sol/terra/luna、gpt-5.5、gpt-5.5-pro、
  gpt-5.4、gpt-5.4-pro。
- **无长上下文加价**：gpt-5.6-cyber（Maximum input 272K）、gpt-5.4-mini（Maximum input 272K）、
  chat-latest（Maximum input 272K）、gpt-5.2 / gpt-5.2-pro（定价页 Long context 列为 “-”），用 flat `rates`。

## 缓存与推理 token

- `cacheWrite` 仅对官方单独给出 cache-write 价的模型填写：gpt-6 系列与 gpt-5.6 sol/terra/luna/cyber
  （= 1.25 × uncached input；gpt-6 系列在模型页/定价页直接列出，gpt-5.6 系列按 1.25x 规则并从定价页
  交叉核对）。其余模型 Long/Short 表的 cache writes 为 “-”（无单独写入价），省略 `cacheWrite`
  （插件回退按 cacheMiss 计，即写入按普通输入价计费）。
- Pro 模型（gpt-5.5-pro / gpt-5.4-pro / gpt-5.2-pro）无缓存输入折扣，`cacheHit` 取输入价。
- 推理/思考 token 已含在 `output` 价内（官方无单独计费行）。

## 其它未建模的价格档（notes 用）

- Batch / Flex：标准价 5 折；Fast：标准价 2x；Ultrafast：仅 gpt-6.1-sol 有，6x。
- 区域处理（data residency）端点与 FedRAMP 端点：+10%；默认 global 路由为标准价。
- `gpt-5.6-sol` 为限时促销价，官方写明至少维持至 2026-11-21。
- `chat-latest` 是滚动别名，底层快照会更新；官方建议生产 API 使用 GPT-6 Astra。
- 272K 按官方写法取 272,000 tokens；模型页 context window 为 1,050,000 / 400,000 等十进制写法。
