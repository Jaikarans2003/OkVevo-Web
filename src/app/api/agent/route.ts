import {
  invokeAgentCoreStream,
  isAgentCoreBackend,
} from '@/lib/agent/agentcore';
import { getBearerToken } from '@/lib/agent/verifySessionAccess';
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

async function handleAgentCore(req: Request, userId: string) {
  const body = (await req.json()) as ChatRequestBody;
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
    skillId: body.skillId,
    model: body.model,
    pipelineMode: body.pipelineMode,
    checkpointAnswer: body.checkpointAnswer,
  });

  return new Response(stream, {
    status: 200,
    headers: sseHeaders(req),
  });
}

async function handleLocalProxy(req: Request, userId: string) {
  const upstreamHeaders = new Headers({ 'Content-Type': 'application/json' });
  // Forward identity so local agent can attribute the session; never trust client userId.
  upstreamHeaders.set('x-user-id', userId);

  const response = await fetch(`${AGENT_URL}/chat`, {
    method: 'POST',
    headers: upstreamHeaders,
    body: req.body,
    // @ts-expect-error duplex required for streaming request bodies
    duplex: 'half',
  });

  if (!response.ok) {
    const error = await response.text();
    return Response.json(
      { error: error || 'Agent service error' },
      { status: response.status }
    );
  }

  const headers = new Headers(sseHeaders(req));
  const contentType = response.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  const uiStream = response.headers.get('x-vercel-ai-ui-message-stream');
  if (uiStream) {
    headers.set('x-vercel-ai-ui-message-stream', uiStream);
  }

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

    if (isAgentCoreBackend()) {
      return await handleAgentCore(req, userIdOrError);
    }
    return await handleLocalProxy(req, userIdOrError);
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
