// 腾讯混元 — 官方人民币价格，2026-10-19 读取。
// 来源: https://cloud.tencent.com/document/product/1823/130055（TokenHub 模型价格，广州）
// 模型 ID 对照: https://cloud.tencent.com/document/product/1823/130078
// 证据与取舍说明见 catalog/china/notes/tencent.md
export default {
  vendor: 'tencent',
  name: '腾讯混元',
  nameEn: 'Tencent Hunyuan',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://cloud.tencent.com/document/product/1823/130055',
  asOf: '2026-10-19',
  providers: ['hunyuan'],
  models: [
    {
      id: 'hy4-preview',
      name: 'Hy4 Preview',
      rates: { cacheMiss: 6, cacheHit: 0.3, output: 18 },
    },
    {
      id: 'hy3',
      name: 'Hy3',
      rates: { cacheMiss: 1, cacheHit: 0.25, output: 4 },
    },
    {
      id: 'hy-mt2-pro',
      name: 'Hy-MT2-Pro',
      rates: { cacheMiss: 0.5, cacheHit: 0.5, output: 2 },
    },
    {
      id: 'hy-mt2-plus',
      name: 'Hy-MT2-Plus',
      rates: { cacheMiss: 0.5, cacheHit: 0.5, output: 2 },
    },
    {
      id: 'hy-mt2-lite',
      name: 'Hy-MT2-Lite',
      rates: { cacheMiss: 0.3, cacheHit: 0.3, output: 1.2 },
    },
    {
      id: 'hunyuan-role-latest',
      name: 'Hy-Role-Latest',
      rates: { cacheMiss: 2.4, cacheHit: 2.4, output: 9.6 },
    },
    {
      id: 'hy-role',
      name: 'Hy-Role',
      rates: { cacheMiss: 2.4, cacheHit: 2.4, output: 9.6 },
    },
  ],
};
