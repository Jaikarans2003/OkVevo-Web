import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { env } from '@/config/env';

export type AgentCoreInvokeInput = {
  prompt: string;
  sessionId: string;
  userId: string;
  videoUrl?: string;
  skillId?: string;
  model?: string;
  source?: 'chat' | 'webhook';
};

export type AgentCoreInvokeResult = {
  message: string;
  sessionId: string;
  userId: string;
  timestamp?: string;
};

function getRuntimeArn(): string {
  const arn = process.env.AGENTCORE_RUNTIME_ARN?.trim();
  if (!arn) {
    throw new Error(
      'AGENTCORE_RUNTIME_ARN is required when AGENT_BACKEND=agentcore'
    );
  }
  return arn;
}

function ensureRuntimeSessionId(sessionId: string): string {
  // AgentCore requires runtimeSessionId length >= 33
  if (sessionId.length >= 33) return sessionId;
  return `okvevo-session-${sessionId}`.padEnd(33, '0');
}

function getClient() {
  return new BedrockAgentCoreClient({
    region: env.awsRegion,
  });
}

function buildPayload(input: AgentCoreInvokeInput, stream: boolean) {
  return {
    input: {
      prompt: input.prompt,
      sessionId: input.sessionId,
      userId: input.userId,
      stream,
      ...(input.videoUrl ? { videoUrl: input.videoUrl } : {}),
      ...(input.skillId ? { skillId: input.skillId } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.source ? { source: input.source } : {}),
    },
  };
}

export function isAgentCoreBackend(): boolean {
  return (process.env.AGENT_BACKEND ?? '').trim().toLowerCase() === 'agentcore';
}

/** Non-streaming JSON invoke (CLI / smoke). */
export async function invokeAgentCore(
  input: AgentCoreInvokeInput
): Promise<AgentCoreInvokeResult> {
  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: getRuntimeArn(),
    runtimeSessionId: ensureRuntimeSessionId(input.sessionId),
    runtimeUserId: input.userId,
    contentType: 'application/json',
    accept: 'application/json',
    payload: Buffer.from(JSON.stringify(buildPayload(input, false)), 'utf8'),
  });

  const response = await getClient().send(command);
  if (!response.response) {
    throw new Error('AgentCore returned an empty response body');
  }

  const raw = await response.response.transformToString();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`AgentCore returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const body = parsed as {
    output?: { message?: string; sessionId?: string; userId?: string; timestamp?: string };
    error?: string;
  };

  if (body.error) {
    throw new Error(body.error);
  }

  const message = body.output?.message;
  if (typeof message !== 'string') {
    throw new Error(`AgentCore response missing output.message: ${raw.slice(0, 300)}`);
  }

  return {
    message,
    sessionId: body.output?.sessionId ?? input.sessionId,
    userId: body.output?.userId ?? input.userId,
    timestamp: body.output?.timestamp,
  };
}

/**
 * Streaming invoke — AgentCore /invocations pipes the AI SDK UI message SSE.
 * Returns a Web ReadableStream suitable for `new Response(stream, …)`.
 */
export async function invokeAgentCoreStream(
  input: AgentCoreInvokeInput
): Promise<ReadableStream<Uint8Array>> {
  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: getRuntimeArn(),
    runtimeSessionId: ensureRuntimeSessionId(input.sessionId),
    runtimeUserId: input.userId,
    contentType: 'application/json',
    accept: 'text/event-stream',
    payload: Buffer.from(JSON.stringify(buildPayload(input, true)), 'utf8'),
  });

  const response = await getClient().send(command);
  if (!response.response) {
    throw new Error('AgentCore returned an empty streaming body');
  }

  // Prefer native web stream when available (AWS SDK SdkStream)
  const sdkBody = response.response as {
    transformToWebStream?: () => ReadableStream<Uint8Array>;
  };
  if (typeof sdkBody.transformToWebStream === 'function') {
    return sdkBody.transformToWebStream();
  }

  // Fallback: buffer then emit (loses mid-flight streaming)
  const bytes = await response.response.transformToByteArray();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
