// OpenAI — 官方美元价格，2026-10-20 读取。
// 来源: https://developers.openai.com/api/docs/pricing（OpenAI API 官方定价页；openai.com/api/pricing 为营销页/JS 渲染）
// 模型 ID / 上下文 / 快照与生命周期: https://developers.openai.com/api/docs/models 与各模型页
//   （/api/docs/models/<id>.md），停用时间表: https://developers.openai.com/api/docs/deprecations
// 证据与取舍说明见 catalog/world/notes/openai.md
export default {
  vendor: 'openai',
  name: 'OpenAI',
  nameEn: 'OpenAI',
  currency: { code: 'USD', symbol: '$' },
  source: 'https://developers.openai.com/api/docs/pricing',
  asOf: '2026-10-20',
  providers: ['openai', 'azure', 'azure-openai'],
  models: [
    {
      id: 'gpt-6-astra',
      name: 'GPT-6 Astra',
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 10, cacheHit: 1, cacheWrite: 12.5, output: 50 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 20, cacheHit: 2, cacheWrite: 25, output: 75 } },
      ],
      notes: '提示词超过 272K tokens 时按长上下文价计（2x 输入/缓存、1.5x 输出）。',
    },
    {
      id: 'gpt-6.1-sol',
      name: 'GPT-6.1 Sol',
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 2, cacheHit: 0.1, cacheWrite: 2.5, output: 10 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 4, cacheHit: 0.2, cacheWrite: 5, output: 15 } },
      ],
      notes: '提示词超过 272K tokens 时按长上下文价计；Fast 2x、Ultrafast 6x（未建模）。',
    },
    {
      id: 'gpt-6-luna',
      name: 'GPT-6 Luna',
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 0.1, cacheHit: 0.01, cacheWrite: 0.125, output: 0.5 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 0.2, cacheHit: 0.02, cacheWrite: 0.25, output: 0.75 } },
      ],
      notes: '提示词超过 272K tokens 时按长上下文价计（2x 输入/缓存、1.5x 输出）。',
    },
    {
      id: 'gpt-6-sol',
      name: 'GPT-6 Sol',
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 2, cacheHit: 0.2, cacheWrite: 2.5, output: 10 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 4, cacheHit: 0.4, cacheWrite: 5, output: 15 } },
      ],
      notes: '提示词超过 272K tokens 时按长上下文价计（2x 输入/缓存、1.5x 输出）。',
    },
    {
      id: 'gpt-5.6-sol',
      name: 'GPT-5.6 Sol',
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 4, cacheHit: 0.4, cacheWrite: 5, output: 20 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 8, cacheHit: 0.8, cacheWrite: 10, output: 30 } },
      ],
      notes: '限时促销价，至少维持到 2026-11-21；>272K 按长上下文价计。',
    },
    {
      id: 'gpt-5.6-terra',
      name: 'GPT-5.6 Terra',
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 2, cacheHit: 0.2, cacheWrite: 2.5, output: 12 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 4, cacheHit: 0.4, cacheWrite: 5, output: 18 } },
      ],
      notes: '提示词超过 272K tokens 时按长上下文价计（2x 输入/缓存、1.5x 输出）。',
    },
    {
      id: 'gpt-5.6-luna',
      name: 'GPT-5.6 Luna',
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 0.2, cacheHit: 0.02, cacheWrite: 0.25, output: 1.2 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 0.4, cacheHit: 0.04, cacheWrite: 0.5, output: 1.8 } },
      ],
      notes: '提示词超过 272K tokens 时按长上下文价计（2x 输入/缓存、1.5x 输出）。',
    },
    {
      id: 'gpt-5.6-cyber',
      name: 'GPT-5.6 Cyber',
      rates: { cacheMiss: 12.5, cacheHit: 1.25, cacheWrite: 15.625, output: 75 },
      notes: '需先加入 OpenAI Daybreak 计划（获批后可用）；单次最大输入 272K tokens，无长上下文加价。',
    },
    {
      id: 'gpt-5.5',
      name: 'GPT-5.5',
      aliases: ['gpt-5.5-2026-04-23'],
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 5, cacheHit: 0.5, output: 30 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 10, cacheHit: 1, output: 45 } },
      ],
      notes: '提示词超过 272K tokens 时按长上下文价计（2x 输入、1.5x 输出）。',
    },
    {
      id: 'gpt-5.5-pro',
      name: 'GPT-5.5 Pro',
      aliases: ['gpt-5.5-pro-2026-04-23'],
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 30, cacheHit: 30, output: 180 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 60, cacheHit: 60, output: 270 } },
      ],
      notes: '无缓存输入折扣（cacheHit 取输入价）；>272K 按长上下文价计。',
    },
    {
      id: 'gpt-5.5-cyber',
      name: 'GPT-5.5 Cyber',
      rates: { cacheMiss: 12.5, cacheHit: 1.25, output: 75 },
      notes: '仅限 Daybreak 计划获批机构；官方未提供公开模型页，无单独 cache-write 价。',
    },
    {
      id: 'gpt-5.4',
      name: 'GPT-5.4',
      aliases: ['gpt-5.4-2026-03-05'],
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 2.5, cacheHit: 0.25, output: 15 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 5, cacheHit: 0.5, output: 22.5 } },
      ],
      notes: '提示词超过 272K tokens 时按长上下文价计（2x 输入、1.5x 输出）。',
    },
    {
      id: 'gpt-5.4-mini',
      name: 'GPT-5.4 Mini',
      aliases: ['gpt-5.4-mini-2026-03-17'],
      rates: { cacheMiss: 0.75, cacheHit: 0.075, output: 4.5 },
      notes: '单次最大输入 272K tokens，无长上下文加价。',
    },
    {
      id: 'gpt-5.4-pro',
      name: 'GPT-5.4 Pro',
      aliases: ['gpt-5.4-pro-2026-03-05'],
      tiers: [
        { maxInputTokens: 272000, rates: { cacheMiss: 30, cacheHit: 30, output: 180 } },
        { maxInputTokens: 1050000, rates: { cacheMiss: 60, cacheHit: 60, output: 270 } },
      ],
      notes: '无缓存输入折扣（cacheHit 取输入价）；>272K 按长上下文价计。',
    },
    {
      id: 'gpt-5.2',
      name: 'GPT-5.2',
      aliases: ['gpt-5.2-2025-12-11'],
      rates: { cacheMiss: 1.75, cacheHit: 0.175, output: 14 },
    },
    {
      id: 'gpt-5.2-pro',
      name: 'GPT-5.2 Pro',
      aliases: ['gpt-5.2-pro-2025-12-11'],
      rates: { cacheMiss: 21, cacheHit: 21, output: 168 },
      notes: '无缓存输入折扣（cacheHit 取输入价）。',
    },
    {
      id: 'chat-latest',
      name: 'Chat Latest',
      rates: { cacheMiss: 5, cacheHit: 0.5, output: 30 },
      notes: '指向 ChatGPT 最新 Instant 模型的滚动别名（底层快照会更新）；建议生产 API 用 GPT-6 Astra。',
    },
    {
      id: 'gpt-rosalind-research',
      name: 'GPT-Rosalind Research',
      rates: { cacheMiss: 5, cacheHit: 0.5, output: 25 },
      notes: '生命科学模型，仅限获批机构（trusted-access 计划）；cache-write 计价不适用。',
    },
    {
      id: 'gpt-rosalind-discovery',
      name: 'GPT-Rosalind Discovery',
      rates: { cacheMiss: 5, cacheHit: 0.5, output: 25 },
      notes: '生命科学模型，仅限获批机构（trusted-access 计划）；cache-write 计价不适用。',
    },
  ],
};
