# 腾讯混元 — 证据笔记

- 读取日期：2026-10-19
- 价格来源：<https://cloud.tencent.com/document/product/1823/130055>（TokenHub「模型价格」，语言模型 → 按 Token 计费（后付费），广州地域表）
- 模型 ID 对照来源：<https://cloud.tencent.com/document/product/1823/130078>（TokenHub API「语言模型调用概览」，列出 模型名称 → model 参数值）
- 产品入口：<https://cloud.tencent.com/product/tokenhub>

## 收录范围

收录腾讯自研混元（Hy/Hunyuan）文本语言模型（产品页 / TokenHub 语言模型表）：

| 模型名称 | wire id | 输入 | 输出 | 缓存命中 |
| --- | --- | --- | --- | --- |
| Hy4 preview | `hy4-preview` | 6 | 18 | 0.3 |
| Hy3 | `hy3` | 1 | 4 | 0.25 |
| Hy-MT2-Pro | `hy-mt2-pro` | 0.5 | 2 | — |
| Hy-MT2-Plus | `hy-mt2-plus` | 0.5 | 2 | — |
| Hy-MT2-Lite | `hy-mt2-lite` | 0.3 | 1.2 | — |
| Hy-Role-Latest | `hunyuan-role-latest` | 2.4 | 9.6 | — |
| Hy-Role | `hy-role` | 2.4 | 9.6 | — |

单位：元/百万 tokens。

**未收录（原因）**

- TokenHub 上的第三方转售模型（DeepSeek、GLM、Kimi、MiniMax、Qwen、MiMo、Step 等）属于各自厂商，不放这里。
- 视觉/多模态（`HY-Vision-*`、`YT-VITA`）、图片/视频/3D/语音/向量模型、预付费 TPM 预留与模型单元：非文本 chat 的按量价格，未收录。
- 旧「混元生文计费概述」<https://cloud.tencent.com/document/product/1729/97731>（最近更新 2026-06-26）仍列有更早的 `Hunyuan-a13b`、`Hunyuan-role-latest`、`Hunyuan-translation` 等，并在页首注明腾讯混元功能将逐步迁移 TokenHub、「原平台将不再新增模型能力，并停止支持新购模型服务」。按「只收录当前在售模型」的要求，以 TokenHub 表为准，旧表模型不收录（老客户存量服务照旧计费，但不是新购入口）。

## 计价口径

- 表中单位为「元/百万 tokens」，与 catalog 一致，未换算。
- TokenHub 语言模型表按地域展示；文档表头为广州。表 2（另一地域）中出现的自研模型价格与表 1 相同（Hy4 6/18/0.3、Hy3 1/4/0.25），故自研模型价格无地域歧义。
- Hy4/Hy3 有缓存命中价，直接采用；Hy-MT2 / Hy-Role 的缓存命中列为「-」，按规则 `cacheHit = cacheMiss`。
- 无单独缓存写入价，省略 `cacheWrite`。
- TokenHub 的峰谷时段仅适用于部分 DeepSeek 转售模型（空闲/高峰不同价），混元自研模型为固定价，故 catalog 无 `billing` 块。
- 预付费（TPM 预留、模型单元、Token Plan/Coding Plan 套餐）为包量/包月价，不进入按 token catalog。

## 未验证/存疑

- 价格页未给生效日期，`asOf` 为读取日期。
- `Hy-Role-Latest` 的 model 参数值在 API 文档中是 `hunyuan-role-latest`（其余 Hy 系列为 `hy-*`），已按文档原样使用。
