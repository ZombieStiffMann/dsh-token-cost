# 月之暗面 Moonshot (Kimi) — 价格证据

- **读取日期**: 2026-10-19（页面未标注明确生效日期，asOf 取读取日）
- **价格页**: https://platform.kimi.com/docs/pricing/chat
  （`platform.moonshot.cn` 现 302 跳转到 `platform.kimi.com`，为同一官方平台；本条为读取的实际页面 URL）
- **在售模型列表**: https://platform.kimi.com/docs/models
- **Batch 价格**: https://platform.kimi.com/docs/pricing/batch

## 收录（4 个，元/百万 tokens）

| 模型 id | 缓存命中 | 缓存未命中 | 输出 | 备注 |
| --- | ---: | ---: | ---: | --- |
| `kimi-k3` | 2.00 | 20.00 | 100.00 | 缓存写入：5min TTL 20.00，1h TTL 40.00；上下文 1,048,576 |
| `kimi-k2.7-code` | 1.30 | 6.50 | 27.00 | 上下 262,144；支持 Batch（60% 价） |
| `kimi-k2.7-code-highspeed` | 2.60 | 13.00 | 54.00 | 上下 262,144 |
| `kimi-k2.6` | 1.10 | 6.50 | 27.00 | 上下 262,144；支持 Batch（60% 价） |

- K3 的缓存写入按 TTL 分两档（5min ¥20 / 1h ¥40），数据契约只有一个 `cacheWrite` 字段，取默认 5min 档（¥20，
  恰与 cacheMiss 相同），note 中说明 1h 档。
- K2 系列只有缓存命中/未命中/输出三项，无缓存写入费，不填 `cacheWrite`。
- Batch API 费用为标准价 **60%**，且仅 `kimi-k2.7-code`、`kimi-k2.6` 支持（`kimi-k2.7-code-highspeed`、`kimi-k3` 未列支持）。

## 未收录及原因

- **已下线模型**（模型列表明确标注）：`kimi-k2.5`、`moonshot-v1` 系列（含 auto / vision-preview，2026-08-31 下线）、
  `kimi-k2` 系列（2026-05-25 下线）、`kimi-latest`（2026-01-28 下线）、`kimi-thinking-preview`（2025-11-11 下线）。
  这些均不收录，即使部分页面残留历史价格。
- 托管智能体、联网搜索等功能定价不属于文本/chat 模型 token 价格，不收录。
