// Google Gemini — 官方美元价格，2026-10-20 读取。
// 来源: https://ai.google.dev/gemini-api/docs/pricing（页面标注 Last updated 2026-10-16 UTC）
// 模型 ID: https://ai.google.dev/gemini-api/docs/models（Endpoint 列）+ 各模型详情页
// 证据与取舍说明见 catalog/world/notes/google.md
export default {
  vendor: 'google',
  name: 'Google Gemini',
  nameEn: 'Google Gemini',
  currency: { code: 'USD', symbol: '$' },
  source: 'https://ai.google.dev/gemini-api/docs/pricing',
  asOf: '2026-10-20',
  providers: ['google', 'gemini'],
  models: [
    {
      id: 'gemini-4-argon',
      name: 'Gemini 4 Argon',
      rates: { cacheMiss: 2, cacheHit: 0.1, output: 10 },
      notes: '促销价至 2026-11-30，12-01 起为 $4/$20（缓存 $0.20）；仅支持隐式缓存。',
    },
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      rates: { cacheMiss: 0.75, cacheHit: 0.075, output: 3.75 },
      notes: '促销价至 2026-12-31，2027-01-01 起为 $1.50/$7.50（缓存 $0.15）。',
    },
    {
      id: 'gemini-3.6-flash',
      name: 'Gemini 3.6 Flash',
      rates: { cacheMiss: 0.75, cacheHit: 0.075, output: 3.75 },
      notes: '促销价至 2026-12-31，2027-01-01 起为 $1.50/$7.50（缓存 $0.15）。',
    },
    {
      id: 'gemini-3.5-flash-lite',
      name: 'Gemini 3.5 Flash-Lite',
      rates: { cacheMiss: 0.3, cacheHit: 0.03, output: 2.5 },
    },
    {
      id: 'gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash-Lite',
      rates: { cacheMiss: 0.25, cacheHit: 0.025, output: 1.5 },
      notes: '音频输入另按 $0.50/百万 tokens 计。',
    },
    {
      id: 'gemini-3.1-pro-preview',
      name: 'Gemini 3.1 Pro (Preview)',
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 2, cacheHit: 0.2, output: 12 } },
        { maxInputTokens: 1048576, rates: { cacheMiss: 4, cacheHit: 0.4, output: 18 } },
      ],
      notes: '提示词超过 20 万 tokens 时按高档价计。',
    },
    {
      id: 'gemini-3-flash-preview',
      name: 'Gemini 3 Flash (Preview)',
      rates: { cacheMiss: 0.5, cacheHit: 0.05, output: 3 },
      notes: '音频输入另按 $1.00/百万 tokens 计。',
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 1.25, cacheHit: 0.125, output: 10 } },
        { maxInputTokens: 1048576, rates: { cacheMiss: 2.5, cacheHit: 0.25, output: 15 } },
      ],
      notes: '提示词超过 20 万 tokens 时按高档价计。',
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      rates: { cacheMiss: 0.3, cacheHit: 0.03, output: 2.5 },
      notes: '音频输入另按 $1.00/百万 tokens 计。',
    },
    {
      id: 'gemini-2.5-flash-lite',
      name: 'Gemini 2.5 Flash-Lite',
      rates: { cacheMiss: 0.1, cacheHit: 0.01, output: 0.4 },
      notes: '音频输入另按 $0.30/百万 tokens 计。',
    },
  ],
};
