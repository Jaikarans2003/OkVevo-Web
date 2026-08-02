import {
  invokeAgentCoreStream,
  isAgentCoreBackend,
} from '@/lib/agent/agentcore';
import { getBearerToken } from '@/lib/agent/verifySessionAccess';
import {
  sanitizeTaggedAssets,
  type TaggedAsset,
} from '@/lib/agent/taggedAssets';
import { auth } from '@/lib/firebase-admin';
import { env } from '@/config/env';

export const runtime = 'nodejs';
/** Edu-video on AgentCore can take several minutes (transcribe → Manim → HeyGen submit). */
export const maxDuration = 800;

const AGENT_URL = env.agentUrl;
const ALLOWED_ORIGINS = new Set(env.allowedOrigins);

type ChatRequestBody = {
  messages?: Array<{
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  }>;
  sessionId?: string;
  userId?: string;
  videoUrl?: string;
  taggedAssets?: TaggedAsset[];
  mediaUrls?: string[];
  skillId?: string;
  model?: string;
  pipelineMode?: 'ask' | 'auto';
  checkpointAnswer?: {
    checkpointId: string;
    type: 'approve' | 'choice' | 'revision' | 'freeform';
    text: string;
    choiceId?: string;
  };
};

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

function sseHeaders(req: Request): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'x-vercel-ai-ui-message-stream': 'v1',
    ...corsHeaders(req),
  };
}

function extractUserMessage(body: ChatRequestBody): string {
  const lastMessage = body.messages?.at(-1);
  if (typeof lastMessage?.content === 'string' && lastMessage.content.trim()) {
    return lastMessage.content;
  }
  if (Array.isArray(lastMessage?.parts)) {
    return lastMessage.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text ?? '')
      .join('');
  }
  return '';
}

async function requireVerifiedUserId(
  req: Request
): Promise<string | Response> {
  const tokenOrError = await getBearerToken(req.headers.get('authorization'));
  if (typeof tokenOrError !== 'string') {
    return tokenOrError;
  }
  try {
    const decoded = await auth.verifyIdToken(tokenOrError);
    return decoded.uid;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

async function handleAgentCore(
  req: Request,
  userId: string,
  body: ChatRequestBody
) {
  const prompt = extractUserMessage(body);
  if (!prompt.trim()) {
    return Response.json({ error: 'userMessage is required' }, { status: 400 });
  }

  const sessionId = body.sessionId ?? crypto.randomUUID();

  const stream = await invokeAgentCoreStream({
    prompt,
    sessionId,
    userId,
    videoUrl: body.videoUrl,
    taggedAssets: body.taggedAssets,
    mediaUrls: body.mediaUrls,
    skillId: body.skillId,
    model: body.model,
    pipelineMode: body.pipelineMode,
    checkpointAnswer: body.checkpointAnswer,
  });

  // AgentCore often surfaces container JSON errors as a 200 body — peek first chunk.
  const reader = stream.getReader();
  const first = await reader.read();
  if (first.value) {
    const preview = new TextDecoder().decode(first.value).trimStart();
    if (preview.startsWith('{')) {
      try {
        const parsed = JSON.parse(preview) as {
          error?: string;
          sessionId?: string;
          estimatedTokens?: number;
        };
        if (parsed.error === 'session_limit_reached') {
          await reader.cancel().catch(() => undefined);
          return Response.json(parsed, {
            status: 413,
            headers: corsHeaders(req),
          });
        }
      } catch {
        // Partial / non-JSON SSE — fall through and re-stream.
      }
    }
  }

  const rebuilt = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (first.value) controller.enqueue(first.value);
      if (first.done) {
        controller.close();
        return;
      }
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      return reader.cancel();
    },
  });

  return new Response(rebuilt, {
    status: 200,
    headers: sseHeaders(req),
  });
}

async function handleLocalProxy(
  req: Request,
  userId: string,
  body: ChatRequestBody
) {
  const upstreamHeaders = new Headers({ 'Content-Type': 'application/json' });
  // Forward identity so local agent can attribute the session; never trust client userId.
  upstreamHeaders.set('x-user-id', userId);

  const response = await fetch(`${AGENT_URL}/chat`, {
    method: 'POST',
    headers: upstreamHeaders,
    body: JSON.stringify({ ...body, userId }),
  });

  if (!response.ok) {
    const contentType = response.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      const data = (await response.json()) as unknown;
      return Response.json(data, {
        status: response.status,
        headers: corsHeaders(req),
      });
    }
    const error = await response.text();
    return Response.json(
      { error: error || 'Agent service error' },
      { status: response.status, headers: corsHeaders(req) }
    );
  }

  const headers = new Headers(sseHeaders(req));
  const contentType = response.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  const uiStream = response.headers.get('x-vercel-ai-ui-message-stream');
  if (uiStream) {
    headers.set('x-vercel-ai-ui-message-stream', uiStream);
  }
  const tokenWarn = response.headers.get('x-okvevo-session-token-warning');
  if (tokenWarn) headers.set('x-okvevo-session-token-warning', tokenWarn);
  const estimated = response.headers.get('x-okvevo-estimated-tokens');
  if (estimated) headers.set('x-okvevo-estimated-tokens', estimated);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
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

export async function POST(req: Request) {
  try {
    const userIdOrError = await requireVerifiedUserId(req);
    if (typeof userIdOrError !== 'string') {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(req) }
      );
    }
    const rawBody = (await req.json()) as ChatRequestBody & {
      taggedAssets?: unknown;
    };
    const body: ChatRequestBody = {
      ...rawBody,
      taggedAssets: sanitizeTaggedAssets(rawBody.taggedAssets),
    };

    if (isAgentCoreBackend()) {
      return await handleAgentCore(req, userIdOrError, body);
    }
    return await handleLocalProxy(req, userIdOrError, body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to reach agent service';
    const hint = isAgentCoreBackend()
      ? `${message}. Check AGENTCORE_RUNTIME_ARN and AWS credentials.`
      : `${message}. Is the agent running at ${AGENT_URL}? Start it with: cd services/agent && npm run dev`;
    return Response.json(
      { error: hint },
      { status: 503, headers: corsHeaders(req) }
    );
  }
}

export async function GET(req: Request) {
  const headers = corsHeaders(req);
  if (isAgentCoreBackend()) {
    return Response.json(
      {
        status: 'ok',
        backend: 'agentcore',
        runtimeArn: process.env.AGENTCORE_RUNTIME_ARN ?? null,
        streaming: true,
      },
      { headers }
    );
  }

  try {
    const response = await fetch(`${AGENT_URL}/health`);
    const data = (await response.json()) as Record<string, unknown>;
    return Response.json(
      { ...data, backend: 'local', agentUrl: AGENT_URL },
      { status: response.status, headers }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unreachable';
    return Response.json(
      { status: 'error', backend: 'local', agentUrl: AGENT_URL, error: message },
      { status: 503, headers }
    );
  }
}
