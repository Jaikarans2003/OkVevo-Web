import { readUIMessageStream, type UIMessage } from 'ai';

export type UiChunk = {
  type: string;
  id?: string;
  delta?: string;
  [key: string]: unknown;
};

function streamOf(chunks: UiChunk[]): ReadableStream<UiChunk> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function checkpointIdOf(part: {
  type: string;
  id?: string;
  data?: unknown;
}): string | null {
  if (part.type !== 'data-checkpoint') return null;
  if (typeof part.id === 'string' && part.id) return part.id;
  const data = part.data as { checkpointId?: unknown } | undefined;
  return typeof data?.checkpointId === 'string' ? data.checkpointId : null;
}

function checkpointSeqOf(part: { data?: unknown }): number {
  const seq = (part.data as { seq?: unknown } | undefined)?.seq;
  return typeof seq === 'number' ? seq : 0;
}

/** One data-checkpoint part per checkpointId; higher seq wins. */
export function upsertCheckpointParts<
  T extends { type: string; id?: string; data?: unknown },
>(parts: T[]): T[] {
  const best = new Map<string, { index: number; seq: number }>();
  parts.forEach((part, index) => {
    const id = checkpointIdOf(part);
    if (!id) return;
    const seq = checkpointSeqOf(part);
    const prev = best.get(id);
    if (!prev || seq > prev.seq) best.set(id, { index, seq });
  });
  const keep = new Set([...best.values()].map((v) => v.index));
  return parts.filter((part, index) => {
    if (part.type !== 'data-checkpoint' || !checkpointIdOf(part)) return true;
    return keep.has(index);
  });
}

export function stampCheckpointChunk(seq: number, chunk: UiChunk): UiChunk {
  if (chunk.type !== 'data-checkpoint') return chunk;
  const data =
    chunk.data && typeof chunk.data === 'object'
      ? { ...(chunk.data as Record<string, unknown>), seq }
      : { seq };
  const rec = data as Record<string, unknown>;
  const checkpointId =
    typeof rec.checkpointId === 'string'
      ? rec.checkpointId
      : typeof chunk.id === 'string'
        ? chunk.id
        : undefined;
  return {
    ...chunk,
    ...(checkpointId ? { id: checkpointId } : {}),
    data,
  };
}

export type UiSnapshot = {
  lastSeq: number;
  message: UIMessage;
};

export function isUiSnapshotFresh(
  value: unknown,
  runLastSeq: number
): value is UiSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snap = value as { lastSeq?: unknown; message?: unknown };
  if (typeof snap.lastSeq !== 'number' || snap.lastSeq < runLastSeq) return false;
  if (!snap.message || typeof snap.message !== 'object') return false;
  return Array.isArray((snap.message as { parts?: unknown }).parts);
}

export async function reconstructUiMessage(
  chunks: UiChunk[]
): Promise<UIMessage | null> {
  if (chunks.length === 0) return null;
  let last: UIMessage | undefined;
  for await (const message of readUIMessageStream({
    stream: streamOf(chunks) as unknown as ReadableStream<never>,
  })) {
    last = message;
  }
  if (!last) return null;
  return {
    ...last,
    parts: upsertCheckpointParts(last.parts),
  };
}
