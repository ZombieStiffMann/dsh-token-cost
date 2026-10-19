# 科大讯飞 星火 — 价格证据

- **读取日期**: 2026-10-19。
- **官方价格数据来源（价格）**: 讯飞星辰 MaaS 模型广场（讯飞自有平台）的实时价格数据：
  - 模型广场: https://maas.xfyun.cn/modelSquare
  - Spark-X2.5 模型页: https://maas.xfyun.cn/modelSquare/base/2624708664591360
  - 该平台公开模型列表接口 `GET https://maas.xfyun.cn/api/v1/gpt-finetune/model/base/list-v2` 返回每个
    自研模型的 `inferencePrice`（`inTokensPrice` / `cacheTokensPrice` / `outTokensPrice`、`discount` 及
    “原价” `*OrigPrice`），即模型广场页“模型价格”渲染的数据源；本次按 2026-10-19 的返回值记录。
- **模型 ID 来源**: 官方 Token Plan 文档的 modelId 表
  https://www.xfyun.cn/doc/spark/TokenPlan.html
  （其中 `Spark-X2.5 → spark-x2.5`、`Spark-X2-Flash → xsparkx2flash`、`Spark-X2 → xsparkx2（已下线）`）。

## 收录（1 个）

| 模型 | modelId | 输入（未命中缓存） | 缓存命中 | 输出 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Spark-X2.5 | `spark-x2.5` | ¥0.96 | ¥0.14 | ¥3.60 | 模型广场 `discount: 0.3`（限时 3 折），原价 ¥3.2 / ¥0.48 / ¥12 / 百万 tokens |

`spark-x2.5` 这个 id 有两处官方一致：Token Plan 文档 modelId 表与模型广场 `pretrainedModel` 字段。

## 价格口径冲突（重要，请 Lead 复核）

- 星火产品页 `https://xinghuo.xfyun.cn/sparkapi` 的页面脚本内置数据把 Spark-X2.5 标为 **限时五折**：
  输入 ¥1.60 / 缓存命中 ¥0.24 / 输出 ¥6.00（元/百万 tokens）。
- 星辰 MaaS 模型广场的**实时**数据为 **限时 3 折**：输入 ¥0.96 / 缓存命中 ¥0.14 / 输出 ¥3.60。
- 两者都是讯飞官方数据，但产品页是前端构建时固化的静态促销文案，模型广场是实时接口数据。
  目录取**实时数据（3 折现价）**；若以产品页为准，应改为 1.60 / 0.24 / 6.00。请 Lead 决定口径后我可再改。

## 未收录及原因

- **Spark-X2-Flash**（模型广场实时价：输入 ¥1 / 输出 ¥2 / 百万 tokens，无缓存价、无折扣字段）：
  价格可查，但按量接口的精确 wire modelId 未能核实（Token Plan 文档写 `xsparkx2flash`，模型广场
  `pretrainedModel` 写 `Spark-X2-Flash`，二者非同一计费端点），故不写入目录，避免用错 id。
- **Spark X2**：Token Plan 文档标注“已下线”，不收录。
- **Spark-X2.5-4B / Spark-X2.5-1.7B**：限时免费/免费（0 价）。数据契约要求 `cacheMiss > 0`，无法表达免费模型，不收录。
- **Spark Mini / Spark Mini Instruct / Spark Tiny**：模型广场 `showPrice: false`，无公布价格（旧列表里的 2/8 为占位），不收录。
- **旧版 Lite / Pro / Pro-128K / Max / Max-32K / 4.0 Ultra（HTTP 接口文档的 `lite`/`generalv3`/`pro-128k`/
  `generalv3.5`/`max-32k`/`4.0Ultra`）**：官方 HTTP 接口文档仍在，但未见当前按量人民币单价；
  且文档注明 Max 套餐 2026-03-10 下线、后端升级为 Ultra，X1 仅有免费额度活动。价格无法核实 → 不收录。
- **Token Plan / Coding Plan 订阅**：按积分计费（1 元 ≈ 100 积分），非按 token 的人民币价，不收录。
- 星火产品页为前端渲染（SSR 无价格表），页面脚本文本与模型广场同源但存在上述折扣差异；
  本次没有直接抓取到 xinghuo 页面上的静态“当前价”表格，故以模型广场为准。
