// Anthropic (Claude) — 官方美元价格，2026-10-20 读取。
// 来源: https://platform.claude.com/docs/en/about-claude/pricing
//   （anthropic.com/pricing → claude.com/pricing；docs.anthropic.com pricing 页 → platform.claude.com）
// 模型 ID 与生命周期: https://platform.claude.com/docs/en/about-claude/models、.../model-deprecations
// 证据与取舍说明见 catalog/world/notes/anthropic.md
export default {
  vendor: 'anthropic',
  name: 'Anthropic',
  nameEn: 'Anthropic (Claude)',
  currency: { code: 'USD', symbol: '$' },
  source: 'https://platform.claude.com/docs/en/about-claude/pricing',
  asOf: '2026-10-20',
  providers: ['anthropic', 'claude'],
  models: [
    {
      id: 'claude-fable-5-1',
      name: 'Claude Fable 5.1',
      rates: { cacheMiss: 10, cacheHit: 0.25, cacheWrite: 12.5, output: 50 },
    },
    {
      id: 'claude-opus-5-5',
      name: 'Claude Opus 5.5',
      rates: { cacheMiss: 4, cacheHit: 0.2, cacheWrite: 5, output: 20 },
    },
    {
      id: 'claude-sonnet-5-5',
      name: 'Claude Sonnet 5.5',
      rates: { cacheMiss: 2, cacheHit: 0.1, cacheWrite: 2.5, output: 10 },
    },
    {
      id: 'claude-haiku-5-5',
      name: 'Claude Haiku 5.5',
      tiers: [
        { maxInputTokens: 100000, rates: { cacheMiss: 0.1, cacheHit: 0.01, cacheWrite: 0.125, output: 0.5 } },
        { maxInputTokens: 1000000, rates: { cacheMiss: 0.5, cacheHit: 0.05, cacheWrite: 0.625, output: 2.5 } },
      ],
      notes: '按单次提示长度分档：超过 10 万 tokens 时按高档价计。',
    },
    {
      id: 'claude-mythos-5-1',
      name: 'Claude Mythos 5.1',
      rates: { cacheMiss: 10, cacheHit: 0.25, cacheWrite: 12.5, output: 50 },
      notes: '仅限通过 Anthropic 验证计划的组织使用（与 Fable 5.1 同价）。',
    },
    {
      id: 'claude-mythos-5',
      name: 'Claude Mythos 5',
      rates: { cacheMiss: 10, cacheHit: 1, cacheWrite: 12.5, output: 50 },
      notes: '仅限通过 Anthropic 验证计划的组织使用（与 Fable 5 同价）。',
    },
    {
      id: 'claude-fable-5',
      name: 'Claude Fable 5',
      rates: { cacheMiss: 10, cacheHit: 1, cacheWrite: 12.5, output: 50 },
    },
    {
      id: 'claude-opus-5',
      name: 'Claude Opus 5',
      rates: { cacheMiss: 5, cacheHit: 0.5, cacheWrite: 6.25, output: 25 },
    },
    {
      id: 'claude-opus-4-8',
      name: 'Claude Opus 4.8',
      rates: { cacheMiss: 5, cacheHit: 0.5, cacheWrite: 6.25, output: 25 },
    },
    {
      id: 'claude-opus-4-7',
      name: 'Claude Opus 4.7',
      rates: { cacheMiss: 5, cacheHit: 0.5, cacheWrite: 6.25, output: 25 },
    },
    {
      id: 'claude-opus-4-6',
      name: 'Claude Opus 4.6',
      rates: { cacheMiss: 5, cacheHit: 0.5, cacheWrite: 6.25, output: 25 },
    },
    {
      id: 'claude-opus-4-5-20251101',
      name: 'Claude Opus 4.5',
      aliases: ['claude-opus-4-5'],
      rates: { cacheMiss: 5, cacheHit: 0.5, cacheWrite: 6.25, output: 25 },
    },
    {
      id: 'claude-sonnet-5',
      name: 'Claude Sonnet 5',
      rates: { cacheMiss: 2, cacheHit: 0.2, cacheWrite: 2.5, output: 10 },
    },
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      rates: { cacheMiss: 3, cacheHit: 0.3, cacheWrite: 3.75, output: 15 },
    },
    {
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      aliases: ['claude-haiku-4-5'],
      rates: { cacheMiss: 1, cacheHit: 0.1, cacheWrite: 1.25, output: 5 },
    },
  ],
};
