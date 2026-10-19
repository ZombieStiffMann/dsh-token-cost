// MiniMax — 官方人民币价格，2026-10-19 读取。
// 来源: https://platform.minimax.cn/docs/pricing/overview
// 证据与取舍说明见 catalog/china/notes/minimax.md
export default {
  vendor: 'minimax',
  name: 'MiniMax',
  nameEn: 'MiniMax',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://platform.minimax.cn/docs/pricing/overview',
  asOf: '2026-10-19',
  providers: ['minimax-cn', 'minimax'],
  models: [
    {
      id: 'MiniMax-M3.1-Flash',
      name: 'MiniMax M3.1 Flash',
      rates: { cacheMiss: 1, cacheHit: 0.1, output: 4 },
    },
    {
      id: 'MiniMax-M3',
      name: 'MiniMax M3',
      tiers: [
        { maxInputTokens: 512000, rates: { cacheMiss: 2.1, cacheHit: 0.42, output: 8.4 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 4.2, cacheHit: 0.84, output: 16.8 } },
      ],
      notes: '输入≤512K / >512K 两档；service_tier=priority 时按标准价 1.5 倍计费（未在本表体现）。',
    },
  ],
};
