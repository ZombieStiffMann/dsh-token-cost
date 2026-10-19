# 小米 MiMo — 价格证据

- **读取日期**: 2026-10-19；页面底部标注“更新时间 2026 年 10 月 08 日”，`asOf` 取读取日。
- **价格页**: https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go
  （官方 MiMo 开放平台文档“价格 / 按量计费 API”；同站另有 https://platform.xiaomimimo.com/token-plan 为订阅套餐。）

## 本地 profile 关注点：`xiaomi/mimo-v2.6-pro`

本机 DSH profile（`%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`）配置了 pi-ai 路由
`xiaomi`（`XIAOMI_API_KEY`），会话记录里 `modelSelection = { provider: "xiaomi", model: "mimo-v2.6-pro" }`。
该 id 在官方价格页“模型国内定价 · 实时推理”表中确有对应行，人民币价格已可直接收录：

| 模型（官方 id） | 输入（命中缓存） | 输入（未命中缓存） | 输出 |
| --- | --- | --- | --- |
| `mimo-v2.6-pro` | ¥0.025 | ¥3.00 | ¥6.00 |
| `mimo-v2.6-flash` | ¥0.02 | ¥1.00 | ¥2.00 |
| `mimo-v2.6-pro-ultraspeed` | ¥0.25 | ¥30.00 | ¥60.00 |

单位均为 **元/百万 tokens**（官方“计费说明”：计费单位“国内：元 / 百万 tokens”）。`mimo-v2.6-pro`
的精确 id 与价格均已核实，无需退而用其它 MiMo 家族 id。

## 收录说明

- **`mimo-v2.6-pro` / `mimo-v2.6-flash` / `mimo-v2.6-pro-ultraspeed`**：收录，取“实时推理”标准价。
- **`mimo-v2.5-pro` / `mimo-v2.5`**：价格页把它们与 v2.6 同价分行列出，且顶部公告称
  “于 2026.10.14 18:00 自动转发至 V2.6 系列，最终于 2026.10.21 10:00 正式下线”。
  即当前仍按 v2.6 同价计费 → 作为对应 v2.6 模型的 `aliases` 收录（不单列 model）。
- **批量推理**：`mimo-v2.6-pro` ¥0.0125/¥1.50/¥3.00、`mimo-v2.6-flash` ¥0.01/¥0.50/¥1.00（元/百万 tokens，
  缓存命中/未命中/输出）。批量价与实时价不同，目录记录实时价，`notes` 中提示“批量推理半价”。
  `mimo-v2.6-pro-ultraspeed`、`mimo-v2.5-pro`、`mimo-v2.5` 不支持批量推理。
- **缓存写入**：官方“计费说明”单列“缓存写入：限时免费”，故 `cacheWrite: 0` 显式收录（不是缺价，是当前为 0）。
- **海外定价（美元）**：页面同时给 $/百万 tokens 的海外表（如 pro $0.435 / $0.87）。按任务规则不做美元换算，
  目录只收录国内人民币价。
- **未收录**：`mimo-v2.5-asr`（按音频时长 ¥0.5/小时）、`mimo-v2.5-tts*`（限时免费）、联网服务插件
  （¥16/1000 次）——均非文本/chat token 计费，不属本目录范围。Token Plan 为订阅制（积分），也不按 token 计费。

## 官方来源汇总

- 价格/计费说明: https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go
- 模型下线公告: https://mimo.mi.com/docs/zh-CN/updates/deprecate
- Token Plan（订阅，未收录）: https://mimo.mi.com/docs/zh-CN/price/token-plan
