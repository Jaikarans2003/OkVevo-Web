import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/firebase-admin';
import { randomUUID } from 'node:crypto';

import { isMeterableEndpoint } from '@/lib/fal/allowlist';
import { getEndpointPricing } from '@/lib/fal/client';
import { meterRawUsd } from '@/lib/fal/handleQueue';
import { MediaResolveError, resolveMediaArgs } from '@/lib/fal/mediaResolve';
import { QUOTE_TTL_MS, rateCardEntry } from '@/lib/fal/rateCard';
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
  let uid: string;
  try {
    uid = (await auth.verifyIdToken(token)).uid;
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

  const card = rateCardEntry(endpoint);
  const pricing = card?.source === 'card' ? null : await getEndpointPricing(endpoint);
  if (!card && !pricing) return jsonError(502, 'Fal pricing unavailable');

  // Same media resolution as submit, so the approved number matches the hold.
  let media;
  if (card) {
    try {
      media = (await resolveMediaArgs(endpoint, args, uid)).media;
    } catch (err) {
      if (err instanceof MediaResolveError) return jsonError(400, err.message);
      throw err;
    }
  }

  let rawUsd: number;
  try {
    rawUsd = await meterRawUsd({
      endpoint,
      unit: pricing?.unit ?? card?.unit ?? '',
      unitPrice: pricing?.unitPrice ?? 0,
      args,
      media,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'cannot meter this request';
    return jsonError(400, msg);
  }

  const { credits } = creditsFromUsd(rawUsd);
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();
  return NextResponse.json({
    credits,
    unit: pricing?.unit ?? card?.unit ?? '',
    unitPrice: pricing?.unitPrice ?? null,
    snapshotId: randomUUID(),
    expiresAt,
    estimate: true,
  });
}
