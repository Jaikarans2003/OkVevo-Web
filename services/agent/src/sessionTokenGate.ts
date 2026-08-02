import type { ModelMessage } from 'ai';

/** Soft warn band — stream continues; client shows a dismissible banner. */
export const SESSION_WARN_TOKENS = 80_000;
/** Hard stop — no saveMessage, no streamText. chars/4 estimate on pruned history. */
export const SESSION_HARD_LIMIT_TOKENS = 130_000;

export function estimateMessageTokens(messages: unknown): number {
  return Math.ceil(JSON.stringify(messages).length / 4);
}

export class SessionLimitReachedError extends Error {
  readonly code = 'session_limit_reached' as const;
  readonly sessionId: string;
  readonly estimatedTokens: number;

  constructor(sessionId: string, estimatedTokens: number) {
    super(
      `Session context limit reached (~${estimatedTokens} tokens). Start a new chat or export this project.`
    );
    this.name = 'SessionLimitReachedError';
    this.sessionId = sessionId;
    this.estimatedTokens = estimatedTokens;
  }
}

/** Pure gate for self-check / runAgent. Throws SessionLimitReachedError at hard limit. */
export function gateSessionTokens(
  messages: ModelMessage[],
  sessionId: string
): { estimatedTokens: number; warning: { estimatedTokens: number } | null } {
  const estimatedTokens = estimateMessageTokens(messages);
  if (estimatedTokens >= SESSION_HARD_LIMIT_TOKENS) {
    throw new SessionLimitReachedError(sessionId, estimatedTokens);
  }
  if (estimatedTokens >= SESSION_WARN_TOKENS) {
    return { estimatedTokens, warning: { estimatedTokens } };
  }
  return { estimatedTokens, warning: null };
}
