# 阿里云百炼（通义千问）— 证据笔记

- 读取日期：2026-10-19
- 价格来源：<https://help.aliyun.com/zh/model-studio/model-pricing>（模型调用价格，华北 2（北京）价格表；模型 ID 列即 模型 ID（Model ID））
- 缓存规则来源：<https://help.aliyun.com/zh/model-studio/context-cache>（显式缓存 / 隐式缓存）
- 网页抓取方式：官方帮助中心页面（服务端渲染，直接读取原始表格）。`model-pricing` 页内价格按地域分表；本文件取 **华北 2（北京）** 表，未采用新加坡/美国/欧洲等地域价格。

## 收录范围

收录千问（Qwen）自有文本生成模型：价格表「文本生成-千问」「文本生成-千问-开源版」两节，以及「更多模型」中的 `qwen-max`。

**未收录（原因）**

- 第三方托管模型（DeepSeek/月之暗面 Kimi/智谱 GLM/MiniMax/小米 MiMo/阶跃 StepFun/云知声等）属于各自厂商，不放这里。
- 多模态与专用模型：Qwen-Omni（`qwen3.8-omni-flash`、`qwen3.5-omni-*`）、Qwen-VL/OCR、Qwen-Audio/TTS/ASR、翻译（`qwen-mt-*`）、数据挖掘（`qwen-doc-turbo`）、深入研究（`qwen-deep-research`）、通义晓蜜、图像/视频/向量/重排/3D 模型：它们按文本/音频/图片/视频分别计价，超出纯文本 catalog 的能力范围。
- `qwen3.8-max-prime`（优速模式 Prime，24/72）是同一模型的加速服务档，不是主流默认入口，未收录。
- 更早日期的 qwen-plus 快照（2025-01-25 / 2025-01-12 / 2024-12-20 等）未逐条收录；只保留页面标注「当前能力等同于」的当前快照作为 alias。

## 计价口径

- 表中单价已按「每百万 Token」给出（元/百万 Token），未做汇率或单位换算。
- 阶梯：价格表用「单次请求的输入 Token 数」分档（0<Token≤128K/256K/1M 等）。K 按页面的 1,000 计，故 128K→128000、256K→256000、1M→1000000；`tiers` 以档位上限升序排列。
- Batch：行内标注「Batch 调用 半价」表示 Batch API 为在线价 5 折；catalog 只放标准在线价。
- 输出价：Plus 系列的输出列分「非思考模式 / 思考模式（思维链+回答）」两列。除 `qwen-plus` 外两者相同；`qwen-plus` 取非思考输出价（2/20/48），思考模式为 8/24/64，已写入 notes。其余模型输出价已含思维链+回答。
- `qwen3.7-plus` 页面行标注「原价 2/8/8 元（限时 8 折）」，本文件保留折前原价；同日期的 `qwen3.7-plus-2026-05-26` 行显示相同的 2/8/8。

## 缓存命中价（cacheHit）的推导

- `model-pricing` 表只写「上下文缓存 享有折扣」，不逐模型给命中价；命中折扣规则在 context-cache 页。
- 隐式缓存（API 默认开启，无需 cache_control）：命中的输入 Token 按 input 单价的 **20%** 计。页面列出的北京地域适用模型为：qwen3.8-max(+0902)、qwen3.7-max 系列、qwen-max、qwen3.7-plus(+2026-05-26)、qwen-plus、qwen3.8-flash、qwen3.7-flash(+2026-07-15)、qwen-flash、qwen3-coder-flash、qwen3.8-2.4t-a95b、qwen3.8-27b。本文件按 20% 计算这些模型的 cacheHit（精确到分）。
- **例外**：`qwen3.8-max`、`qwen3.8-flash`、`qwen3.8-2.4t-a95b` 的缓存命中价「不是输入单价的 20%，具体价格请参见百炼控制台」——官方价格页未公布数字，因此这三者 `cacheHit = cacheMiss`（会高估缓存输入成本），并在模型 notes 中标明。
- 未列入隐式缓存支持列表的模型（如 qwen3.6-plus、qwen3.5-plus、qwen3.6-flash、qwen3.5-flash、qwen-long、Qwen3.5/3.6 开源版）：`cacheHit = cacheMiss`。
- 显式缓存（cache_control 标记）另有规则：写入按输入价 **125%**、命中按 **10%** 计费；普通对话不会主动设标记，故未建模，也未写 `cacheWrite`（插件回退为 cacheMiss）。需要按显式缓存计费时需人工覆盖。

## 未验证/存疑

- 页面对 `qwen3.8-*` 缓存命中价指向控制台（需登录），无法核对具体数字——按上述保守口径处理。
- 价格随时可能调整；`asOf` 只是读取日期，不是官方生效日期（该页未给生效日期）。
