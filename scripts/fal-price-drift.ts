/**
 * Price drift against the generation credential (FAL_KEY), not FAL_BILLING_KEY.
 * Compares live-expressible tiers only. Does not change charges or rateCard.ts.
 *
 * Card-update runbook:
 * 1. Edit src/lib/fal/rateCard.ts.
 * 2. npm run check:all.
 * 3. npx tsx scripts/fal-price-drift.ts — confirm the alert cleared.
 * 4. Deploy via staging → production.
 * 5. Record the change in hermes-agent/docs/fork-deltas/portal-gateway-billing.md.
 */

import { priceDrift } from '../src/lib/fal/rateCard.ts';

const sample = priceDrift({
  nowMs: Date.parse('2026-10-10T00:00:00Z'),
  liveByEndpoint: {
    'minimax/music-3': 0.002,
    'fal-ai/minimax/speech-02-hd': 0.1,
  },
});

const invoked = process.argv[1]?.includes('fal-price-drift');
if (invoked) {
  console.log('Fixture drift (no live call). HIGH means card base is below the live unit.');
  for (const line of sample) {
    if (line.level !== 'ok') console.log(`${line.level} ${line.endpoint}: ${line.note}`);
  }
}
