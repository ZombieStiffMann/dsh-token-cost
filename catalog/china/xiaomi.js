// 小米 MiMo — 官方人民币按量计费价格，2026-10-19 读取（页面更新日期 2026-10-08）。
// 来源: https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go
// 证据、批量/海外/Token Plan 说明见 catalog/china/notes/xiaomi.md
export default {
  vendor: 'xiaomi',
  name: '小米 MiMo',
  nameEn: 'Xiaomi MiMo',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go',
  asOf: '2026-10-19',
  providers: ['xiaomi'],
  models: [
    {
      id: 'mimo-v2.6-pro',
      name: 'MiMo-V2.6-Pro',
      aliases: ['mimo-v2.5-pro'],
      // 缓存写入当前“限时免费”，官方单列该计费项，故显式记 0。
      rates: { cacheHit: 0.025, cacheMiss: 3, output: 6, cacheWrite: 0 },
      notes: '实时推理价；批量推理半价；缓存写入限时免费。',
    },
    {
      id: 'mimo-v2.6-flash',
      name: 'MiMo-V2.6-Flash',
      aliases: ['mimo-v2.5'],
      rates: { cacheHit: 0.02, cacheMiss: 1, output: 2, cacheWrite: 0 },
      notes: '实时推理价；批量推理半价；缓存写入限时免费。',
    },
    {
      id: 'mimo-v2.6-pro-ultraspeed',
      name: 'MiMo-V2.6-Pro-UltraSpeed',
      rates: { cacheHit: 0.25, cacheMiss: 30, output: 60, cacheWrite: 0 },
      notes: '实时推理价；不支持批量推理；缓存写入限时免费。',
    },
  ],
};
