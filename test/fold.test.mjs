/**
 * Fold and pricing tests for the Host half. Run with the bundled Node:
 *   node --test test/fold.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCostProjectionDefinition, PROJECTION_KEY } from '../index.js';
import { isPeakTime, normalizePricing } from '../pricing.js';

const HOUR = 3600 * 1000;
/** Monday, 2026-10-19, in Beijing time. */
const MONDAY = Date.parse('2026-10-19T00:00:00+08:00');
const at = (dayOffset, hour, minute = 0) => MONDAY + dayOffset * 24 * HOUR + hour * HOUR + minute * 60 * 1000;

function makeProjection(customPricing) {
  const pricing = normalizePricing(customPricing);
  return { definition: createCostProjectionDefinition({ current: pricing }), pricing };
}

/** Feed events through the projection and return the final state (host state, not view). */
function fold(definition, events) {
  let state = definition.init();
  for (const event of events) state = definition.apply(state, event);
  return state;
}

function viewOf(definition, state) {
  return definition.wire.view(state);
}

function usageEvent(type, { turn = 1, step = 1, usage, time, provider = 'deepseek-official', model = 'deepseek-flash' }) {
  const stream = type === 'assistant/attempt' ? [{ type: 'chunk', chunk: { type: 'usage', usage } }] : [];
  const data = {
    turn,
    step,
    usage,
    stream,
    message: { role: 'assistant', source: { kind: 'model', provider, model } },
  };
  return { type, seq: 0, time, data };
}

test('catalog exposes the official peak rates for the two shipped models', () => {
  const { pricing } = makeProjection(undefined);
  assert.equal(pricing.currency.code, 'CNY');
  assert.deepEqual(pricing.models['deepseek-flash'].rates, { cacheMiss: 2, cacheHit: 0.04, output: 8 });
  assert.deepEqual(pricing.models['deepseek-v4-pro'].rates, { cacheMiss: 9, cacheHit: 0.3, output: 27 });
  assert.equal(pricing.offPeakMultiplier, 0.5);
});

test('cache-write tokens are billed at the cache-miss rate', () => {
  const { definition } = makeProjection(undefined);
  const state = fold(definition, [
    usageEvent('assistant/message', {
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 1000 },
      time: at(0, 10),
    }),
  ]);
  assert.equal(viewOf(definition, state).micro, 2000);
});

test('reasoning tokens are not billed twice', () => {
  const { definition } = makeProjection(undefined);
  const state = fold(definition, [
    usageEvent('assistant/message', {
      usage: { inputTokens: 0, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 100 },
      time: at(0, 10),
    }),
  ]);
  const view = viewOf(definition, state);
  assert.equal(view.micro, 800, 'output bucket already contains reasoning');
  assert.equal(view.tokens.reasoning, 100);
});

test('peak band follows Beijing weekday windows and statutory holidays', () => {
  const { pricing } = makeProjection(undefined);
  const holidays = new Set(pricing.holidays);
  assert.equal(isPeakTime(pricing, at(0, 10), holidays), true, 'Monday 10:00 is peak');
  assert.equal(isPeakTime(pricing, at(0, 11, 59), holidays), true);
  assert.equal(isPeakTime(pricing, at(0, 12), holidays), false, '12:00 is off-peak');
  assert.equal(isPeakTime(pricing, at(0, 15), holidays), true);
  assert.equal(isPeakTime(pricing, at(0, 18), holidays), false, '18:00 is off-peak');
  assert.equal(isPeakTime(pricing, at(0, 8), holidays), false);
  assert.equal(isPeakTime(pricing, at(0, 13), holidays), false);
  assert.equal(isPeakTime(pricing, at(5, 10), holidays), false, 'Saturday is off-peak');
  // 2026-10-01 is a Thursday statutory holiday (National Day).
  assert.equal(isPeakTime(pricing, Date.parse('2026-10-01T10:00:00+08:00'), holidays), false, 'statutory holiday is off-peak');
  // 2026-09-25 is a Friday statutory holiday (Mid-Autumn).
  assert.equal(isPeakTime(pricing, Date.parse('2026-09-25T10:00:00+08:00'), holidays), false);
});

test('peak sample prices at peak rates, off-peak sample at half', () => {
  const peakUsage = { inputTokens: 1000, outputTokens: 300, cacheReadTokens: 2000, cacheWriteTokens: 0, totalTokens: 3300 };
  const peak = makeProjection(undefined);
  const peakState = fold(peak.definition, [usageEvent('assistant/message', { usage: peakUsage, time: at(0, 10) })]);
  const peakView = viewOf(peak.definition, peakState);
  // 1000*2 + 2000*0.04 + 300*8 = 4480 micro-CNY = 0.00448 CNY
  assert.equal(peakView.micro, 4480);
  assert.equal(peakView.peakMicro, 4480);
  assert.equal(peakView.offPeakMicro, 0);

  const off = makeProjection(undefined);
  const offState = fold(off.definition, [usageEvent('assistant/message', { usage: peakUsage, time: at(0, 13) })]);
  const offView = viewOf(off.definition, offState);
  assert.equal(offView.micro, 2240);
  assert.equal(offView.offPeakMicro, 2240);
  assert.equal(offView.saving, 2240);
  assert.deepEqual(offView.tokens, { input: 1000, cacheRead: 2000, cacheWrite: 0, output: 300, reasoning: 0 });
});

