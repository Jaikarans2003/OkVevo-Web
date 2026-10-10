/**
 * Compare one ledger row with Fal usage. Does not call Fal.
 *
 * Live source, when smoke is approved: GET https://api.fal.ai/v1/models/usage
 * Authorization: Key <platform key> (same header as getEndpointPricing).
 * The key needs permissions billing:usage:read, auth:keys:read, account:users:read
 * (presets BILLING or FULL). Docs: https://docs.fal.ai/platform-apis/v1/models/usage
 * A missing job can be supplied as a dashboard CSV with columns
 * request_id,quantity,cost.
 */
import { readFileSync } from 'node:fs';

import { parseUsdDecimal, rawMicroTimesQuantity } from '../src/lib/gateway/pricing';
import { reconcilePair } from '../src/lib/fal/dramaGate';

type Side = { units: number; rawMicro: bigint };

function microFromCost(text: string): bigint {
  const { num, scale } = parseUsdDecimal(text);
  const den = 10n ** BigInt(scale);
  return (num * 1_000_000n + den - 1n) / den;
}

function readSide(path: string): Side {
  const text = readFileSync(path, 'utf8');
  if (path.endsWith('.csv')) {
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const qty = header.indexOf('quantity');
    const cost = header.indexOf('cost');
    const cols = lines[1].split(',');
    return { units: Number(cols[qty]), rawMicro: microFromCost(cols[cost]) };
  }
  const json = JSON.parse(text) as { units: number; rawMicro?: string; cost?: string };
  return {
    units: json.units,
    rawMicro: json.rawMicro != null ? BigInt(json.rawMicro) : microFromCost(json.cost ?? ''),
  };
}

const left = readSide(process.argv[2]);
const right = readSide(process.argv[3]);
const result = reconcilePair(left, right);
console.log(JSON.stringify(result));
if (!result.unitOk || !result.usdOk) process.exit(1);
