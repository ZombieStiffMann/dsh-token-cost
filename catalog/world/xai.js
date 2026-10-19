// xAI (Grok) — 官方美元价格，2026-10-20 读取。
// 来源: https://docs.x.ai/developers/pricing（xAI 官方 API 定价页；docs.x.ai/docs/models 现 308 跳转到
//   https://docs.x.ai/developers/models）
// 模型 ID / 别名 / 上下文: https://docs.x.ai/developers/models 与各模型页 /developers/models/<id>
// 缓存与推理 token 计费: https://docs.x.ai/developers/advanced-api-usage/prompt-caching/usage-and-pricing
// 证据与取舍说明见 catalog/world/notes/xai.md
export default {
  vendor: 'xai',
  name: 'xAI',
  nameEn: 'xAI',
  currency: { code: 'USD', symbol: '$' },
  source: 'https://docs.x.ai/developers/pricing',
  asOf: '2026-10-20',
  providers: ['xai'],
  models: [
    {
      id: 'grok-4.7',
      name: 'Grok 4.7',
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 2, cacheHit: 0.5, output: 6 } },
        { maxInputTokens: 500000, rates: { cacheMiss: 4, cacheHit: 1, output: 12 } },
      ],
      notes: '提示词超过 200K tokens（长上下文）时按高档价计。',
    },
    {
      id: 'grok-4.6',
      name: 'Grok 4.6',
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 2, cacheHit: 0.5, output: 6 } },
        { maxInputTokens: 500000, rates: { cacheMiss: 4, cacheHit: 1, output: 12 } },
      ],
      notes: '提示词超过 200K tokens（长上下文）时按高档价计。',
    },
    {
      id: 'grok-4.5',
      name: 'Grok 4.5',
      aliases: ['grok-4.5-latest', 'grok-build-latest'],
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 2, cacheHit: 0.3, output: 6 } },
        { maxInputTokens: 500000, rates: { cacheMiss: 4, cacheHit: 0.6, output: 12 } },
      ],
      notes: '提示词超过 200K tokens（长上下文）时按高档价计。',
    },
    {
      id: 'grok-4.3',
      name: 'Grok 4.3',
      aliases: ['grok-4.3-latest'],
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 1.25, cacheHit: 0.2, output: 2.5 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 2.5, cacheHit: 0.4, output: 5 } },
      ],
      notes: '提示词超过 200K tokens（长上下文）时按高档价计。',
    },
    {
      id: 'grok-4.20-0309-reasoning',
      name: 'Grok 4.20 (Reasoning)',
      aliases: [
        'grok-4.20-reasoning-latest',
        'grok-4.20',
        'grok-4.20-reasoning',
        'grok-4.20-0309',
        'grok-4.20-beta-0309-reasoning',
        'grok-4.20-beta',
        'grok-4.20-beta-0309',
        'grok-4.20-beta-latest',
        'grok-4.20-beta-latest-reasoning',
        'grok-4.20-beta-reasoning',
        'grok-4.20-experimental-beta-0304-reasoning',
        'grok-4.20-experimental-beta-0304',
        'grok-4.20-experimental-beta-reasoning-latest',
        'grok-4.20-experimental-beta-latest',
        'grok-4.20-reasoning-gv2',
      ],
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 1.25, cacheHit: 0.2, output: 2.5 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 2.5, cacheHit: 0.4, output: 5 } },
      ],
      notes: '提示词超过 200K tokens（长上下文）时按高档价计。',
    },
    {
      id: 'grok-4.20-0309-non-reasoning',
      name: 'Grok 4.20 (Non-Reasoning)',
      aliases: [
        'grok-4.20-non-reasoning',
        'grok-4.20-non-reasoning-latest',
        'grok-4.20-beta-non-reasoning',
        'grok-4.20-beta-latest-non-reasoning',
        'grok-4.20-experimental-beta-0304-non-reasoning',
        'grok-4.20-experimental-beta-non-reasoning-latest',
        'grok-4.20-beta-0309-non-reasoning',
        'grok-4.20-non-reasoning-gv2',
      ],
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 1.25, cacheHit: 0.2, output: 2.5 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 2.5, cacheHit: 0.4, output: 5 } },
      ],
      notes: '提示词超过 200K tokens（长上下文）时按高档价计。',
    },
    {
      id: 'grok-4.20-multi-agent-0309',
      name: 'Grok 4.20 Multi-Agent',
      aliases: [
        'grok-4.20-multi-agent',
        'grok-4.20-multi-agent-latest',
        'grok-4.20-multi-agent-beta-latest',
        'grok-4.20-multi-agent-experimental-beta-0304',
        'grok-4.20-multi-agent-experimental-beta-latest',
        'grok-4.20-multi-agent-beta-0309',
      ],
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 1.25, cacheHit: 0.2, output: 2.5 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 2.5, cacheHit: 0.4, output: 5 } },
      ],
      notes: '多智能体并行深度研究模型（Beta）；提示词超过 200K tokens 时按高档价计。',
    },
    {
      id: 'grok-build-0.1',
      name: 'Grok Build 0.1',
      aliases: ['grok-code-fast-1', 'grok-code-fast', 'grok-code-fast-1-0825'],
      tiers: [
        { maxInputTokens: 200000, rates: { cacheMiss: 1, cacheHit: 0.2, output: 2 } },
        { maxInputTokens: 256000, rates: { cacheMiss: 2, cacheHit: 0.4, output: 4 } },
      ],
      notes: '编码模型；旧 slug grok-code-fast-1 等会重定向到此；提示词超过 200K tokens 时按高档价计。',
    },
  ],
};
