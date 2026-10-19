// 字节跳动 火山方舟（豆包）— 官方人民币价格，2026-10-19 读取。
// 来源: https://docs.volcengine.com/docs/ark/model-pricing?lang=zh（在线推理（常规））
// 证据与取舍说明见 catalog/china/notes/bytedance.md
export default {
  vendor: 'bytedance',
  name: '字节跳动火山方舟（豆包）',
  nameEn: 'ByteDance Volcengine Ark (Doubao)',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://docs.volcengine.com/docs/ark/model-pricing?lang=zh',
  asOf: '2026-10-19',
  providers: ['volcengine'],
  models: [
    {
      id: 'doubao-seed-evolving',
      name: 'Doubao-Seed-Evolving',
      rates: { cacheMiss: 6, cacheHit: 1.2, output: 30 },
    },
    {
      id: 'doubao-seed-2.1-pro',
      name: 'Doubao-Seed-2.1-Pro',
      rates: { cacheMiss: 6, cacheHit: 1.2, output: 30 },
    },
    {
      id: 'doubao-seed-2.1-lite',
      name: 'Doubao-Seed-2.1-Lite',
      rates: { cacheMiss: 0.8, cacheHit: 0.16, output: 2.7 },
      notes: '音频输入另按 ¥12/百万 tokens 计。',
    },
    {
      id: 'doubao-seed-2.1-turbo',
      name: 'Doubao-Seed-2.1-Turbo',
      rates: { cacheMiss: 3, cacheHit: 0.6, output: 15 },
    },
    {
      id: 'doubao-seed-2.0-pro',
      name: 'Doubao-Seed-2.0-Pro',
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 3.2, cacheHit: 0.64, output: 16 } },
        { maxInputTokens: 128000, rates: { cacheMiss: 4.8, cacheHit: 0.96, output: 24 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 9.6, cacheHit: 1.92, output: 48 } },
      ],
    },
    {
      id: 'doubao-seed-2.0-lite',
      name: 'Doubao-Seed-2.0-Lite',
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 0.6, cacheHit: 0.12, output: 3.6 } },
        { maxInputTokens: 128000, rates: { cacheMiss: 0.9, cacheHit: 0.18, output: 5.4 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 1.8, cacheHit: 0.36, output: 10.8 } },
      ],
      notes: '音频输入另按 ¥9/13.5/27（按档）计。',
    },
    {
      id: 'doubao-seed-2.0-mini',
      name: 'Doubao-Seed-2.0-Mini',
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 0.2, cacheHit: 0.04, output: 2 } },
        { maxInputTokens: 128000, rates: { cacheMiss: 0.4, cacheHit: 0.08, output: 4 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 0.8, cacheHit: 0.16, output: 8 } },
      ],
      notes: '音频输入另按 ¥3/6/12（按档）计。',
    },
    {
      id: 'doubao-seed-2.0-code',
      name: 'Doubao-Seed-2.0-Code',
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 3.2, cacheHit: 0.64, output: 16 } },
        { maxInputTokens: 128000, rates: { cacheMiss: 4.8, cacheHit: 0.96, output: 24 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 9.6, cacheHit: 1.92, output: 48 } },
      ],
    },
    {
      id: 'doubao-seed-character',
      name: 'Doubao-Seed-Character',
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 0.8, cacheHit: 0.16, output: 2 } },
        { maxInputTokens: 128000, rates: { cacheMiss: 1.2, cacheHit: 0.16, output: 6 } },
      ],
    },
    {
      id: 'doubao-seed-translation',
      name: 'Doubao-Seed-Translation',
      rates: { cacheMiss: 1.2, cacheHit: 1.2, output: 3.6 },
    },
  ],
};
