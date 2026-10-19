// 阶跃星辰 StepFun — 官方人民币价格，2026-10-19 读取。
// 来源: https://platform.stepfun.com/docs/zh/guides/pricing/details
// 证据与取舍说明见 catalog/china/notes/stepfun.md
export default {
  vendor: 'stepfun',
  name: '阶跃星辰',
  nameEn: 'StepFun',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://platform.stepfun.com/docs/zh/guides/pricing/details',
  asOf: '2026-10-19',
  providers: ['stepfun'],
  models: [
    {
      id: 'step-5-preview',
      name: 'Step 5 Preview',
      rates: { cacheMiss: 7, cacheHit: 0.7, output: 20 },
      notes: '缓存命中价自 2026-10-14 起由 ¥0.35 调整为 ¥0.70。',
    },
    {
      id: 'step-3.7-flash',
      name: 'Step 3.7 Flash',
      rates: { cacheMiss: 1.35, cacheHit: 0.27, output: 8.1 },
    },
    {
      id: 'step-3.5-flash',
      name: 'Step 3.5 Flash',
      aliases: ['step-3.5-flash-2603'],
      rates: { cacheMiss: 0.7, cacheHit: 0.14, output: 2.1 },
    },
    {
      id: 'step-1o-turbo-vision',
      name: 'Step-1o Turbo Vision',
      rates: { cacheMiss: 2.5, cacheHit: 0.5, output: 8 },
      notes: '视觉理解模型（图片/视频输入），按 token 计费。',
    },
  ],
};
