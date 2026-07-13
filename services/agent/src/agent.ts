import { streamText, stepCountIs, type ModelMessage, type ToolSet, type UIMessage } from 'ai';
import type { ServerResponse } from 'node:http';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { pruneToolResults } from './messagePruning';
import { getCachedSystemPrompt } from './systemPromptCache';
import { buildTools } from './tools';
import { resolveSkill } from './skills';
import {
  ensureSession,
  loadMessages,
  saveMessage,
  type StoredMessagePart,
} from './session';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function runAgent(params: {
  userMessage: string;
  sessionId: string;
  userId: string;
  videoUrl?: string;
  model?: string;
  skillId?: string;
}) {
  const title = params.userMessage.trim().slice(0, 80) || 'Untitled Chat';
  await ensureSession(params.sessionId, params.userId, title);

  const history = await loadMessages(params.sessionId, params.userId);

  await saveMessage(params.sessionId, params.userId, 'user', params.userMessage);

  let userContent = params.userMessage;
  if (params.videoUrl) {
    userContent += `\n\nVideo URL for processing: ${params.videoUrl}`;
  }

  const messages: ModelMessage[] = pruneToolResults([
    ...history,
    { role: 'user', content: userContent },
  ]);

  const skillName = resolveSkill(params.skillId, params.userMessage);
  const systemPrompt = getCachedSystemPrompt(params.sessionId, skillName);

  const modelId = params.model ?? 'anthropic/claude-sonnet-4-5';

  const tools = buildTools(
    { sessionId: params.sessionId, userId: params.userId },
    { skill: skillName }
  );

  const result = streamText({
    model: openrouter(modelId),
    system: systemPrompt,
    messages,
    tools: tools as ToolSet,
    stopWhen: stepCountIs(50),
    prepareStep: ({ messages: stepMessages }) => ({
      messages: pruneToolResults(stepMessages),
    }),
    onStepFinish: ({ toolCalls, toolResults }) => {
      for (const call of toolCalls ?? []) {
        console.log(
          `[agent] tool.call ${call.toolName}`,
          JSON.stringify({ input: call.input })
        );
      }
      for (const result of toolResults ?? []) {
        const output =
          typeof result.output === 'string'
            ? result.output.slice(0, 300)
            : JSON.stringify(result.output)?.slice(0, 300);
        console.log(
          `[agent] tool.result ${result.toolName}`,
          JSON.stringify({ ok: !result.isError, outputPreview: output })
        );
      }
    },
  });

  return result;
}

function getTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function pipeAgentStream(
  result: Awaited<ReturnType<typeof streamText>>,
  response: ServerResponse,
  params: { sessionId: string; userId: string }
) {
  result.pipeUIMessageStreamToResponse(response, {
    onError: (error) =>
      error instanceof Error ? error.message : 'An error occurred.',
    onFinish: async ({ responseMessage }) => {
      const text = getTextFromParts(responseMessage.parts);
      if (!text.trim() && responseMessage.parts.length === 0) {
        return;
      }

      try {
        await saveMessage(
          params.sessionId,
          params.userId,
          'assistant',
          text,
          responseMessage.parts as StoredMessagePart[]
        );
      } catch (err) {
        console.error('[agent] failed to persist assistant message parts:', err);
      }
    },
  });
}
