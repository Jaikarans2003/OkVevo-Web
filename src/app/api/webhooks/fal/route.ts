import { NextRequest, NextResponse, after } from 'next/server';
import { db, getAdminBucket } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyCallbackToken } from '@/lib/heygen/callbackToken';
import { verifyFalWebhook } from '@/lib/fal/verifyWebhook';
import { invokeAgentCore } from '@/lib/agent/agentcore';

export const runtime = 'nodejs';

const DEDUP_TTL_DAYS = 7;
const INVOKE_RETRIES = 3;
const INVOKE_BACKOFF_MS = 500;

/**
 * Dedup invariant (fal_stt completed):
 * 1. Upload payload first — never create webhookDeliveries on upload failure (Fal can retry).
 * 2. Claim dedup via create() — duplicate POST → early 200, no second invoke.
 * 3. Sync-seed falSttWebhookPayloadUrl + falSttFinalizePending BEFORE returning 200
 *    (do not rely on after() — recovery must work if invoke is dropped after 200).
 * 4. after() invoke is best-effort; on exhaust re-patch pending (idempotent).
 * Concurrent duplicate: exactly one create wins → one invoke.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

async function uploadFalSttPayload(
  userId: string,
  sessionId: string,
  requestId: string,
  payload: unknown
): Promise<string> {
  const bucket = getAdminBucket();
  const storagePath = `users/${userId}/sessions/${sessionId}/fal_stt_${requestId}.json`;
  const file = bucket.file(storagePath);
  await file.save(JSON.stringify(payload), {
    resumable: false,
    metadata: { contentType: 'application/json' },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

async function patchTranscriptionProgress(
  sessionId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  const prev = (snap.data()?.transcriptionProgress ?? {}) as Record<string, unknown>;
  await db
    .collection('sessions')
    .doc(sessionId)
    .set(
      {
        transcriptionProgress: {
          ...prev,
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
}

async function invokeWithRetry(opts: {
  prompt: string;
  sessionId: string;
  userId: string;
}): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < INVOKE_RETRIES; attempt++) {
    try {
      await invokeAgentCore({
        prompt: opts.prompt,
        sessionId: opts.sessionId,
        userId: opts.userId,
        source: 'webhook',
      });
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < INVOKE_RETRIES - 1) {
        await sleep(INVOKE_BACKOFF_MS * 2 ** attempt);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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

  const sessionSnap = await db.collection('sessions').doc(sessionId).get();
  const userId = sessionSnap.data()?.userId;
  if (typeof userId !== 'string') {
    console.error('[fal webhook] unknown session', sessionId);
    return NextResponse.json({ ok: true });
  }

  const mediaUrl = status === 'completed' ? extractMediaUrl(event.payload) : undefined;
  let payloadUrl: string | undefined;

  // fal_stt completed: upload BEFORE dedup so upload failure can be retried by Fal.
  if (status === 'completed' && taskId === 'fal_stt') {
    if (event.payload == null) {
      console.error('[fal webhook] fal_stt completed missing payload', sessionId, requestId);
      return NextResponse.json({ error: 'missing stt payload' }, { status: 500 });
    }
    try {
      payloadUrl = await uploadFalSttPayload(userId, sessionId, requestId, event.payload);
    } catch (e) {
      console.error('[fal webhook] STT payload upload failed', sessionId, e);
      return NextResponse.json({ error: 'stt payload upload failed' }, { status: 500 });
    }
  }

  try {
    await db.collection('webhookDeliveries').doc(requestId).create({
      receivedAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + DEDUP_TTL_DAYS * 86400 * 1000),
    });
  } catch {
    // Duplicate delivery — no second invoke. Recovery uses falSttFinalizePending if needed.
    return NextResponse.json({ ok: true });
  }

  const errorMsg =
    status === 'failed'
      ? typeof event.error === 'string'
        ? event.error
        : 'n/a'
      : 'n/a';

  const prompt = `Fal ${taskId} ${status} for session ${sessionId}, task ${taskId}. media_url: ${mediaUrl ?? 'n/a'} payload_url: ${payloadUrl ?? 'n/a'} error: ${errorMsg}`;

  // Seed recovery state synchronously before 200 — after() alone is not durable.
  if (payloadUrl && taskId === 'fal_stt' && status === 'completed') {
    try {
      await patchTranscriptionProgress(sessionId, {
        falSttWebhookPayloadUrl: payloadUrl,
        requestId,
        falSttFinalizePending: true,
      });
    } catch (e) {
      console.error('[fal webhook] sync seed finalize pending failed', sessionId, e);
    }
  }

  after(async () => {
    try {
      await invokeWithRetry({ prompt, sessionId, userId });
    } catch (e) {
      console.error('[fal webhook] agent invoke failed after retries', sessionId, e);
      if (payloadUrl && taskId === 'fal_stt') {
        try {
          await patchTranscriptionProgress(sessionId, {
            falSttFinalizePending: true,
            falSttWebhookPayloadUrl: payloadUrl,
            requestId,
          });
        } catch (markErr) {
          console.error('[fal webhook] mark finalize pending failed', sessionId, markErr);
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}
