// 阿里云百炼（通义千问）— 官方人民币价格，2026-10-19 读取。
// 来源: https://help.aliyun.com/zh/model-studio/model-pricing（华北 2（北京）价格表）
// 缓存折扣规则: https://help.aliyun.com/zh/model-studio/context-cache
// 证据与取舍说明见 catalog/china/notes/alibaba.md
export default {
  vendor: 'alibaba',
  name: '阿里云百炼（通义千问）',
  nameEn: 'Alibaba Cloud Model Studio (Qwen)',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://help.aliyun.com/zh/model-studio/model-pricing',
  asOf: '2026-10-19',
  providers: ['dashscope'],
  models: [
    {
      id: 'qwen3.8-max',
      name: 'Qwen3.8-Max',
      aliases: ['qwen3.8-max-0902'],
      rates: { cacheMiss: 12, cacheHit: 12, output: 36 },
      notes: '缓存命中价未公开，按输入原价计；Batch 调用半价。',
    },
    {
      id: 'qwen3.7-max',
      name: 'Qwen3.7-Max',
      aliases: ['qwen3.7-max-2026-05-20', 'qwen3.7-max-2026-06-08', 'qwen3.7-max-preview', 'qwen3.7-max-2026-05-17'],
      rates: { cacheMiss: 12, cacheHit: 2.4, output: 36 },
      notes: 'Batch 调用半价。',
    },
    {
      id: 'qwen-max',
      name: 'Qwen-Max',
      rates: { cacheMiss: 2.4, cacheHit: 0.48, output: 9.6 },
    },
    {
      id: 'qwen3.7-plus',
      name: 'Qwen3.7-Plus',
      aliases: ['qwen3.7-plus-2026-05-26'],
      tiers: [
        { maxInputTokens: 256000, rates: { cacheMiss: 2, cacheHit: 0.4, output: 8 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 6, cacheHit: 1.2, output: 24 } },
      ],
      notes: '限时 8 折（此处为折前原价）；Batch 调用半价。',
    },
    {
      id: 'qwen3.6-plus',
      name: 'Qwen3.6-Plus',
      aliases: ['qwen3.6-plus-2026-04-02'],
      tiers: [
        { maxInputTokens: 256000, rates: { cacheMiss: 2, cacheHit: 2, output: 12 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 8, cacheHit: 8, output: 48 } },
      ],
    },
    {
      id: 'qwen3.5-plus',
      name: 'Qwen3.5-Plus',
      aliases: ['qwen3.5-plus-2026-02-15', 'qwen3.5-plus-2026-04-20'],
      tiers: [
        { maxInputTokens: 128000, rates: { cacheMiss: 0.8, cacheHit: 0.8, output: 4.8 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 2, cacheHit: 2, output: 12 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 4, cacheHit: 4, output: 24 } },
      ],
    },
    {
      id: 'qwen-plus',
      name: 'Qwen-Plus',
      aliases: ['qwen-plus-latest', 'qwen-plus-2025-12-01'],
      tiers: [
        { maxInputTokens: 128000, rates: { cacheMiss: 0.8, cacheHit: 0.16, output: 2 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 2.4, cacheHit: 0.48, output: 20 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 4.8, cacheHit: 0.96, output: 48 } },
      ],
      notes: '此处为非思考输出价；思考模式输出为 ¥8/24/64（按档）。',
    },
    {
      id: 'qwen3.8-flash',
      name: 'Qwen3.8-Flash',
      rates: { cacheMiss: 0.8, cacheHit: 0.8, output: 2.7 },
      notes: '缓存命中价未公开，按输入原价计。',
    },
    {
      id: 'qwen3.7-flash',
      name: 'Qwen3.7-Flash',
      aliases: ['qwen3.7-flash-2026-07-15'],
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 0.2, cacheHit: 0.04, output: 0.8 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 0.6, cacheHit: 0.12, output: 2.4 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 1.2, cacheHit: 0.24, output: 4.8 } },
      ],
    },
    {
      id: 'qwen3.6-flash',
      name: 'Qwen3.6-Flash',
      aliases: ['qwen3.6-flash-2026-04-16'],
      tiers: [
        { maxInputTokens: 256000, rates: { cacheMiss: 1.2, cacheHit: 1.2, output: 7.2 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 4.8, cacheHit: 4.8, output: 28.8 } },
      ],
    },
    {
      id: 'qwen3.5-flash',
      name: 'Qwen3.5-Flash',
      aliases: ['qwen3.5-flash-2026-02-23'],
      tiers: [
        { maxInputTokens: 128000, rates: { cacheMiss: 0.2, cacheHit: 0.2, output: 2 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 0.8, cacheHit: 0.8, output: 8 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 1.2, cacheHit: 1.2, output: 12 } },
      ],
    },
    {
      id: 'qwen-flash',
      name: 'Qwen-Flash',
      aliases: ['qwen-flash-2025-07-28'],
      tiers: [
        { maxInputTokens: 128000, rates: { cacheMiss: 0.15, cacheHit: 0.03, output: 1.5 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 0.6, cacheHit: 0.12, output: 6 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 1.2, cacheHit: 0.24, output: 12 } },
      ],
    },
    {
      id: 'qwen-long',
      name: 'Qwen-Long',
      rates: { cacheMiss: 0.5, cacheHit: 0.5, output: 2 },
    },
    {
      id: 'qwen3-coder-flash',
      name: 'Qwen3-Coder-Flash',
      aliases: ['qwen3-coder-flash-2025-07-28'],
      tiers: [
        { maxInputTokens: 32000, rates: { cacheMiss: 1, cacheHit: 0.2, output: 4 } },
        { maxInputTokens: 128000, rates: { cacheMiss: 1.5, cacheHit: 0.3, output: 6 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 2.5, cacheHit: 0.5, output: 10 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 5, cacheHit: 1, output: 25 } },
      ],
    },
    {
      id: 'qwen3.8-2.4t-a95b',
      name: 'Qwen3.8-2.4T-A95B（开源版）',
      rates: { cacheMiss: 12, cacheHit: 12, output: 36 },
      notes: '缓存命中价未公开，按输入原价计。',
    },
    {
      id: 'qwen3.8-27b',
      name: 'Qwen3.8-27B（开源版）',
      rates: { cacheMiss: 3, cacheHit: 0.6, output: 12 },
    },
    {
      id: 'qwen3.6-35b-a3b',
      name: 'Qwen3.6-35B-A3B（开源版）',
      rates: { cacheMiss: 1.8, cacheHit: 1.8, output: 10.8 },
    },
    {
      id: 'qwen3.6-27b',
      name: 'Qwen3.6-27B（开源版）',
      rates: { cacheMiss: 3, cacheHit: 3, output: 18 },
    },
    {
      id: 'qwen3.5-397b-a17b',
      name: 'Qwen3.5-397B-A17B（开源版）',
      tiers: [
        { maxInputTokens: 128000, rates: { cacheMiss: 1.2, cacheHit: 1.2, output: 7.2 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 3, cacheHit: 3, output: 18 } },
      ],
    },
    {
      id: 'qwen3.5-122b-a10b',
      name: 'Qwen3.5-122B-A10B（开源版）',
      tiers: [
        { maxInputTokens: 128000, rates: { cacheMiss: 0.8, cacheHit: 0.8, output: 6.4 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 2, cacheHit: 2, output: 16 } },
      ],
    },
    {
      id: 'qwen3.5-27b',
      name: 'Qwen3.5-27B（开源版）',
      tiers: [
        { maxInputTokens: 128000, rates: { cacheMiss: 0.6, cacheHit: 0.6, output: 4.8 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 1.8, cacheHit: 1.8, output: 14.4 } },
      ],
    },
    {
      id: 'qwen3.5-35b-a3b',
      name: 'Qwen3.5-35B-A3B（开源版）',
      tiers: [
        { maxInputTokens: 128000, rates: { cacheMiss: 0.4, cacheHit: 0.4, output: 3.2 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 1.6, cacheHit: 1.6, output: 12.8 } },
      ],
    },
  ],
};
