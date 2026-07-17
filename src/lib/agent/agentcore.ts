import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';

export type AgentCoreInvokeInput = {
  prompt: string;
  sessionId: string;
  userId: string;
  videoUrl?: string;
  skillId?: string;
  model?: string;
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
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
  });
}

export function isAgentCoreBackend(): boolean {
  return (process.env.AGENT_BACKEND ?? '').trim().toLowerCase() === 'agentcore';
}

export async function invokeAgentCore(
  input: AgentCoreInvokeInput
): Promise<AgentCoreInvokeResult> {
  const payload = {
    input: {
      prompt: input.prompt,
      sessionId: input.sessionId,
      userId: input.userId,
      ...(input.videoUrl ? { videoUrl: input.videoUrl } : {}),
      ...(input.skillId ? { skillId: input.skillId } : {}),
      ...(input.model ? { model: input.model } : {}),
    },
  };

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: getRuntimeArn(),
    runtimeSessionId: ensureRuntimeSessionId(input.sessionId),
    runtimeUserId: input.userId,
    contentType: 'application/json',
    accept: 'application/json',
    payload: Buffer.from(JSON.stringify(payload), 'utf8'),
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
