# 字节跳动 火山方舟（豆包）— 证据笔记

- 读取日期：2026-10-19
- 价格来源：<https://docs.volcengine.com/docs/ark/model-pricing?lang=zh>（火山方舟「模型价格」官方文档；`www.volcengine.com/docs/82379/1099320` 已 302 到该文档）
- 网页抓取方式：直接读取官方文档页面内嵌的表格（含在线推理各档、批量推理、缓存等分节）。

## 收录范围

收录字节跳动自有豆包（Doubao）文本生成模型，取自「在线推理（常规）」价格表：
`doubao-seed-evolving`、`doubao-seed-2.1-pro/lite/turbo`、`doubao-seed-2.0-pro/lite/mini/code`、`doubao-seed-character`、`doubao-seed-translation`。

**未收录（原因）**

- 火山方舟上的第三方模型（`glm-5.3-flash`、`glm-5.2`、`deepseek-v4-*` 等）属于各自厂商，不放这里。
- 视频/图像/3D/向量/精调/TPM 保障包/模型单元等分节不是文本 chat 定价，未收录（`doubao-seedance-*`、`doubao-seedream-*`、`doubao-seed3d-*`、`doubao-embedding*` 等）。
- 仅收录「在线推理（常规）」价：同一页还有「在线推理（低延迟）」约为常规 2 倍、「在线推理（低优）」与「批量推理」约为常规 0.5 倍；catalog 只放标准在线价，避免把低优/批量价当成默认价。
- 更早的豆包版本（如 `doubao-seed-1.6` 系列）不在当前价格表正文中，未收录。

## 模型 ID

价格表只有「模型名称」列，无独立 ID 列；表内名称（如 `doubao-seed-2.1-pro`）与官方 AIHub/控制台模型卡使用的 ID 一致，直接作为 wire model id。表内未给带日期快照 ID，因此没有 aliases / matchPrefixes。

## 计价口径

- 单价单位是元/百万 token，未换算。
- 分档：表中「输入长度：千 token」以 [0,32] / (32,128] / (128,256] 千 token 表示，`tiers` 取上限 32000 / 128000 / 256000；单档模型（[0,1024] 千 token 或 [0,256] 千 token）用 `rates`。
- 输出价：表内输出列已含思考/推理 token。
- 音频输入：`doubao-seed-2.1-lite`（输入(音频) ¥12/M）、`doubao-seed-2.0-lite`（¥9/13.5/27 按档）、`doubao-seed-2.0-mini`（¥3/6/12 按档）的音频输入另计价，catalog 取「输入(非音频)」与对应文本价，模型 notes 已提示。

## 缓存

- 表内有单独的缓存命中价（`cacheHit` 已填）。另有「缓存存储」¥0.017/百万 token/小时 的按时长存储费。
- 文档没有按 token 计价的缓存写入价（cacheWrite），故省略 `cacheWrite`；插件回退按 cacheMiss 计。
- 缓存命中价是官方公布值，未做推导。

## 未验证/存疑

- 低延迟/低优/批量的折扣系数来自同页不同档价表对比，仅用于本说明，不进入 catalog。
- 页面未给价格生效日期，`asOf` 为读取日期。
