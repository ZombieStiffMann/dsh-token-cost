// 智谱 AI (GLM) — 官方人民币价格，2026-10-19 读取。
// 来源: https://docs.bigmodel.cn/cn/guide/start/pricing
// 证据与取舍说明见 catalog/china/notes/zhipu.md
export default {
  vendor: 'zhipu',
  name: '智谱 AI',
  nameEn: 'Zhipu AI',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://docs.bigmodel.cn/cn/guide/start/pricing',
  asOf: '2026-10-19',
  providers: ['zai'],
  models: [
    {
      id: 'glm-5.3',
      name: 'GLM-5.3',
      rates: { cacheMiss: 8, cacheHit: 2, output: 28 },
    },
    {
      id: 'glm-5.3-flash',
      name: 'GLM-5.3-Flash',
      rates: { cacheMiss: 0.8, cacheHit: 0.23, output: 2.8 },
      notes: '原生多模态输入（图片/视频/文件/文本），按文本 token 计费。',
    },
    {
      id: 'glm-5.3-flashx',
      name: 'GLM-5.3-FlashX',
      rates: { cacheMiss: 2, cacheHit: 0.57, output: 7 },
      notes: '原生多模态输入（图片/视频/文件/文本），按文本 token 计费。',
    },
    {
      id: 'glm-5.2',
      name: 'GLM-5.2',
      rates: { cacheMiss: 8, cacheHit: 2, output: 28 },
    },
    {
      id: 'glm-5.1',
      name: 'GLM-5.1',
      tiers: [
        { maxInputTokens: 32768, rates: { cacheMiss: 6, cacheHit: 1.3, output: 24 } },
        { maxInputTokens: 204800, rates: { cacheMiss: 8, cacheHit: 2, output: 28 } },
      ],
    },
    {
      id: 'glm-5-turbo',
      name: 'GLM-5-Turbo',
      tiers: [
        { maxInputTokens: 32768, rates: { cacheMiss: 5, cacheHit: 1.2, output: 22 } },
        { maxInputTokens: 204800, rates: { cacheMiss: 7, cacheHit: 1.8, output: 26 } },
      ],
    },
    {
      id: 'glm-5',
      name: 'GLM-5',
      tiers: [
        { maxInputTokens: 32768, rates: { cacheMiss: 4, cacheHit: 1, output: 18 } },
        { maxInputTokens: 204800, rates: { cacheMiss: 6, cacheHit: 1.5, output: 22 } },
      ],
    },
    {
      id: 'glm-4.7',
      name: 'GLM-4.7',
      tiers: [
        { maxInputTokens: 32768, rates: { cacheMiss: 3, cacheHit: 0.6, output: 14 } },
        { maxInputTokens: 204800, rates: { cacheMiss: 4, cacheHit: 0.8, output: 16 } },
      ],
      notes: '本档为输出 ≥0.2K tokens 的价格；输出 <0.2K tokens 时为 ¥2/¥8（缓存命中 ¥0.4）。',
    },
    {
      id: 'glm-4.5-air',
      name: 'GLM-4.5-Air',
      tiers: [
        { maxInputTokens: 32768, rates: { cacheMiss: 0.8, cacheHit: 0.16, output: 6 } },
        { maxInputTokens: 131072, rates: { cacheMiss: 1.2, cacheHit: 0.24, output: 8 } },
      ],
      notes: '输出 <0.2K tokens 时输出价为 ¥2；本档为输出 ≥0.2K tokens 的价格。',
    },
    {
      id: 'glm-4.7-flashx',
      name: 'GLM-4.7-FlashX',
      rates: { cacheMiss: 0.5, cacheHit: 0.1, output: 3 },
    },
    {
      id: 'glm-4-long',
      name: 'GLM-4-Long',
      rates: { cacheMiss: 1, cacheHit: 0.5, output: 1 },
    },
    {
      id: 'glm-4-flashx-250414',
      name: 'GLM-4-FlashX-250414',
      rates: { cacheMiss: 0.1, cacheHit: 0.05, output: 0.1 },
    },
  ],
};
