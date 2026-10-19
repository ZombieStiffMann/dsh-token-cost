# 智谱 AI (GLM) — 价格证据

- **读取日期**: 2026-10-19（页面未标注明确生效日期，asOf 取读取日）
- **价格页**: https://docs.bigmodel.cn/cn/guide/start/pricing
  （另见 https://open.bigmodel.cn/pricing 与 https://bigmodel.cn/pricing，前者为 JS 渲染的影子页面、无静态数据；
  文档页为官方发布的同一价格表，取可抓取的文档页）
- **模型可用性**: https://docs.bigmodel.cn/cn/guide/start/model-overview
- **模型 ID 核对**: https://docs.bigmodel.cn/api-reference/模型-api/对话补全 、https://docs.bigmodel.cn/cn/guide/start/concept-param
- **价格页 FAQ**: “历史模型价格将继续保留，便于已有业务查询和核对费用。模型当前可用状态……请参见模型概览。”
  → 因此把“模型概览·全部模型”中不存在的模型视为已下线、不收录。

## 收录（12 个）

- 最新模型（元/百万 tokens，输入/输出/缓存命中）：GLM-5.3 8 / 28 / 2；GLM-5.3-Flash 0.8 / 2.8 / 0.23；
  GLM-5.3-FlashX 2 / 7 / 0.57。GLM-5.3-Flash/FlashX 为原生多模态输入，文本 token 计费。
- 文本模型：GLM-5.2 8 / 28 / 2。
- 按输入长度分档（tiers，<32K 与 ≥32K）：GLM-5.1 6/24/1.3 → 8/28/2；GLM-5-Turbo 5/22/1.2 → 7/26/1.8；
  GLM-5 4/18/1 → 6/22/1.5。
- GLM-4.7 分档：输入 [0,32K) 且输出 [0,0.2K) 2/8/0.4；输入 [0,32K) 且输出 ≥0.2K 3/14/0.6；
  输入 [32K,200K) 4/16/0.8。目录取“输出 ≥0.2K”档（常见聊天输出长度，且为较高价，不会低估），
  note 中说明短输出更便宜。
- GLM-4.5-Air 分档：输入 [0,32K) 且输出 [0,0.2K) 0.8/2/0.16；输入 [0,32K) 且输出 ≥0.2K 0.8/6/0.16；
  输入 [32K,128K) 1.2/8/0.24。同样取输出 ≥0.2K 档并在 note 说明。
- 其他：GLM-4.7-FlashX 0.5/3/0.1；GLM-4-Long 1/1/0.5；GLM-4-FlashX-250414 0.1/0.1/0.05。

## 分档边界换算

页面写 32K / 128K / 200K / 1M；目录按 1024 进制取 32768 / 131072 / 204800 / 1048576 作为 maxInputTokens。

## 未收录及原因

- **免费模型（价格=0，数据契约要求 cacheMiss>0）**：GLM-4.7-Flash、GLM-4-Flash-250414、GLM-4.5-Flash。
- **在售但价格页未给价**：GLM-4.6、GLM-4.5-AirX（模型概览中在售，价格表无行，不猜测）。
- **已下线（仅保留历史价格）**：GLM-4-Plus、GLM-4-Air-250414、GLM-4-AirX、GLM-4-Assistant、
  GLM-Z1-Air、GLM-Z1-AirX、GLM-Z1-FlashX、GLM-Z1-Flash。
- **视觉理解模型不属文本/chat 目录范围**：GLM-5V-Turbo、GLM-4.6V、GLM-4.6V-FlashX、GLM-4.5V、GLM-4V-Plus-0111 等。

## 其他价格要点

- 缓存存储（cacheWrite）：官方按“元/百万 tokens/小时”计费且当前“限时免费”，无单独的按 token 写入价，
  故不填 `cacheWrite`（插件回退按 cacheMiss 计，与“未命中缓存输入”费用一致）。
- Batch API：支持模型按标准价 **5 折**（价格页 FAQ / Batch API 说明），本目录不体现。
- GLM Coding Plan 非高峰 5 折是订阅套餐规则，非按量 API 价格，不体现。
