/**
 * Tavily credit formula: search 1–2; extract per 5 successful URLs;
 * usage.credits === 0 is not free.
 * Run: npx tsx src/lib/tavily/credits.selfcheck.ts
 */
import assert from 'node:assert/strict';

import { creditsFromUsd } from '../gateway/pricing.ts';
import {
  billedTavilyCredits,
  DEFAULT_TAVILY_USD_PER_CREDIT,
  estimateTavilyCredits,
  tavilyUsdPerCredit,
  urlList,
} from './credits.ts';

assert.equal(DEFAULT_TAVILY_USD_PER_CREDIT, 0.008);
assert.equal(tavilyUsdPerCredit({}), 0.008);
assert.equal(tavilyUsdPerCredit({ TAVILY_USD_PER_CREDIT: '0.005' }), 0.005);
assert.equal(tavilyUsdPerCredit({ TAVILY_USD_PER_CREDIT: 'nope' }), 0.008);

assert.equal(estimateTavilyCredits('search', { query: 'q' }), 1);
assert.equal(estimateTavilyCredits('search', { query: 'q', search_depth: 'advanced' }), 2);
assert.equal(estimateTavilyCredits('search', { search_depth: 'fast' }), 1);

assert.deepEqual(urlList({ urls: ['https://a.com', 'https://b.com'] }), [
  'https://a.com',
  'https://b.com',
]);
assert.equal(estimateTavilyCredits('extract', { urls: ['u1', 'u2', 'u3'] }), 1);
assert.equal(
  estimateTavilyCredits('extract', {
    urls: ['1', '2', '3', '4', '5', '6'],
    extract_depth: 'advanced',
  }),
  4
);
assert.equal(estimateTavilyCredits('extract', { urls: [] }), 0);

assert.equal(
  billedTavilyCredits('search', { query: 'q' }, { usage: { credits: 2 } }),
  2
);
assert.equal(
  billedTavilyCredits(
    'extract',
    { urls: ['a', 'b', 'c'] },
    { usage: { credits: 0 }, results: [{ url: 'a' }, { url: 'b' }, { url: 'c' }] }
  ),
  1
);
assert.equal(
  billedTavilyCredits('extract', { urls: ['a'] }, { usage: { credits: 0 }, results: [] }),
  0
);

const one = creditsFromUsd(1 * 0.008);
assert.equal(one.credits, 16);
assert.equal(one.costUsd, 0.016);

console.log('tavily credits.selfcheck: ok');
