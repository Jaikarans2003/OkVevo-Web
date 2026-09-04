/**
 * Gateway pricing: per-token × tokens × 2.0 × 1000.
 * Run: npx tsx src/lib/gateway/pricing.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clampDebitAmount,
  creditsFromTokens,
  MARGIN,
  PLACEHOLDER_CREDITS_PER_USD,
} from './pricing.ts';
import { absorbSseLine, tokenCounts, type UsageScan } from './sse.ts';

const dir = path.dirname(fileURLToPath(import.meta.url));

assert.equal(MARGIN, 2.0);
assert.equal(PLACEHOLDER_CREDITS_PER_USD, 1000);

const promptPerToken = 3e-6;
const completionPerToken = 15e-6;
const promptTokens = 1_000_000;
const completionTokens = 500_000;

const inputPricePerMillion = promptPerToken * 1e6;
const outputPricePerMillion = completionPerToken * 1e6;
const writtenRaw =
  (promptTokens / 1e6) * inputPricePerMillion +
  (completionTokens / 1e6) * outputPricePerMillion;
const impl = creditsFromTokens({
  promptTokens,
  completionTokens,
  promptPerToken,
  completionPerToken,
});
assert.equal(impl.rawUsd, writtenRaw);
assert.equal(impl.costUsd, writtenRaw * 2.0);
assert.equal(impl.credits, Math.ceil(writtenRaw * 2.0 * 1000));

const tiny = creditsFromTokens({
  promptTokens: 1,
  completionTokens: 0,
  promptPerToken: 1e-9,
  completionPerToken: 0,
});
assert.equal(tiny.credits, 1);

const free = creditsFromTokens({
  promptTokens: 100,
  completionTokens: 10,
  promptPerToken: 0,
  completionPerToken: 0,
});
assert.equal(free.credits, 0);

assert.equal(clampDebitAmount(12, 5), 5);
assert.equal(clampDebitAmount(12, 20), 12);
assert.equal(clampDebitAmount(0, 20), 0);
assert.equal(clampDebitAmount(12, 0), 0);

const scan: UsageScan = {};
absorbSseLine(scan, ': OPENROUTER PROCESSING');
absorbSseLine(scan, 'data: [DONE]');
absorbSseLine(
  scan,
  'data: {"id":"gen-1","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":7}}'
);
assert.equal(scan.id, 'gen-1');
assert.deepEqual(tokenCounts(scan.usage), { promptTokens: 3, completionTokens: 7 });

const creditsSrc = fs.readFileSync(path.join(dir, '../../types/credits.ts'), 'utf8');
assert.doesNotMatch(creditsSrc, /PLACEHOLDER_CREDITS_PER_USD/);
assert.doesNotMatch(creditsSrc, /credits-per-dollar|credits per dollar|USD ratio|usd ratio/i);
assert.doesNotMatch(creditsSrc, /MARGIN\s*=/);

console.log('pricing.selfcheck: ok');
