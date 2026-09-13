/**
 * Honest 402: inactive plan is not a balance failure.
 * Run: npx tsx src/lib/gateway/debit.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const srcRoot = path.join(import.meta.dirname, '../..');

function src(rel: string): string {
  return readFileSync(path.join(srcRoot, rel), 'utf8');
}

const debit = src('lib/gateway/debit.ts');
assert.match(debit, /export class PlanNotActiveError/);
assert.match(debit, /super\('plan not active'\)/);
const reserveFn = debit.slice(
  debit.indexOf('export async function reserveCredits'),
  debit.indexOf('export async function rebindGatewayJob')
);
const planGate = reserveFn.match(/if \(readPlanStatus\(data\) !== 'active'\) \{[^}]+\}/);
assert.ok(planGate, 'reserveCredits plan-status gate missing');
assert.match(planGate[0], /throw new PlanNotActiveError\(\)/);
assert.doesNotMatch(planGate[0], /InsufficientCreditsError/);
assert.match(reserveFn, /if \(!result\.ok\) \{[\s\S]*?throw new InsufficientCreditsError\(\)/);

const fal = src('lib/fal/handleQueue.ts');
assert.match(fal, /PlanNotActiveError/);
assert.match(fal, /jsonError\(403, 'plan not active'\)/);
assert.match(fal, /jsonError\(402, 'insufficient credits'\)/);
assert.match(fal, /jsonError\(502, 'Fal submit failed'\)/);
assert.doesNotMatch(fal, /jsonError\(402, 'plan not active'\)/);
assert.doesNotMatch(fal, /jsonError\(402, 'Fal submit failed'\)/);

const chat = src('app/api/gateway/chat/completions/route.ts');
assert.match(chat, /PlanNotActiveError/);
assert.match(chat, /openaiError\(403, 'plan not active'/);
assert.match(chat, /insufficient credits/);

const tavily = src('lib/tavily/handleRequest.ts');
assert.match(tavily, /PlanNotActiveError/);
assert.match(tavily, /jsonError\(403, 'plan not active'\)/);
assert.match(tavily, /jsonError\(402, 'insufficient credits'\)/);

console.log('debit.selfcheck: ok');
