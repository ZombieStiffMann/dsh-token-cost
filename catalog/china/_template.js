// Template for a China vendor catalog file. Copy to catalog/china/<vendor>.js,
// fill in real published CNY prices, then run: node catalog/validate.js
//
// See SCHEMA.md for the full data contract. Files starting with "_" are ignored
// by the loader/validator.
export default {
  vendor: 'example',
  name: '示例厂商',
  nameEn: 'Example AI',
  currency: { code: 'CNY', symbol: '¥' },
  source: 'https://example.com/pricing',
  asOf: '2026-10-19',
  providers: ['example'],
  models: [
    {
      id: 'example-chat',
      name: 'Example Chat',
      rates: { cacheMiss: 2, cacheHit: 0.4, output: 8 },
    },
  ],
};
