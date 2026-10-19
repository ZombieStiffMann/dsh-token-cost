# 商汤 日日新 SenseNova — 价格证据

- **读取日期**: 2026-10-19；页面未标注明确生效日期，`asOf` 取读取日。
- **价格页（Tokens 按量后付费）**: https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/pricing/
  （商汤大装置帮助中心“模型调用计费”，官方文档；页面说明“2 月 28 日起，日日新大模型全面降价”。）
- **模型清单（确认在售/接口）**:
  - 融合模态: https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/model/fusionllm/FusionLLMs
  - 拟人对话: https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/model/llm/CharacterLLM
  - 图文多模态: https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/model/mllm
- **模型 ID / OpenAI 兼容模式**: https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/overview/compatible-mode/
  （示例请求使用 `SenseNova-V6-5-Pro`、`SenseNova-V6-Pro`；页面“模型列表”同样给出各模型人民币单价，
  与计费页一致，可交叉核对。）

## 收录（8 个，元/百万 tokens = 页面“元/千 tokens”×1000）

| 模型（官方名称） | 输入 | 输出 | 换算依据 |
| --- | --- | --- | --- |
| SenseNova-V6.5-Pro | 3 | 9 | 0.003 / 0.009 元/千 |
| SenseNova-V6.5-Turbo | 1.5 | 4.5 | 0.0015 / 0.0045 元/千 |
| SenseNova-V6-Pro | 3 | 9 | 0.003 / 0.009 元/千 |
| SenseNova-V6-Turbo | 1.5 | 4.5 | 0.0015 / 0.0045 元/千 |
| SenseNova-V6-Reasoner | 4 | 16 | 0.004 / 0.016 元/千 |
| SenseChat-Vision | 10 | 60 | 0.01 / 0.06 元/千 |
| SenseChat-Character-Pro | 15 | 15 | 0.015 / 0.015 元/千 |
| SenseChat-Character | 12 | 12 | 0.012 / 0.012 元/千 |

- **缓存价**：计费页只公布单一“输入 tokens”单价，没有缓存命中/写入价 → 按数据契约把输入价同时用于
  `cacheHit` 与 `cacheMiss`，不填 `cacheWrite`（回退按未命中输入价计，不会低估）。
- **模型 ID**：`SenseNova-V6-5-Pro`、`SenseNova-V6-Pro` 取自官方 compatible-mode 请求示例（线上 id 用连字符
  而非展示名里的点号）；`SenseNova-V6-5-Turbo`/`SenseNova-V6-Turbo`/`SenseNova-V6-Reasoner`、
  `SenseChat-Vision`、`SenseChat-Character(-Pro)` 按模型清单名称/同族命名规律记录，**未逐一在请求示例中验证**，
  Lead 若需要可再人工核对一次。展示名中的点号形式（如 `SenseNova-V6.5-Pro`）是文档展示名，未作为 alias 收录。
- **未收录**：`SenseNova-V6-Omni`（0.2 元/分钟，按分钟计费）、`SenseNova-Audio-Fusion-0603`、
  `nova-tts-1`（限时免费）等语音模型——非 token 计费，不属文本/chat 目录范围。
- 套餐/预付费（TPM 配额包、Tokens 量包）为另一种计费模式，本目录只收按量后付费现价。
