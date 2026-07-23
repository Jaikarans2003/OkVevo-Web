import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyCallbackToken } from '@/lib/heygen/callbackToken';
import { verifyFalWebhook } from '@/lib/fal/verifyWebhook';
import { invokeAgentCore } from '@/lib/agent/agentcore';

export const runtime = 'nodejs';

const DEDUP_TTL_DAYS = 7;

function extractMediaUrl(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.images)) {
    const first = p.images[0];
    if (
      first &&
      typeof first === 'object' &&
      typeof (first as { url?: unknown }).url === 'string'
    ) {
      return (first as { url: string }).url;
    }
  }
  if (
    p.video &&
    typeof p.video === 'object' &&
    typeof (p.video as { url?: unknown }).url === 'string'
  ) {
    return (p.video as { url: string }).url;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer());

  const falAuth = await verifyFalWebhook(
    {
      requestId: req.headers.get('x-fal-webhook-request-id'),
      userId: req.headers.get('x-fal-webhook-user-id'),
      timestamp: req.headers.get('x-fal-webhook-timestamp'),
      signature: req.headers.get('x-fal-webhook-signature'),
    },
    rawBody
  );
  if (!falAuth.ok) {
    return NextResponse.json({ error: falAuth.error }, { status: falAuth.status });
  }

  const verified = verifyCallbackToken(req.nextUrl.searchParams.get('token'));
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }
  const { sessionId, taskId } = verified;

  let event: {
    request_id?: string;
    status?: string;
    error?: string;
    payload?: unknown;
  };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const falStatus = (event.status ?? '').toUpperCase();
  const status =
    falStatus === 'OK' ? 'completed' : falStatus === 'ERROR' ? 'failed' : null;
  if (!status) {
    return NextResponse.json({ ok: true });
  }

  const requestId =
    event.request_id ||
    req.headers.get('x-fal-webhook-request-id') ||
    `${sessionId}:${taskId}:${status}`;

  try {
    await db.collection('webhookDeliveries').doc(requestId).create({
      receivedAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + DEDUP_TTL_DAYS * 86400 * 1000),
    });
  } catch {
    return NextResponse.json({ ok: true });
  }

  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  const userId = sessionSnap.data()?.userId;
  if (typeof userId !== 'string') {
    console.error('[fal webhook] unknown session', sessionId);
    return NextResponse.json({ ok: true });
  }

  const mediaUrl = status === 'completed' ? extractMediaUrl(event.payload) : undefined;
  const errorMsg =
    status === 'failed'
      ? typeof event.error === 'string'
        ? event.error
        : 'n/a'
      : 'n/a';

  const prompt = `Fal ${taskId} ${status} for session ${sessionId}, task ${taskId}. media_url: ${mediaUrl ?? 'n/a'} error: ${errorMsg}`;

  after(async () => {
    try {
      await invokeAgentCore({
        prompt,
        sessionId,
        userId,
        source: 'webhook',
      });
    } catch (e) {
      console.error('[fal webhook] agent invoke failed', e);
    }
  });

  return NextResponse.json({ ok: true });
}
