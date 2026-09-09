import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/firebase-admin';
import { isMeterableEndpoint } from '@/lib/fal/allowlist';
import { getEndpointPricing } from '@/lib/fal/client';
import { meterRawUsd } from '@/lib/fal/handleQueue';
import { QuantityError } from '@/lib/fal/quantity';
import { gatewayIdToken } from '@/lib/gateway/auth';
import { creditsFromUsd } from '@/lib/gateway/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { message } }, { status });
}

/**
 * Read-only credit quote for the approval gate in the Nia tools. Same
 * meterRawUsd + creditsFromUsd as submit, so the number the user approves
 * is the number /billing later debits. NEVER reserves or debits — the hold
 * only happens inside the queue submit handler.
 */
export async function POST(request: NextRequest) {
  const token = gatewayIdToken(request);
  if (!token) return jsonError(401, 'invalid_token');
  try {
    await auth.verifyIdToken(token);
  } catch {
    return jsonError(401, 'invalid_token');
  }

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return jsonError(400, 'invalid json');
  }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint) return jsonError(400, 'missing endpoint');
  if (!isMeterableEndpoint(endpoint)) {
    return jsonError(400, `Fal endpoint is not meterable on the OkVevo gateway: ${endpoint}`);
  }
  const args =
    body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : {};

  const pricing = await getEndpointPricing(endpoint);
  if (!pricing) return jsonError(502, 'Fal pricing unavailable');

  let rawUsd: number;
  try {
    rawUsd = await meterRawUsd({
      endpoint,
      unit: pricing.unit,
      unitPrice: pricing.unitPrice,
      args,
    });
  } catch (err) {
    const msg = err instanceof QuantityError ? err.message : 'cannot meter this request';
    return jsonError(400, msg);
  }

  const { credits } = creditsFromUsd(rawUsd);
  return NextResponse.json({
    credits,
    unit: pricing.unit,
    unitPrice: pricing.unitPrice,
  });
}
