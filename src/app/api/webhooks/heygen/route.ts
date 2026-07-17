import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyCallbackToken } from '@/lib/heygen/callbackToken';
import { invokeAgentCore } from '@/lib/agent/agentcore';

export const runtime = 'nodejs';

// Dedup docs live long enough for HeyGen's retry window; a Firestore TTL policy
// on `webhookDeliveries.expireAt` (infra) reaps them afterwards.
const DEDUP_TTL_DAYS = 7;

export async function POST(req: NextRequest) {
  // The signed token is the auth; we do not verify HeyGen's body HMAC here.
  const verified = verifyCallbackToken(req.nextUrl.searchParams.get('token'));
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }
  const { sessionId, taskId } = verified;

  let event: { event_type?: string; event_data?: Record<string, unknown> };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const eventType = event.event_type ?? '';
  const eventData = event.event_data ?? {};
  const status =
    eventType === 'hyperframes_video.success'
      ? 'completed'
      : eventType === 'hyperframes_video.fail'
        ? 'failed'
        : null;
  if (!status) {
    return NextResponse.json({ ok: true });
  }

  const videoUrl =
    (typeof eventData.video_url === 'string' && eventData.video_url) ||
    (typeof eventData.url === 'string' && eventData.url) ||
    undefined;

  const renderId =
    typeof eventData.render_id === 'string' ? eventData.render_id : null;
  const deliveryId =
    req.headers.get('heygen-event-id') ?? renderId ?? `${sessionId}:${status}`;

  try {
    await db.collection('webhookDeliveries').doc(deliveryId).create({
      receivedAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + DEDUP_TTL_DAYS * 86400 * 1000),
    });
  } catch {
    // Already processed (create fails if the doc exists).
    return NextResponse.json({ ok: true });
  }

  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  const userId = sessionSnap.data()?.userId;
  if (typeof userId !== 'string') {
    console.error('[heygen webhook] unknown session', sessionId);
    return NextResponse.json({ ok: true });
  }

  const prompt = `HeyGen render ${status} for session ${sessionId}, task ${taskId}. video_url: ${videoUrl ?? 'n/a'}`;

  after(async () => {
    try {
      await invokeAgentCore({
        prompt,
        sessionId,
        userId,
        videoUrl,
        source: 'webhook',
      });
    } catch (e) {
      console.error('[heygen webhook] agent invoke failed', e);
    }
  });

  return NextResponse.json({ ok: true });
}
