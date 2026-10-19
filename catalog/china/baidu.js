// 百度智能云千帆（文心 ERNIE）— 官方人民币价格，2026-10-19 读取。
// 来源: https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya（文本生成 → 按量后付费，元/千 tokens ×1000）
// 模型 ID 对照: https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j（model 参数/接入点 ID）
// 证据与取舍说明见 catalog/china/notes/baidu.md
export default {
  vendor: 'baidu',
  name: '百度智能云千帆（文心）',
  nameEn: 'Baidu Qianfan (ERNIE)',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya',
  asOf: '2026-10-19',
  providers: ['qianfan'],
  models: [
    {
      id: 'ernie-5.1',
      name: 'ERNIE 5.1',
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 4, cacheHit: 4, output: 18 } },
        { maxInputTokens: 128000, rates: { cacheMiss: 6, cacheHit: 6, output: 22 } },
      ],
    },
    {
      id: 'ernie-5.0',
      name: 'ERNIE 5.0',
      aliases: ['ernie-5.0-thinking-preview', 'ernie-5.0-thinking-latest', 'ernie-5.0-thinking-exp'],
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 6, cacheHit: 6, output: 24 } },
        { maxInputTokens: 128000, rates: { cacheMiss: 10, cacheHit: 10, output: 40 } },
      ],
    },
    {
      id: 'ernie-4.5-turbo-32k',
      name: 'ERNIE 4.5 Turbo 32K',
      rates: { cacheMiss: 0.8, cacheHit: 0.2, output: 3.2 },
      notes: '批量推理 4 折：输入 ¥0.32、输出 ¥1.28（每百万 tokens）。',
    },
    {
      id: 'ernie-4.5-turbo-128k',
      name: 'ERNIE 4.5 Turbo 128K',
      aliases: ['ernie-4.5-turbo-20260402'],
      rates: { cacheMiss: 0.8, cacheHit: 0.2, output: 3.2 },
      notes: '批量推理 4 折：输入 ¥0.32、输出 ¥1.28（每百万 tokens）。',
    },
    {
      id: 'ernie-4.5-turbo-vl',
      name: 'ERNIE 4.5 Turbo VL',
      aliases: ['ernie-4.5-turbo-vl-32k'],
      rates: { cacheMiss: 3, cacheHit: 0.75, output: 9 },
      notes: '多模态理解模型；批量推理 4 折：输入 ¥1.2、输出 ¥3.6。',
    },
  ],
};
