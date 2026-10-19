// 商汤 日日新 SenseNova — 官方人民币 tokens 按量后付费价格，2026-10-19 读取。
// 来源: https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/pricing/
// 页面单价为“元/千tokens”，本目录统一换算为元/百万tokens（×1000）。
// 模型 ID 依据官方文档示例：https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/overview/compatible-mode/
// （V6.5 的线上 ID 用连字符：SenseNova-V6-5-Pro）。证据与取舍见 catalog/china/notes/sensetime.md
export default {
  vendor: 'sensetime',
  name: '商汤 日日新',
  nameEn: 'SenseTime SenseNova',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://console.sensecore.cn/micro/help/docs/model-as-a-service/nova/pricing/',
  asOf: '2026-10-19',
  providers: ['sensenova'],
  models: [
    {
      id: 'SenseNova-V6-5-Pro',
      name: 'SenseNova-V6.5-Pro',
      rates: { cacheMiss: 3, cacheHit: 3, output: 9 },
    },
    {
      id: 'SenseNova-V6-5-Turbo',
      name: 'SenseNova-V6.5-Turbo',
      rates: { cacheMiss: 1.5, cacheHit: 1.5, output: 4.5 },
    },
    {
      id: 'SenseNova-V6-Pro',
      name: 'SenseNova-V6-Pro',
      rates: { cacheMiss: 3, cacheHit: 3, output: 9 },
    },
    {
      id: 'SenseNova-V6-Turbo',
      name: 'SenseNova-V6-Turbo',
      rates: { cacheMiss: 1.5, cacheHit: 1.5, output: 4.5 },
    },
    {
      id: 'SenseNova-V6-Reasoner',
      name: 'SenseNova-V6-Reasoner',
      rates: { cacheMiss: 4, cacheHit: 4, output: 16 },
    },
    {
      id: 'SenseChat-Vision',
      name: 'SenseChat-Vision',
      rates: { cacheMiss: 10, cacheHit: 10, output: 60 },
      notes: '图文多模态输入，按 token 计费。',
    },
    {
      id: 'SenseChat-Character-Pro',
      name: 'SenseChat-Character-Pro',
      rates: { cacheMiss: 15, cacheHit: 15, output: 15 },
    },
    {
      id: 'SenseChat-Character',
      name: 'SenseChat-Character',
      rates: { cacheMiss: 12, cacheHit: 12, output: 12 },
    },
  ],
};
