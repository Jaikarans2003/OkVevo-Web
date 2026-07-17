import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';
import {
  invokeAgentCore,
  isAgentCoreBackend,
} from '@/lib/agent/agentcore';

export const runtime = 'nodejs';
/** Edu-video on AgentCore can take several minutes (transcribe → Manim → HeyGen submit). */
export const maxDuration = 800;

const AGENT_URL = process.env.AGENT_URL ?? 'http://localhost:3001';

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
};

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

async function handleAgentCore(req: Request) {
  const body = (await req.json()) as ChatRequestBody;
  const prompt = extractUserMessage(body);
  if (!prompt.trim()) {
    return Response.json({ error: 'userMessage is required' }, { status: 400 });
  }

  const sessionId = body.sessionId ?? crypto.randomUUID();
  const userId = body.userId ?? 'anonymous';

  const result = await invokeAgentCore({
    prompt,
    sessionId,
    userId,
    videoUrl: body.videoUrl,
    skillId: body.skillId,
    model: body.model,
  });

  const textId = generateId();
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'start', messageId: generateId() });
      writer.write({ type: 'start-step' });
      writer.write({ type: 'text-start', id: textId });
      writer.write({ type: 'text-delta', id: textId, delta: result.message });
      writer.write({ type: 'text-end', id: textId });
      writer.write({ type: 'finish-step' });
      writer.write({ type: 'finish' });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

async function handleLocalProxy(req: Request) {
  const response = await fetch(`${AGENT_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function POST(req: Request) {
  try {
    if (isAgentCoreBackend()) {
      return await handleAgentCore(req);
    }
    return await handleLocalProxy(req);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to reach agent service';
    const hint = isAgentCoreBackend()
      ? `${message}. Check AGENTCORE_RUNTIME_ARN and AWS credentials.`
      : `${message}. Is the agent running at ${AGENT_URL}? Start it with: cd services/agent && npm run dev`;
    return Response.json({ error: hint }, { status: 503 });
  }
}

export async function GET() {
  if (isAgentCoreBackend()) {
    return Response.json({
      status: 'ok',
      backend: 'agentcore',
      runtimeArn: process.env.AGENTCORE_RUNTIME_ARN ?? null,
    });
  }

  try {
    const response = await fetch(`${AGENT_URL}/health`);
    const data = (await response.json()) as Record<string, unknown>;
    return Response.json(
      { ...data, backend: 'local', agentUrl: AGENT_URL },
      { status: response.status }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unreachable';
    return Response.json(
      { status: 'error', backend: 'local', agentUrl: AGENT_URL, error: message },
      { status: 503 }
    );
  }
}
