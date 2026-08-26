import type { ModelMessage } from 'ai';
import { getToolMeta } from './catalog/manifest';

const KEEP_EXCHANGES = 4;

type Exchange = {
  assistantIndex: number;
  toolIndices: number[];
};

function segmentExchanges(messages: ModelMessage[]): Exchange[] {
  const exchanges: Exchange[] = [];
  let i = 0;

  while (i < messages.length) {
    if (messages[i].role === 'assistant') {
      const assistantIndex = i;
      i++;
      const toolIndices: number[] = [];
      while (i < messages.length && messages[i].role === 'tool') {
        toolIndices.push(i);
        i++;
      }
      if (toolIndices.length > 0) {
        exchanges.push({ assistantIndex, toolIndices });
      }
      continue;
    }
    i++;
  }

  return exchanges;
}

function parseOutputValue(output: unknown): Record<string, unknown> {
  if (output == null) {
    return {};
  }

  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }

  if (typeof output !== 'object' || Array.isArray(output)) {
    return {};
  }

  const typed = output as { type?: string; value?: unknown };
  if (typed.type === 'json' && typed.value && typeof typed.value === 'object') {
    return typed.value as Record<string, unknown>;
  }
  if (typed.type === 'text' && typeof typed.value === 'string') {
    try {
      const parsed = JSON.parse(typed.value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return output as Record<string, unknown>;
}

/** Prune summary templates live in Skills/tool-meta.json (`prune.summary`). */
function summarizeToolName(toolName: string, output: unknown): string | null {
  const template = getToolMeta(toolName)?.prune?.summary;
  if (!template) return null;
  const data = parseOutputValue(output);
  return template.replace(/\{(\w+)\}/g, (_match, field: string) => {
    const value: unknown = data[field];
    if (Array.isArray(value)) return String(value.length);
    return value == null ? '?' : String(value);
  });
}

function summarizeToolMessage(message: ModelMessage): ModelMessage {
  if (message.role !== 'tool' || !Array.isArray(message.content)) {
    return message;
  }

  return {
    ...message,
    content: message.content.map((part) => {
      if (part.type !== 'tool-result') {
        return part;
      }

      const summary = summarizeToolName(part.toolName, part.output);
      if (summary === null) {
        return part;
      }

      return {
        ...part,
        output: { type: 'text' as const, value: summary },
      };
    }),
  };
}

export function pruneToolResults(messages: ModelMessage[]): ModelMessage[] {
  const exchanges = segmentExchanges(messages);
  if (exchanges.length <= KEEP_EXCHANGES) {
    return messages;
  }

  const pruneBeforeIndex = exchanges.length - KEEP_EXCHANGES;
  const indicesToPrune = new Set<number>();

  for (let exchangeIndex = 0; exchangeIndex < pruneBeforeIndex; exchangeIndex++) {
    for (const toolIndex of exchanges[exchangeIndex].toolIndices) {
      indicesToPrune.add(toolIndex);
    }
  }

  return messages.map((message, index) =>
    indicesToPrune.has(index) ? summarizeToolMessage(message) : message
  );
}
