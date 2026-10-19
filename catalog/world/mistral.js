// Mistral AI — 官方美元 API 价格，2026-10-20 读取。
// 价格表: https://docs.mistral.ai/inference/pricing.md（Mistral 官方文档 “API pricing”）
// 公开定价页 https://mistral.ai/pricing 当前渲染的是 Vibe/Studio 套餐页；其 API 计费说明
// 指向官方文档价格表（本文件 source 取实际价目表 URL）。
// 模型 API name / 生命周期: https://docs.mistral.ai/models.md
// 证据、汇率无关说明、排除原因见 catalog/world/notes/mistral.md
export default {
  vendor: 'mistral',
  name: 'Mistral AI',
  nameEn: 'Mistral AI',
  currency: { code: 'USD', symbol: '$' },
  source: 'https://docs.mistral.ai/inference/pricing.md',
  asOf: '2026-10-20',
  providers: ['mistral'],
  models: [
    {
      id: 'mistral-large-4',
      name: 'Mistral Large 4',
      // 当前为限时促销价；原价 input $1.36 / cached $0.14 / output $4.18。
      rates: { cacheMiss: 0.68, cacheHit: 0.07, output: 2.09 },
      notes: 'Public Preview；现为促销价，原价 $1.36 / $0.14 / $4.18 每百万 tokens。',
    },
    {
      id: 'mistral-large-2512',
      name: 'Mistral Large 3',
      rates: { cacheMiss: 0.5, cacheHit: 0.5, output: 1.5 },
    },
    {
      id: 'mistral-medium-3-5',
      name: 'Mistral Medium 3.5',
      // DSH pi-ai ships this model as `mistral-medium-3.5` / `mistral-medium-2604`;
      // both route to the same official model and price (see notes/provider-map.md).
      aliases: ['mistral-medium-3.5', 'mistral-medium-2604'],
      rates: { cacheMiss: 1.5, cacheHit: 1.5, output: 7.5 },
    },
    {
      id: 'mistral-small-2603',
      name: 'Mistral Small 4',
      rates: { cacheMiss: 0.15, cacheHit: 0.15, output: 0.6 },
    },
    {
      id: 'ministral-14b-2512',
      name: 'Ministral 3 14B',
      rates: { cacheMiss: 0.2, cacheHit: 0.2, output: 0.2 },
    },
    {
      id: 'ministral-8b-2512',
      name: 'Ministral 3 8B',
      rates: { cacheMiss: 0.15, cacheHit: 0.15, output: 0.15 },
    },
    {
      id: 'ministral-3b-2512',
      name: 'Ministral 3 3B',
      rates: { cacheMiss: 0.1, cacheHit: 0.1, output: 0.1 },
    },
    {
      id: 'codestral-2508',
      name: 'Codestral 2508',
      rates: { cacheMiss: 0.3, cacheHit: 0.3, output: 0.9 },
      notes: '代码补全/FIM 模型，按 token 计费。',
    },
  ],
};
