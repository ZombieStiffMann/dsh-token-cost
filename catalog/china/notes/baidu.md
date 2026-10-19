# 百度智能云千帆（文心 ERNIE）— 证据笔记

- 读取日期：2026-10-19
- 价格来源：<https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya>（模型服务计费 → 文本生成 → 按量后付费；单位「元/千 tokens」，×1000 后写入 catalog 的元/百万 tokens）
- 模型 ID 来源：<https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j>（模型列表 → ERNIE 系列-旗舰模型 / 视觉理解 →「model 参数/接入点 ID」列）
- 网页抓取方式：直接读取官方文档页面内嵌的表格（含按量后付费、按量包、TPM 预付费等分节）。

## 收录范围

| 页面名称 | wire id | 说明 |
| --- | --- | --- |
| ERNIE 5.1 | `ernie-5.1` | 按输入长度分档 |
| ERNIE 5.0 | `ernie-5.0`；thinking 版本 `ernie-5.0-thinking-preview/latest/exp` 同价，作 aliases | 按输入长度分档 |
| ERNIE 4.5 Turbo 32K | `ernie-4.5-turbo-32k` | 有缓存命中价、批量 4 折 |
| ERNIE 4.5 Turbo 128K | `ernie-4.5-turbo-128k`；日期快照 `ernie-4.5-turbo-20260402` 同价，作 alias | 同上 |
| ERNIE 4.5 Turbo VL | `ernie-4.5-turbo-vl`；`ernie-4.5-turbo-vl-32k` 同价，作 alias | 多模态理解，出现在「文本生成 → 按量后付费」表内 |

**未收录（原因）**

- ERNIE X1.1（页面标注「即将下线」，且属深度思考旧模型）。
- 千帆上转售的第三方模型（DeepSeek、GLM、Kimi、Qwen、InternVL 等）属于各自厂商。
- OCR / 文本向量 / 重排 / 图像生成 / 图像编辑 / 视频生成模型：不是文本 chat 的按 token 价。
- 量包（按量包付费）、TPM 预付费、算力单元、微调模型价格：非标准按 token 后付费，未收录。
- 千帆另有 Token Plan 个人版/企业版、Coding Plan 套餐（见文档目录）；属订阅包装，catalog 只用「按量后付费」单价。

## 计价口径

- 原表单位是元/千 tokens，已 ×1000 转成 catalog 要求的元/百万 tokens，例如 ERNIE 4.5 Turbo 输入 0.0008 元/千 = ¥0.8/百万。
- 分档：ERNIE 5.1 / ERNIE 5.0 按「输入<=32k」与「32k<输入<=128k」两档计价，`tiers` 取 32000 / 128000。ERNIE 4.5 Turbo 无阶梯（单档）。
- 输出价已含思考/推理 token（ERNIE 5.0 的 thinking 版本与标准版同价）。
- 缓存：只有 ERNIE 4.5 Turbo（含 VL）公布「命中缓存」价（0.0002 元/千 = ¥0.2/百万；VL 为 0.00075 元/千 = ¥0.75/百万）。ERNIE 5.1/5.0 未公布缓存价，`cacheHit = cacheMiss`。
- 批量推理：ERNIE 4.5 Turbo 批量价为 0.00032 / 0.00128 元/千（约在线价 4 折），已写在模型 notes；catalog 主体用在线价。
- 无缓存写入价，省略 `cacheWrite`。

## 未验证/存疑

- 「32k/128k」按 32,000 / 128,000 tokens 处理（官方未说明是 1000 还是 1024 进位；分档边界差异对计费影响可忽略）。
- 价格页未给生效日期（只有文档最近的更新日期），`asOf` 为读取日期。
