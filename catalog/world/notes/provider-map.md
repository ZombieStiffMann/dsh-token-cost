# 国际厂商 id → DSH provider id / 模型 id 勘察（供 Lead 复核）

本文回答两件事：`catalog/world/<vendor>.js` 的 `providers` 字段应当写哪个 **DSH / pi-ai provider id**，
以及本机 DSH 桌面版**实际安装了哪些 pi-ai provider 与 model id**。

## 依据与方法（2026-10-20 读取）

- 路由语义来自本机 DSH 桌面版 app.asar 内的 `@deepseek-ai/dsh-llm-pi-ai` README（file-read 读取）：
  `providers` 字典的每个 key 是请求选择的 **provider route 名**（= pi-ai provider id）；已安装
  catalog 提供 endpoint/protocol/模型目录默认值，未描述的路由可手写 `api` / `baseURL` / `models`；
  `apiKeyEnv` 是凭据引用；`openai` 路由只支持 API key（README Known Limitations：OpenAI 无 ChatGPT
  登录），ChatGPT 订阅登录走 `openai-codex`；各 provider 是否可登录由 pi-ai 是否带 login 决定。
- provider / model id 清单来自 app.asar 内打包的 pi-ai 目录数据
  (`@earendil-works/pi-ai/dist/providers/data/*.json`，共 **42 个 provider data 文件**)，只读解析；
  `dsh-web-app` README 主要讲 Web 启动/配置，未列 provider id（unverified 部分见下）。
- 本机 profile（`%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`）当前只配置了两条
  `llm-pi-ai` 路由：`zai`、`xiaomi`（均 `apiKeyEnv`）。其余 provider 即使已安装 catalog，也需在
  profile 的 `llm-pi-ai.providers` 里加路由（`apiKeyEnv`）后才会被选中/计费。

## 本机已安装的 42 个 provider id（pi-ai catalog）

`amazon-bedrock, ant-ling, anthropic, azure, baseten, cerebras, cloudflare-ai-gateway,
cloudflare-workers-ai, deepseek, fireworks, github-copilot, google, google-vertex, groq, huggingface,
kimi-coding, meta, minimax, minimax-cn, mistral, moonshotai, moonshotai-cn, nvidia, openai,
openai-codex, opencode, opencode-go, openrouter, qwen-token-plan, qwen-token-plan-cn,
qwen-token-plan-individual, radius, together, typesafe, vercel-ai-gateway, xai, xiaomi,
xiaomi-token-plan-ams, xiaomi-token-plan-cn, xiaomi-token-plan-sgp, zai, zai-coding-cn`

## 国际厂商映射表

