// 月之暗面 Moonshot (Kimi) — 官方人民币价格，2026-10-19 读取。
// 来源: https://platform.kimi.com/docs/pricing/chat
// 证据与取舍说明见 catalog/china/notes/moonshot.md
export default {
  vendor: 'moonshot',
  name: '月之暗面 Kimi',
  nameEn: 'Moonshot AI',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://platform.kimi.com/docs/pricing/chat',
  asOf: '2026-10-19',
  providers: ['moonshotai-cn', 'moonshotai', 'moonshot'],
  models: [
    {
      id: 'kimi-k3',
      name: 'Kimi K3',
      rates: { cacheMiss: 20, cacheHit: 2, output: 100, cacheWrite: 20 },
      notes: '缓存写入价按默认 5min TTL（¥20）；1h TTL 为 ¥40。',
    },
    {
      id: 'kimi-k2.7-code',
      name: 'Kimi K2.7 Code',
      rates: { cacheMiss: 6.5, cacheHit: 1.3, output: 27 },
      notes: '支持 Batch API，批量推理价格为标准价的 60%。',
    },
    {
      id: 'kimi-k2.7-code-highspeed',
      name: 'Kimi K2.7 Code Highspeed',
      rates: { cacheMiss: 13, cacheHit: 2.6, output: 54 },
    },
    {
      id: 'kimi-k2.6',
      name: 'Kimi K2.6',
      rates: { cacheMiss: 6.5, cacheHit: 1.1, output: 27 },
      notes: '支持 Batch API，批量推理价格为标准价的 60%。',
    },
  ],
};
