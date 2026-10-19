# 厂商 id → DSH provider id 映射（供 Lead 复核）

本文回答一件事：`catalog/china/<vendor>.js` 的 `providers` 字段应该写哪些 **DeepSeek Harness / pi-ai
provider id**，以及依据。结论分两类：

1. **已安装的 pi-ai 原生 provider**（可直接路由，id 可核实）；
2. **未安装、只能手写路由的 provider 名**（名字只是约定，DSH 不会自动认识它）。

## 依据（方法）

- DSH 里模型路由名 = `dsh-llm-pi-ai` 配置 `providers` 字典的 key，也是 pi-ai 目录 provider id。
  见本机 profile `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`：
  `llm-pi-ai.providers: { zai: {apiKeyEnv: ZAI_API_KEY}, xiaomi: {apiKeyEnv: XIAOMI_API_KEY} }`；
  另有 `dsh-llm-deepseek` 插件注册的 `deepseek-official` 路由（`packages/llm/llm-deepseek`，
  `ctx.llm.registerAdapter(['deepseek-official'], ...)`）。
- pi-ai 已安装目录清单：桌面版 `app.asar` 内 `@earendil-works/pi-ai/dist/providers/data/*.json`
  （本机 DeepSeek Harness 0.2.1-rc.2，42 个 provider 数据文件；2026-10-19 读取）。其中与中国厂商
  相关的原生 route 及 baseURL：
  - `deepseek` → `https://api.deepseek.com`
  - `zai` → `https://api.z.ai/api/coding/paas/v4`；`zai-coding-cn` → `https://open.bigmodel.cn/api/coding/paas/v4`
  - `moonshotai-cn` → `https://api.moonshot.cn/v1`；`moonshotai` → `https://api.moonshot.ai/v1`；`kimi-coding` → `https://api.kimi.com/coding`
  - `minimax-cn` → `https://api.minimaxi.com/anthropic`；`minimax` → `https://api.minimax.io/anthropic`
  - `qwen-token-plan-cn` → `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`；
    `qwen-token-plan` / `qwen-token-plan-individual` → 阿里云百炼海外 token-plan 端点
  - `xiaomi` → `https://api.xiaomimimo.com/v1`；`xiaomi-token-plan-cn/-ams/-sgp` → 小米 Token Plan 订阅端点
  - 另有 `ant-ling`（蚂蚁百灵）、`opencode`/`opencode-go`/`openrouter`/`vercel-ai-gateway`/`huggingface` 等聚合网关。
- **未出现在上述清单的厂商 = 没有已安装的 pi-ai provider**。这些厂商仍可通过 `dsh-llm-pi-ai`
  手写一条 OpenAI-compatible 路由使用（`api`/`baseURL`/`models` 全可配），但**路由名由用户自定**，
  插件里的 `providers` 只是“当用户恰好用了这个名字时能匹配上”的约定。

## 映射表（12 个 China vendor）