test('a later sample of the same step replaces the earlier attempt sample', () => {
  const { definition } = makeProjection(undefined);
  const streamUsage = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const finalUsage = { inputTokens: 1000, outputTokens: 300, cacheReadTokens: 2000, cacheWriteTokens: 0 };
  const attempt = {
    type: 'assistant/attempt',
    seq: 1,
    time: at(0, 10),
    data: { turn: 1, step: 1, stream: [{ type: 'chunk', chunk: { type: 'usage', usage: streamUsage } }] },
  };
  const state = fold(definition, [
    { type: 'request/header', seq: 0, time: at(0, 9, 59), data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-flash' } } } },
    attempt,
    usageEvent('assistant/message', { usage: finalUsage, time: at(0, 10, 5) }),
  ]);
  const view = viewOf(definition, state);
  assert.equal(view.micro, 4480, 'only the final sample is billed');
  assert.equal(view.events, 1);
  assert.equal(view.models.length, 1);
});

test('llm/retry-started closes the replacement slot so both attempts are billed', () => {
  const { definition } = makeProjection(undefined);
  const first = { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const second = { inputTokens: 2000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const state = fold(definition, [
    { type: 'request/header', seq: 0, time: at(0, 9, 59), data: { header: { config: { provider: 'deepseek-official', model: 'deepseek-flash' } } } },
    usageEvent('assistant/attempt', { usage: first, time: at(0, 10) }),
    { type: 'llm/retry-started', seq: 2, time: at(0, 10, 1), data: { turn: 1, step: 1 } },
    usageEvent('assistant/message', { usage: second, time: at(0, 10, 2) }),
  ]);
  const view = viewOf(definition, state);
  // (1000+2000)*2 + (100+200)*8 = 6000 + 2400 = 8400 micro
  assert.equal(view.micro, 8400);
  assert.equal(view.events, 2);
});

test('an unpriced provider route is disclosed instead of silently costing zero', () => {
  const { definition } = makeProjection(undefined);
  const state = fold(definition, [
    {
      type: 'assistant/message',
      seq: 1,
      time: at(0, 10),
      data: {
        turn: 1,
        step: 1,
        usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 },
        message: { role: 'assistant', source: { kind: 'model', provider: 'xiaomi', model: 'mimo-v2.6-pro' } },
      },
    },
  ]);
  const view = viewOf(definition, state);
  assert.equal(view.micro, 0);
  assert.equal(view.unpricedTokens, 120);
  assert.deepEqual(view.unpricedModels, ['mimo-v2.6-pro']);
});

test('the legacy deepseek-chat alias is billed at Flash rates', () => {
  const { definition } = makeProjection(undefined);
  const state = fold(definition, [
    usageEvent('assistant/message', {
      usage: { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
      time: at(0, 10),
      model: 'deepseek-chat',
    }),
  ]);
  const view = viewOf(definition, state);
  assert.equal(view.micro, 1000 * 2 + 100 * 8);
});

test('config can override rates and add holidays without changing the catalog shape', () => {
  const { definition, pricing } = makeProjection({
    models: { 'deepseek-flash': { rates: { cacheMiss: 100 } } },
    additionalHolidays: ['2026-10-19'],
  });
  assert.equal(pricing.models['deepseek-flash'].rates.cacheMiss, 100);
  assert.equal(pricing.models['deepseek-flash'].rates.output, 8, 'unmentioned rates are inherited');
  assert.ok(pricing.holidays.includes('2026-10-19'));
  const state = fold(definition, [
    usageEvent('assistant/message', {
      usage: { inputTokens: 10, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      time: at(0, 10),
    }),
  ]);
  const view = viewOf(definition, state);
  // A configured holiday makes the Monday sample off-peak: 10 * 100 * 0.5 = 500
  assert.equal(view.micro, 500);
});

test('invalid configuration falls back to the built-in catalog', () => {
  const { pricing } = makeProjection({ models: { 'deepseek-flash': { rates: { cacheMiss: -1 } } } });
  assert.deepEqual(pricing.models['deepseek-flash'].rates, { cacheMiss: 2, cacheHit: 0.04, output: 8 });
  assert.equal(PROJECTION_KEY, 'tokenCost');
});
