/** Studio performance marks. Console: `[studio] name Nms`. */

/** Phase 3.6 investigation. Gated off after the report. */
export const STUDIO_DELTA_LOG = false;

export type StudioDeltaPath = 'live-post' | 'reconnect-fs' | 'reconnect-poll';

export type StudioDeltaSample = {
  path: StudioDeltaPath;
  type: string;
  chars: number;
  preview: number;
  gapMs: number;
};

declare global {
  var __studioDeltas: StudioDeltaSample[] | undefined;
  var __studioFirstSnap:
    | { events: number; chars: number; emitMs: number }
    | undefined;
  var __studioReconnectPath: 'firestore' | 'poll' | undefined;
}

const lastDeltaAt = new Map<StudioDeltaPath, number>();

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function logStudioDelta(
  path: StudioDeltaPath,
  chunk: { type?: unknown; delta?: unknown; text?: unknown }
) {
  if (!STUDIO_DELTA_LOG) return;
  if (chunk.type !== 'text-delta' && chunk.type !== 'reasoning-delta') return;
  const text = String(chunk.delta ?? chunk.text ?? '');
  const t = nowMs();
  const prev = lastDeltaAt.get(path);
  const gapMs = prev == null ? 0 : t - prev;
  lastDeltaAt.set(path, t);
  const sample: StudioDeltaSample = {
    path,
    type: chunk.type,
    chars: text.length,
    preview: text.length,
    gapMs,
  };
  globalThis.__studioDeltas = globalThis.__studioDeltas ?? [];
  globalThis.__studioDeltas.push(sample);
  console.info(
    `[studio] delta path=${path} chars=${sample.chars} preview=${sample.preview} gap_ms=${Math.round(gapMs)}`
  );
}

export function logStudioReconnectPath(path: 'firestore' | 'poll') {
  if (!STUDIO_DELTA_LOG) return;
  globalThis.__studioReconnectPath = path;
  console.info(`[studio] reconnect-path ${path}`);
}

export function logStudioFirstSnapshot(opts: {
  events: number;
  chars: number;
  emitMs: number;
}) {
  if (!STUDIO_DELTA_LOG) return;
  globalThis.__studioFirstSnap = opts;
  console.info(
    `[studio] reconnect-fs first-snapshot events=${opts.events} chars=${opts.chars} emit_ms=${Math.round(opts.emitMs)}`
  );
}

/** Tee an SSE body and log text/reasoning deltas without delaying useChat. */
export function tapUiSseDeltas(
  response: Response,
  path: StudioDeltaPath
): Response {
  if (!STUDIO_DELTA_LOG || !response.body || !response.ok) return response;
  const [out, tap] = response.body.tee();
  void parseSseDeltas(tap, path);
  return new Response(out, { status: response.status, headers: response.headers });
}

async function parseSseDeltas(
  stream: ReadableStream<Uint8Array>,
  path: StudioDeltaPath
) {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          logStudioDelta(path, JSON.parse(data) as { type?: unknown });
        } catch {
          // non-JSON SSE comment
        }
      }
    }
  } catch {
    // stream aborted
  }
}

export function markStudio(label: string) {
  performance.mark(label);
}

export function measureStudio(name: string, start: string, end: string) {
  try {
    performance.measure(name, start, end);
    const last = performance.getEntriesByName(name).at(-1);
    if (last) console.info(`[studio] ${name} ${Math.round(last.duration)}ms`);
  } catch {
    // missing mark
  }
}

/** Resource Timing for the chat POST (not session CRUD, not warmup). */
export function logAgentPostTtfb(requestUrl: string) {
  if (!requestUrl.includes('/api/agent') || requestUrl.includes('/sessions')) {
    return;
  }
  queueMicrotask(() => {
    const entries = performance.getEntriesByType(
      'resource'
    ) as PerformanceResourceTiming[];
    const hit = [...entries]
      .reverse()
      .find(
        (e) => e.name.includes('/api/agent') && !e.name.includes('/sessions')
      );
    if (!hit) return;
    const ttfb = hit.responseStart - hit.requestStart;
    if (!Number.isFinite(ttfb) || ttfb < 0) return;
    console.info(`[studio] post-agent-ttfb ${Math.round(ttfb)}ms`);
  });
}
