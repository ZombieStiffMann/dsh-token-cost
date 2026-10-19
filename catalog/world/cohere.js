// Cohere — 官方美元按 token 价格，2026-10-20 读取。
// 价格页: https://cohere.com/pricing
// 模型 ID / 在售状态 / 单价交叉核对（Cohere 官方文档）: https://docs.cohere.com/docs/models
//   以及各模型页 https://docs.cohere.com/docs/<model>（如 /docs/command-a、/docs/command-r）
// 证据与排除原因见 catalog/world/notes/cohere.md
export default {
  vendor: 'cohere',
  name: 'Cohere',
  nameEn: 'Cohere',
  currency: { code: 'USD', symbol: '$' },
  source: 'https://cohere.com/pricing',
  asOf: '2026-10-20',
  providers: ['cohere'],
  models: [
    {
      id: 'command-a-03-2025',
      name: 'Command A',
      rates: { cacheMiss: 2.5, cacheHit: 2.5, output: 10 },
    },
    {
      id: 'command-a-plus-05-2026',
      name: 'Command A+',
      rates: { cacheMiss: 2.5, cacheHit: 2.5, output: 10 },
      notes: '价格取自 cohere.com/pricing 模型卡；官方模型页称 API 限时免费、生产走 Model Vault。',
    },
    {
      id: 'command-r-plus-08-2024',
      name: 'Command R+ (08-2024)',
      rates: { cacheMiss: 2.5, cacheHit: 2.5, output: 10 },
    },
    {
      id: 'command-r-08-2024',
      name: 'Command R (08-2024)',
      rates: { cacheMiss: 0.15, cacheHit: 0.15, output: 0.6 },
    },
    {
      id: 'command-r7b-12-2024',
      name: 'Command R7B (12-2024)',
      rates: { cacheMiss: 0.0375, cacheHit: 0.0375, output: 0.15 },
    },
    {
      id: 'c4ai-aya-expanse-32b',
      name: 'Aya Expanse 32B',
      rates: { cacheMiss: 0.5, cacheHit: 0.5, output: 1.5 },
    },
  ],
};
