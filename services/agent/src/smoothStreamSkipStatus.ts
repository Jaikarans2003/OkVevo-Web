/**
 * Word-pace prose (18ms) but flush [[STATUS: …]] with no delay.
 * STATUS is a structural header, not typewriter text.
 * Backlog catch-up: delay = min(18, 18 / remainingWords). Live 1-word stays 18ms.
 */

const WORD_RE = /\S+\s+/m;
const STATUS_OPEN = '[[STATUS:';
const STATUS_CLOSE = ']]';
export const WORD_DELAY_MS = 18;
/** Target buffer = one word. Larger TARGET leaves a linear tail of TARGET/18 words. */
const CATCH_UP_TARGET_MS = WORD_DELAY_MS;

function nextWord(buffer: string): string | null {
  const match = WORD_RE.exec(buffer);
  if (!match) return null;
  return buffer.slice(0, match.index) + match[0];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function remainingWords(s: string): number {
  let n = 0;
  let rest = s;
  for (;;) {
    const word = nextWord(rest);
    if (!word) {
      if (/\S/.test(rest)) n += 1;
      return n;
    }
    n += 1;
    rest = rest.slice(word.length);
  }
}

export function wordDelayMs(remainingAfterEmit: number): number {
  if (remainingAfterEmit <= 0) return WORD_DELAY_MS;
  return Math.min(WORD_DELAY_MS, CATCH_UP_TARGET_MS / remainingAfterEmit);
}

type DeltaChunk = {
  type: string;
  id?: string;
  text?: string;
  delta?: string;
  [key: string]: unknown;
};

function payloadOf(chunk: DeltaChunk): string {
  return chunk.delta ?? chunk.text ?? '';
}

function usesDelta(chunk: DeltaChunk): boolean {
  return chunk.delta !== undefined;
}

export function mergeConsecutiveDeltas<T extends Record<string, unknown>>(
  chunks: T[]
): T[] {
  const out: T[] = [];
  for (const chunk of chunks) {
    const prev = out[out.length - 1];
    const type = chunk.type;
    const isDelta = type === 'text-delta' || type === 'reasoning-delta';
    if (
      prev &&
      isDelta &&
      prev.type === type &&
      prev.id === chunk.id
    ) {
      const field = chunk.delta !== undefined ? 'delta' : 'text';
      (prev as Record<string, unknown>)[field] =
        String(prev[field] ?? '') + String(chunk[field] ?? '');
    } else {
      out.push({ ...chunk });
    }
  }
  return out;
}

export function smoothStreamSkipStatus() {
  return () => {
    let buffer = '';
    let id = '';
    let type: string | undefined;
    let field: 'delta' | 'text' = 'text';
    let proto: DeltaChunk = { type: 'text-delta' };

    function emit(
      controller: TransformStreamDefaultController<DeltaChunk>,
      text: string
    ) {
      const out: DeltaChunk = { ...proto, type: type!, id };
      if (field === 'delta') {
        delete out.text;
        out.delta = text;
      } else {
        delete out.delta;
        out.text = text;
      }
      controller.enqueue(out);
    }

    function flushAll(controller: TransformStreamDefaultController<DeltaChunk>) {
      if (buffer.length > 0 && type !== undefined) {
        emit(controller, buffer);
        buffer = '';
      }
    }

    return new TransformStream<DeltaChunk, DeltaChunk>({
      async transform(chunk, controller) {
        if (chunk.type !== 'text-delta' && chunk.type !== 'reasoning-delta') {
          flushAll(controller);
          controller.enqueue(chunk);
          return;
        }
        if ((chunk.type !== type || chunk.id !== id) && buffer.length > 0) {
          flushAll(controller);
        }
        field = usesDelta(chunk) ? 'delta' : 'text';
        proto = chunk;
        buffer += payloadOf(chunk);
        id = typeof chunk.id === 'string' ? chunk.id : id;
        type = chunk.type;

        for (;;) {
          const open = buffer.indexOf(STATUS_OPEN);
          if (open > 0) {
            const prefix = buffer.slice(0, open);
            const word = nextWord(prefix);
            if (word) {
              buffer = buffer.slice(word.length);
              emit(controller, word);
              await delay(wordDelayMs(remainingWords(buffer)));
              continue;
            }
            buffer = buffer.slice(open);
            emit(controller, prefix);
            continue;
          }
          if (open === 0) {
            const close = buffer.indexOf(STATUS_CLOSE);
            if (close === -1) return;
            const marker = buffer.slice(0, close + STATUS_CLOSE.length);
            buffer = buffer.slice(marker.length);
            emit(controller, marker);
            continue;
          }
          const word = nextWord(buffer);
          if (!word) return;
          buffer = buffer.slice(word.length);
          emit(controller, word);
          await delay(wordDelayMs(remainingWords(buffer)));
        }
      },
      flush(controller) {
        flushAll(controller);
      },
    });
  };
}

/** Reconnect read-side. Do not use on the live POST tee. */
export function createReconnectPacer(enqueue: (chunk: unknown) => void) {
  const ts = smoothStreamSkipStatus()();
  const writer = ts.writable.getWriter();
  const reader = ts.readable.getReader();
  const drain = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        enqueue(value);
      }
    } catch {
      // consumer closed the SSE stream mid-drain
    }
  })();
  let chain = Promise.resolve();
  return {
    push(chunk: unknown) {
      chain = chain
        .then(() => writer.write(chunk as DeltaChunk))
        .catch(() => undefined);
      return chain;
    },
    async close() {
      await chain;
      try {
        await writer.close();
      } catch {
        // already closed
      }
      await drain;
    },
  };
}
