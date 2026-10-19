# 阶跃星辰 StepFun — 价格证据

- **读取日期**: 2026-10-19（页面未标注明确生效日期，asOf 取读取日）
- **价格页**: https://platform.stepfun.com/docs/zh/guides/pricing/details
- **在售模型列表**: https://platform.stepfun.com/docs/zh/guides/models/list
- **下线与迁移**: https://platform.stepfun.com/docs/zh/guides/models/deprecations
- **Step 5 Preview 缓存调价公告**: https://platform.stepfun.com/docs/zh/announcements/step-5-preview-price-adjustment

## 收录（4 个，元/百万 tokens）

| 模型 id | 输入（缓存未命中） | 输入（缓存命中） | 输出 |
| --- | ---: | ---: | ---: |
| `step-5-preview` | 7 | 0.70 | 20 |
| `step-3.7-flash` | 1.35 | 0.27 | 8.1 |
| `step-3.5-flash` | 0.7 | 0.14 | 2.1 |
| `step-1o-turbo-vision` | 2.5 | 0.5 | 8 |

- `step-3.5-flash-2603`（Step 3.5 Flash 2603，Agent 优化的日期快照）在价格页单列一行，价格与 `step-3.5-flash` 相同：
  按任务规则把日期快照放入 `aliases`，不重复成独立模型。
- `step-1o-turbo-vision` 为视觉理解/多模态 chat 模型，价格页将其列在“文本与多模态模型”按 token 计费，故收录。
- **Step 5 Preview 调价**：缓存命中输入价自北京时间 2026-10-14 00:30 起由 0.35 元/百万 tokens 调整为 0.70；
  此前已调用过的按量付费用户继续适用 0.35。目录用当前价 0.70。
- 无单独缓存写入价，不填 `cacheWrite`；未发布 batch / 峰谷时段定价，均按 flat rates。

## 未收录及原因

- **已下线模型**（下线页）：`step-3`（2026-07-08，迁移到 step-3.7-flash）、`step-1-8k`、`step-1-32k`、`step-1v-8k`、
  `step-1v-32k`、`step-2-mini`、`step-1o-vision-32k`、`step-2-16k`、`step-1x-medium`，以及图像模型
  `step-2x-large`、`step-image-edit-2`、`step-1x-edit`（2026-10-10 前后下线）。
- 语音/音频模型（`stepaudio-*`、`step-1o-audio`、`step-audio-*`）虽按 token 计费，但属于语音模型，不在文本/chat 目录范围。
- 语音合成/识别、搜索等按字符/小时/次计价，不收录。
- Step Router V1 是智能路由能力，不是有独立 token 价格的 chat 模型。
