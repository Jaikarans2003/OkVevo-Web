import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { auth } from '@/lib/firebase-admin';
import { gatewayIdToken } from '@/lib/gateway/auth';
import {
  InsufficientCreditsError,
  PlanNotActiveError,
  releaseCredits,
  reserveCredits,
  settleCompletedChat,
} from '@/lib/gateway/debit';
import { creditsFromTokens, lookupModelRates } from '@/lib/gateway/pricing';
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
const PROMPT_PAD_TOKENS = 4096;
const DEFAULT_MAX_TOKENS = 4096;
const MAX_TOKENS_CLAMP = 8192;

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

function completionBudget(body: unknown): number {
  if (!body || typeof body !== 'object') return DEFAULT_MAX_TOKENS;
  const o = body as { max_tokens?: unknown; max_completion_tokens?: unknown };
  const n = Number(o.max_tokens ?? o.max_completion_tokens);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_TOKENS;
  return Math.min(Math.floor(n), MAX_TOKENS_CLAMP);
}

function estimateChatCredits(opts: {
  promptPerToken: number;
  completionPerToken: number;
  maxTokens: number;
}): number {
  return creditsFromTokens({
    promptTokens: PROMPT_PAD_TOKENS,
    completionTokens: opts.maxTokens,
    promptPerToken: opts.promptPerToken,
    completionPerToken: opts.completionPerToken,
  }).credits;
}

export async function POST(request: NextRequest) {
  const idToken = gatewayIdToken(request);
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
  const rates = model ? await lookupModelRates(model) : null;
  if (!rates) {
    return openaiError(
      402,
      'insufficient credits',
      'insufficient_quota',
      'insufficient_quota'
    );
  }

  const estimated = estimateChatCredits({
    promptPerToken: rates.promptPerToken,
    completionPerToken: rates.completionPerToken,
    maxTokens: completionBudget(parsed),
  });
  const requestId = crypto.randomUUID();

  if (estimated > 0) {
    try {
      await reserveCredits({
        uid,
        requestId,
        provider: 'openrouter',
        estimatedCredits: estimated,
        extra: { model },
      });
    } catch (err) {
      if (err instanceof PlanNotActiveError) {
        return openaiError(403, 'plan not active', 'plan_not_active', 'plan_not_active');
      }
      if (err instanceof InsufficientCreditsError) {
        return openaiError(
          402,
          'insufficient credits',
          'insufficient_quota',
          'insufficient_quota'
        );
      }
      throw err;
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_CHAT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.siteUrl,
        'X-Title': 'Nia',
      },
      body: rawBody,
      signal: request.signal,
    });
  } catch (err) {
    console.error('gateway: openrouter fetch failed', err);
    if (estimated > 0) await releaseCredits(requestId);
    return openaiError(502, 'upstream unavailable', 'server_error', 'internal_error');
  }

  if (!stream || !upstream.body) {
    const text = await upstream.text();
    const scan: UsageScan = {};
    absorbJsonBody(scan, text);
    if (estimated > 0) {
      await settleCompletedChat({
        uid,
        requestId,
        model,
        scan,
        upstreamOk: upstream.ok,
      });
    }
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
  const upstreamOk = upstream.ok;

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
        if (estimated > 0) {
          await settleCompletedChat({ uid, requestId, model, scan, upstreamOk });
        }
      } catch (err) {
        console.error('gateway: stream read failed', err);
        if (estimated > 0) {
          await settleCompletedChat({ uid, requestId, model, scan, upstreamOk });
        }
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