| vendor（目录 id） | 建议 `providers` | provider id | baseURL / 协议 | 已装目录中的精确模型 id（示例，均为逐字读取） | 状态 |
| --- | --- | --- | --- | --- | --- |
| `mistral` | `["mistral"]` | `mistral` | `https://api.mistral.ai`，`mistral-conversations` | 40 个：`mistral-large-4`, `mistral-large-2512`, `mistral-medium-3.5`, `mistral-medium-2604`, `mistral-small-2603`, `codestral-2508`, `codestral-latest`, `devstral-2512`, `ministral-14b-2512`, `ministral-3b-2512`, `ministral-8b-2512`, `magistral-medium-latest`, `open-mixtral-8x7b`, `pixtral-12b`, `voxtral-small-2507`, `zai-glm-5-3` 等 | ✅ 已安装 |
| `cohere` | `["cohere"]`（约定名） | — | 未安装；需手写 OpenAI-compatible 路由（`api: openai-completions` + `baseURL` + `models`） | **无 cohere provider data 文件**。官方 wire id 示例：`command-a-03-2025`, `command-a-plus-05-2026`, `command-r-08-2024`, `command-r-plus-08-2024`, `command-r7b-12-2024`, `c4ai-aya-expanse-32b` | ❌ **本 build 未安装**，`providers: ["cohere"]` 只是约定 |
| `openai` | `["openai"]` | `openai` | `https://api.openai.com/v1`，`openai-responses` / `openai-decisions` | 45 个：`gpt-6-luna`, `gpt-6-sol`, `gpt-6.1-sol`, `gpt-5.5`, `gpt-5.4`, `gpt-5.2`, `gpt-5`, `gpt-4o`, `gpt-4.1`, `o3`, `o3-pro`, `o4-mini`, `gpt-5.3-codex` 等 | ✅ 已安装（API key；无 ChatGPT 登录） |
| `anthropic` | `["anthropic"]` | `anthropic` | `https://api.anthropic.com`，`anthropic-messages` | 17 个：`claude-fable-5-1`, `claude-opus-5-5`, `claude-opus-5`, `claude-sonnet-5-5`, `claude-sonnet-4-6`, `claude-haiku-5-5`, `claude-haiku-4-5-20251001` 等 | ✅ 已安装 |
| `google` | `["google"]`（Vertex 另见 `google-vertex`） | `google` | `https://generativelanguage.googleapis.com/v1beta`，`google-generative-ai` | 22 个：`gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.1-pro-preview`, `gemini-2.5-pro`, `gemini-flash-latest`, `gemma-4-31b-it`, `deep-research-preview-04-2026` 等 | ✅ 已安装 |
| `xai` | `["xai"]` | `xai` | `https://api.x.ai/v1`，`openai-responses` | 4 个：`grok-4.3`, `grok-4.5`, `grok-4.6`, `grok-4.7` | ✅ 已安装 |
| `google-vertex` | （如需 Vertex） | `google-vertex` | `https://{location}-aiplatform.googleapis.com`，`google-vertex` | 14 个：`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.1-pro-preview`, `gemini-2.5-pro`, `gemini-flash-lite-latest` 等 | ✅ 已安装（OAuth/ADC，非 API key） |
| 订阅/登录变体 | — | `openai-codex` | `https://chatgpt.com/backend-api`，`openai-codex-responses` | 9 个：`gpt-6-sol`, `gpt-6.1-sol`, `gpt-6-astra`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.5`, `gpt-5.3-codex-spark`, `gpt-6-luna` | ✅ 已安装（ChatGPT/Codex OAuth 登录） |
| 订阅/登录变体 | — | `github-copilot` | `https://api.individual.githubcopilot.com`，混合协议 | 34 个：`claude-sonnet-5.5`, `claude-opus-5.5`, `gemini-3.8-flash`, `gpt-6-sol`, `gpt-5.6-luna`, `grok-4.7`, `kimi-k3`, `mai-code-1.1-flash` 等 | ✅ 已安装（GitHub Copilot 订阅） |
| 聚合网关 | — | `openrouter` | `https://openrouter.ai/api/v1`，OpenAI 兼容等 | **476 个**，覆盖 anthropic/openai/google/xai/mistral 等全厂商（`anthropic/claude-opus-5`, `openai/gpt-6-sol`, `x-ai/grok-4.7`, `xiaomi/mimo-v2.6-pro` 等） | ✅ 已安装（API key 聚合） |
| 其他已装网关 | — | `azure`, `amazon-bedrock`, `vercel-ai-gateway`, `opencode`, `opencode-go`, `together`, `fireworks`, `cerebras`, `groq`, `nvidia`, `huggingface`, `cloudflare-ai-gateway`, `cloudflare-workers-ai`, `baseten`, `radius`, `typesafe`, `meta`, `ant-ling` | 各自 baseURL（略） | 例如 `azure` 45 个 id、`meta` 的 `muse-spark-1.3`、`together` 的 `deepseek-ai/DeepSeek-V4-Pro-0813` 等 | ✅ 已安装（部分需特殊凭据/协议） |

## Lead 需要复核的点

1. **Cohere 在本 build 没有已安装 provider**：`cohere.js` 的 `providers: ["cohere"]` 是任务约定的
   route 名，只有用户手写一条 OpenAI-compatible 路由（`api: openai-completions`、Cohere 的
   `baseURL`、`models`）且恰好命名 `cohere` 时才会命中。严格口径应写 `[]`；请拍板。
2. **Mistral id 差异**：官方 API name 是 `mistral-medium-3-5`（连字符），本机 pi-ai `mistral` 目录写作
   `mistral-medium-3.5`（点号）并另有 `mistral-medium-2604`；`catalog/world/mistral.js` 按官方 wire id
   记录。若按 pi-ai 目录 id 计价，建议在 `catalog/lookup`/`index` 层加 alias（`mistral-medium-3.5` →
   `mistral-medium-3-5`），否则该模型可能匹配不到。
3. **只有 `zai`、`xiaomi` 两条路由被 profile 配置**：world 厂商要真正参与计费需在
   `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml` 的 `llm-pi-ai.providers` 添加
   `openai` / `anthropic` / `google` / `xai` / `mistral` 等并给 `apiKeyEnv`。
4. **未核实细节**（不要当事实用）：各 provider 的凭据环境变量名、是否可 OAuth 登录、`openai-decisions`
   协议用途、`typesafe`/`radius` 等特殊 provider 的语义 — README 提到这些由生成器产出的
   provider-data 元数据描述，本次未读取该生成文件；标记 **unverified**。
5. 以上清单是**本机 DSH 桌面版 0.2.1-rc.2（app.asar 内 pi-ai）**的快照；DSH 升级后 provider 集合与
   模型 id 会变化，应重新读取 `providers/data/*.json` 再更新本表。
