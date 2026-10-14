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
  creditsFromUsd,
  hasPositiveRates,
  isRouterAliasModel,
  MARGIN,
  PLACEHOLDER_CREDITS_PER_USD,
  ROUTER_ALIAS_MODELS,
  ROUTER_RESERVE_FALLBACK_MODEL,
  settleBillModel,
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

const fromUsd = creditsFromUsd(0.006);
assert.equal(fromUsd.rawUsd, 0.006);
assert.equal(fromUsd.costUsd, 0.012);
assert.equal(fromUsd.credits, Math.ceil(0.006 * 2.0 * 1000));
assert.equal(creditsFromUsd(0).credits, 0);
assert.equal(creditsFromUsd(-1).credits, 0);

const chatPad = creditsFromTokens({
  promptTokens: 4096,
  completionTokens: 4096,
  promptPerToken: 1e-6,
  completionPerToken: 2e-6,
});
assert.equal(chatPad.credits, Math.ceil((4096 * 1e-6 + 4096 * 2e-6) * 2.0 * 1000));

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

// response.model must be captured for Auto/router settle
const scanModel: UsageScan = {};
absorbSseLine(
  scanModel,
  'data: {"id":"gen-2","model":"anthropic/claude-sonnet-5","usage":{"prompt_tokens":1,"completion_tokens":2}}'
);
assert.equal(scanModel.model, 'anthropic/claude-sonnet-5');
assert.equal(scanModel.id, 'gen-2');

// Router aliases are never "free" even when catalog rates are 0/0
assert.ok(ROUTER_ALIAS_MODELS.has('openrouter/auto'));
assert.ok(ROUTER_ALIAS_MODELS.has('openrouter/auto-beta'));
assert.ok(ROUTER_ALIAS_MODELS.has('openrouter/pareto-code'));
assert.equal(isRouterAliasModel('openrouter/auto-beta'), true);
assert.equal(isRouterAliasModel('openrouter/pareto-code'), true);
assert.equal(isRouterAliasModel('anthropic/claude-sonnet-5'), false);
assert.equal(ROUTER_RESERVE_FALLBACK_MODEL, 'anthropic/claude-opus-5');

const zeroRates = { promptPerToken: 0, completionPerToken: 0 };
assert.equal(hasPositiveRates(zeroRates), false);
assert.equal(hasPositiveRates({ promptPerToken: 1e-6, completionPerToken: 0 }), true);
assert.equal(
  creditsFromTokens({
    promptTokens: 100,
    completionTokens: 10,
    promptPerToken: 0,
    completionPerToken: 0,
  }).credits,
  0
);
// Alias + zero rates must not be treated as free: gate forces reserve path
assert.equal(
  isRouterAliasModel('openrouter/auto-beta') && !hasPositiveRates(zeroRates),
  true
);

assert.equal(
  settleBillModel('openrouter/auto-beta', 'anthropic/claude-sonnet-5'),
  'anthropic/claude-sonnet-5'
);
assert.equal(settleBillModel('openrouter/auto-beta', undefined), null);
assert.equal(settleBillModel('openrouter/auto-beta', 'openrouter/auto-beta'), null);
assert.equal(
  settleBillModel('anthropic/claude-sonnet-5', undefined),
  'anthropic/claude-sonnet-5'
);

const creditsSrc = fs.readFileSync(path.join(dir, '../../types/credits.ts'), 'utf8');
assert.doesNotMatch(creditsSrc, /PLACEHOLDER_CREDITS_PER_USD/);
assert.doesNotMatch(creditsSrc, /credits-per-dollar|credits per dollar|USD ratio|usd ratio/i);
assert.doesNotMatch(creditsSrc, /MARGIN\s*=/);

const pricingSrc = fs.readFileSync(path.join(dir, 'pricing.ts'), 'utf8');
assert.match(pricingSrc, /env\.siteUrl/);
assert.doesNotMatch(pricingSrc, /www\.okvevo\.com/);
assert.match(pricingSrc, /resolveChatReserveRates/);
assert.match(pricingSrc, /lookupMaxRatesAmongModels/);

const sseSrc = fs.readFileSync(path.join(dir, 'sse.ts'), 'utf8');
assert.match(sseSrc, /scan\.model = obj\.model/);

const routeSrc = fs.readFileSync(
  path.join(dir, '../../app/api/gateway/chat/completions/route.ts'),
  'utf8'
);
assert.match(routeSrc, /resolveChatReserveRates/);
assert.match(routeSrc, /isRouterAliasModel/);
assert.match(routeSrc, /allowedModelsFromBody/);
assert.match(routeSrc, /mustMeter/);

const debitSrc = fs.readFileSync(path.join(dir, 'debit.ts'), 'utf8');
assert.match(debitSrc, /settleBillModel/);
assert.match(debitSrc, /isRouterAliasModel\(model\)/);
assert.match(debitSrc, /debit reserve for router settle/);

console.log('pricing.selfcheck: ok');
