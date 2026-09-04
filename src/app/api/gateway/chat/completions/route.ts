import { NextRequest, NextResponse } from 'next/server';

import { auth, db } from '@/lib/firebase-admin';
import { settleCompletedChat } from '@/lib/gateway/debit';
import {
  absorbJsonBody,
  feedSseBytes,
  finishSse,
  type UsageScan,
} from '@/lib/gateway/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const OPENROUTER_CHAT = 'https://openrouter.ai/api/v1/chat/completions';

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function openaiError(status: number, message: string, type: string, code: string) {
  return NextResponse.json({ error: { message, type, code } }, { status });
}

function modelFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const model = (body as { model?: unknown }).model;
  return typeof model === 'string' ? model : '';
}

function wantsStream(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  return Boolean((body as { stream?: unknown }).stream);
}

async function creditBalance(uid: string): Promise<number> {
  const snap = await db.collection('users').doc(uid).get();
  const n = snap.data()?.creditBalance;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0;
}

export async function POST(request: NextRequest) {
  const idToken = bearerToken(request);
  if (!idToken) {
    return openaiError(401, 'invalid_token', 'invalid_request_error', 'invalid_api_key');
  }

  let uid: string;
  try {
    uid = (await auth.verifyIdToken(idToken)).uid;
  } catch {
    return openaiError(401, 'invalid_token', 'invalid_request_error', 'invalid_api_key');
  }

  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    console.error('gateway: OPENROUTER_API_KEY missing');
    return openaiError(500, 'OPENROUTER_API_KEY missing', 'server_error', 'internal_error');
  }

  const balance = await creditBalance(uid);
  if (balance <= 0) {
    return openaiError(
      402,
      'insufficient credits',
      'insufficient_quota',
      'insufficient_quota'
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return openaiError(400, 'invalid body', 'invalid_request_error', 'invalid_request');
  }

  let parsed: unknown = {};
  try {
    parsed = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return openaiError(400, 'invalid json', 'invalid_request_error', 'invalid_request');
  }

  const model = modelFromBody(parsed);
  const stream = wantsStream(parsed);

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_CHAT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://www.okvevo.com',
        'X-Title': 'Nia',
      },
      body: rawBody,
      signal: request.signal,
    });
  } catch (err) {
    console.error('gateway: openrouter fetch failed', err);
    return openaiError(502, 'upstream unavailable', 'server_error', 'internal_error');
  }

  if (!stream || !upstream.body) {
    const text = await upstream.text();
    const scan: UsageScan = {};
    absorbJsonBody(scan, text);
    await settleCompletedChat({ uid, model, scan });
    return new Response(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-cache, no-store',
      },
    });
  }

  const scan: UsageScan = {};
  const carry = { text: '' };
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();

  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            controller.enqueue(value);
            feedSseBytes(scan, carry, value, decoder);
          }
        }
        finishSse(scan, carry);
        await settleCompletedChat({ uid, model, scan });
      } catch (err) {
        console.error('gateway: stream read failed', err);
        await settleCompletedChat({ uid, model, scan });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  // ponytail: local next dev is the correctness bar. Firebase Hosting CDN buffering is a pre-live verify.
  return new Response(out, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}
