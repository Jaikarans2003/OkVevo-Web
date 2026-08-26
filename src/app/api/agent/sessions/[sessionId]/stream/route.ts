import { NextRequest } from 'next/server';
import { UI_MESSAGE_STREAM_HEADERS } from 'ai';
import { db } from '@/lib/firebase-admin';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { env } from '@/config/env';
import { seedOpenPartStarts } from '@/lib/agent/seedOpenPartStarts';
import { logStudioDelta } from '@/lib/agent/studioPerf';
import {
  createReconnectPacer,
  mergeConsecutiveDeltas,
} from '@agent/smoothStreamSkipStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

const POLL_MS = 200;
const ALLOWED_ORIGINS = new Set(env.allowedOrigins);

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

function withCors(req: Request, res: Response): Response {
  const extra = corsHeaders(req);
  if (Object.keys(extra).length === 0) return res;
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return new Response(res.body, { status: res.status, headers });
}

async function verifySessionAccessFromRequest(
  request: NextRequest,
  sessionId: string
) {
  const token = await getBearerToken(request.headers.get('authorization'));
  if (typeof token !== 'string') {
    return { error: token };
  }
  return verifySessionAccess(token, sessionId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sseFrame(seq: number, chunk: unknown): string {
  return `id: ${seq}\ndata: ${JSON.stringify(chunk)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const access = await verifySessionAccessFromRequest(request, sessionId);
  if ('error' in access) return withCors(request, access.error);

  const sessionData = access.sessionDoc.data() ?? {};
  const activeRunId =
    typeof sessionData.activeRunId === 'string' ? sessionData.activeRunId : null;
  if (!activeRunId) {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const afterRaw =
    request.nextUrl.searchParams.get('after') ??
    request.headers.get('last-event-id') ??
    '0';
  const afterSeq = Number.parseInt(afterRaw, 10);
  let cursor = Number.isFinite(afterSeq) ? afterSeq : 0;

  const eventsRef = db
    .collection('sessions')
    .doc(sessionId)
    .collection('runs')
    .doc(activeRunId)
    .collection('events');
  const runRef = db
    .collection('sessions')
    .doc(sessionId)
    .collection('runs')
    .doc(activeRunId);

  const chunkStream = new ReadableStream<string>({
    async start(controller) {
      const abort = request.signal;
      const seen = { text: new Set<string>(), tool: new Set<string>() };
      let currentSeq = cursor;
      const pacer = createReconnectPacer((chunk) => {
        if (abort.aborted) return;
        try {
          controller.enqueue(sseFrame(currentSeq, chunk));
        } catch {
          // client disconnected
        }
      });
      const emitBatch = async (
        rows: Array<{ seq?: unknown; chunk?: unknown }>
      ) => {
        const raw: Record<string, unknown>[] = [];
        for (const data of rows) {
          if (typeof data.seq === 'number') {
            cursor = data.seq;
            currentSeq = data.seq;
          }
          if (data.chunk && typeof data.chunk === 'object') {
            raw.push(data.chunk as Record<string, unknown>);
          }
        }
        for (const chunk of mergeConsecutiveDeltas(raw)) {
          for (const next of seedOpenPartStarts(chunk, seen)) {
            logStudioDelta('reconnect-poll', next);
            await pacer.push(next);
          }
        }
      };
      try {
        for (;;) {
          if (abort.aborted) break;
          const snap = await eventsRef
            .where('seq', '>', cursor)
            .orderBy('seq')
            .limit(200)
            .get();
          await emitBatch(snap.docs.map((doc) => doc.data()));
          const runSnap = await runRef.get();
          const status = runSnap.data()?.status;
          if (status && status !== 'running') {
            const rest = await eventsRef
              .where('seq', '>', cursor)
              .orderBy('seq')
              .limit(200)
              .get();
            await emitBatch(rest.docs.map((doc) => doc.data()));
            break;
          }
          await sleep(POLL_MS);
        }
        await pacer.close();
        controller.enqueue('data: [DONE]\n\n');
        controller.close();
      } catch (err) {
        console.error('[agent] stream poll failed', {
          sessionId,
          runId: activeRunId,
          err,
        });
        controller.close();
      }
    },
  });

  return new Response(chunkStream.pipeThrough(new TextEncoderStream()), {
      status: 200,
      headers: {
        ...UI_MESSAGE_STREAM_HEADERS,
        ...corsHeaders(request),
      },
    }
  );
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}
