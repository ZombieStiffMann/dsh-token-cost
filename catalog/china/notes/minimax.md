# MiniMax — 价格证据

- **读取日期**: 2026-10-19（页面未标注明确生效日期，asOf 取读取日）
- **价格页**: https://platform.minimax.cn/docs/pricing/overview
  （`platform.minimaxi.com` 现跳转到 `platform.minimax.cn`，同一官方平台；本条为读取的实际页面 URL）
- **模型调用文档**: https://platform.minimax.cn/docs/guides/text-generation
- **对话模型 (M2-her)**: https://platform.minimax.cn/docs/guides/text-chat

## 收录（2 个，元/百万 tokens）

| 模型 id | 输入 | 输出 | 缓存读取 |
| --- | ---: | ---: | ---: |
| `MiniMax-M3.1-Flash` | 1.00 | 4.00 | 0.10 |
| `MiniMax-M3`（≤512K 输入） | 2.10 | 8.40 | 0.42 |
| `MiniMax-M3`（>512K 输入） | 4.20 | 16.80 | 0.84 |

- 两者上下文窗口均为 1,000,000 tokens（模型文档明示）。
- M3 按输入长度分两档：≤512K 与 >512K，目录用 `tiers`，分界取 512,000、上限取 1,000,000（页面按十进制 1M=1,000,000 表述）。
- M3 另有“优先服务”：调用时 `service_tier=priority`，按标准价 **1.5 倍**计费（≤512K 优先档 3.15/12.60/0.63，
  >512K 优先档 6.30/25.20/1.26）。插件不跟踪 service_tier，目录按标准价，已在 model note 说明。
- 页面给“缓存读取”价，无单独的缓存写入价，不填 `cacheWrite`。

## 未收录及原因

- `M2-her`（专用对话模型，64K 上下文）：其文档的“定价说明”链接指向价格页 `#models/text`，但价格页语言模型表中
  **没有 M2-her 行**（页面仅 M3.1-Flash 与 M3），无官方人民币价格，不猜测、不收录。
- `MiniMax-H3-Context-IR`（5.80/23.00 元/百万 tokens）：视频上下文任务模型，不属于文本/chat 模型。
- 语音、视频、图像、音乐、MCP/服务端工具按字符/秒/张/次计价，不属于 token 语言模型价格，不收录。
