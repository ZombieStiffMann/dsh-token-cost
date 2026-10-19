# Test fixtures

`pricing-zh.html` is a **minimized structural excerpt** of the public DeepSeek API
pricing page used only to exercise the offline parser tests in
`official-pricing.js`.

- Source: <https://api-docs.deepseek.com/zh-cn/quick_start/pricing>
- Read on: 2026-10-19
- Kept: the model header row, the six peak/off-peak price rows, and the footnote
  sentence that states the peak windows.
- Removed: everything else on the page (navigation, model details, search/fetch
  pricing, billing rules).

DeepSeek names, prices, and the quoted rule sentence belong to DeepSeek and are
reproduced here only as the minimal sample the parser reads. This repository is
not affiliated with DeepSeek.