| vendor（目录 id） | 中文名 | `providers` 建议 | 状态 / 依据 |
| --- | --- | --- | --- |
| `deepseek` | 深度求索 | `["deepseek-official", "deepseek"]` | ✅ 已安装：`deepseek-official` 是 dsh-llm-deepseek 直连路由（本机默认 provider = `deepseek-official`）；`deepseek` 是 pi-ai 原生目录。DeepSeek 价格在 `pricing.js`，不在 china 目录。 |
| `zhipu` | 智谱 AI | `["zai", "zai-coding-cn"]` | ✅ 已安装；本机 profile 已配置 `zai`（ZAI_API_KEY）。注意：这两个已装目录都是 **Coding Plan 端点**（api.z.ai / open.bigmodel.cn coding），标准开放平台按量 API 另有端点；价格目录按官方按量 table 收录，若用户走 Coding Plan 订阅则不应按 token 计费。 |
| `moonshot` | 月之暗面 Kimi | `["moonshotai-cn"]`（国际站可加 `"moonshotai"`；编程套餐 `"kimi-coding"`） | ✅ 已安装。人民币价格对应 CN 端点 `moonshotai-cn`（api.moonshot.cn）。**现文件 `moonshot.js` 写的是 `["moonshot"]`，不是已安装 id，建议 Lead 改为 `["moonshotai-cn"]`。** |
| `minimax` | MiniMax | `["minimax-cn", "minimax"]` | ✅ 已安装。人民币价对应 CN 端点 `minimax-cn`（api.minimaxi.com）；`minimax` 是国际站。**现文件 `minimax.js` 写 `["minimax"]`，建议 Lead 评估是否改为 `minimax-cn` 优先。** |
| `stepfun` | 阶跃星辰 | `[]`，或自定义路由名 `["stepfun"]` | ❌ pi-ai 无原生 stepfun（只在 huggingface 等聚合目录里出现 `stepfun-ai/...`）。文件里的 `"stepfun"` 仅当用户手写同名 OpenAI-compatible 路由时生效。 |
| `alibaba` | 阿里云百炼（通义千问） | `[]`，或 `["dashscope"]`（约定名）；已安装可用的近似路由是 `qwen-token-plan-cn` | ❌ 无 `dashscope`/`qwen` 原生 provider；已安装的是百炼 **Token Plan 订阅**路由（qwen-token-plan-cn 等），与按 token 目录价不是同一计费模式。**现文件 `alibaba.js` 写 `["dashscope"]`，是约定名而非已安装 id。** |
| `bytedance` | 字节跳动火山方舟（豆包） | `[]`，或自定义路由名 `["volcengine"]` | ❌ pi-ai 无原生 volcengine/ark provider。 |
| `tencent` | 腾讯混元 | `[]`，或自定义路由名 `["hunyuan"]` | ❌ pi-ai 无原生 hunyuan provider（HunyuanOCR 等只作为 MaaS 托管模型出现在第三方平台）。 |
| `baidu` | 百度智能云千帆（文心） | `[]`，或自定义路由名 `["qianfan"]` | ❌ pi-ai 无原生 qianfan/ernie provider。 |
| `xunfei` | 科大讯飞 星火 | `["spark"]`（约定名） | ❌ 无已安装 id；`spark` 仅在用户手写该名路由时匹配。本文件按 Lead 要求仍写 `["spark"]`。 |
| `sensetime` | 商汤 日日新 | `["sensenova"]`（约定名） | ❌ 无已安装 id；`sensenova` 仅在用户手写该名路由时匹配。本文件按 Lead 要求仍写 `["sensenova"]`。 |
| `xiaomi` | 小米 MiMo | `["xiaomi"]` | ✅ 已安装原生 `xiaomi`（api.xiaomimimo.com/v1）；本机 profile 已配置 `xiaomi`（XIAOMI_API_KEY），历史会话记录 `provider: "xiaomi", model: "mimo-v2.6-pro"`。另有 `xiaomi-token-plan-cn/-ams/-sgp` 订阅路由（目录 cost=0，按订阅计费，**不应**作为按 token 定价来源）。 |

## Lead 需要拍板的三点

1. **未安装厂商的 \(providers\) 字段**：严格口径应为 `[]`（DSH 不会路由到不存在的 provider）；
   宽松口径保留 `stepfun`/`dashscope`/`volcengine`/`hunyuan`/`qianfan`/`spark`/`sensenova` 作为
   “用户手写同名路由时可匹配”的约定名。本目录当前是宽松口径（各文件已按任务说明写成约定名）。
2. **moonshot.js / minimax.js 的 id 与已安装目录不一致**（`moonshot` vs `moonshotai-cn`，
   `minimax` vs `minimax-cn`）。若插件做 provider+model 精确匹配，这两个文件的人民币目录只有在
   用户使用国际站路由时才会命中 CN 价格——建议统一为 CN 端点 id（或同时列两个）。
3. **订阅型路由混入风险**：`zai`/`zai-coding-cn`、`qwen-token-plan*`、`xiaomi-token-plan-*`、`kimi-coding`
   都是订阅/套餐端点，按 token 目录价计费会与真实账单口径不同；provider-map 建议在 README 里注明
   “本目录只适用于按量 API 路由”。
