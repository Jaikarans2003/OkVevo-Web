import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { readUIMessageStream, type UIMessage } from 'ai';

async function getDb() {
  return (await import('./firebase')).db;
}

export type RunOrigin = 'chat' | 'job_completed';
export type UiChunk = {
  type: string;
  id?: string;
  delta?: string;
  [key: string]: unknown;
};

export type PendingJobContinue = {
  requestId: string;
  userId: string;
  pipelineMode: 'ask' | 'auto';
  skillId: string;
  continuePrompt: string;
  forceToolName?: string;
};

const COALESCE_WINDOW_MS = 80;
const COALESCE_MAX_CHARS = 200;
const LAST_SEQ_THROTTLE_MS = 1000;
const SEQ_PAD = 8;

const seqByRun = new Map<string, number>();
const chunksByRun = new Map<string, UiChunk[]>();

function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function persistUiSnapshot(
  runRef: DocumentReference,
  runId: string,
  seq: number
): Promise<void> {
  const message = await reconstructUiMessage(chunksByRun.get(runId) ?? []);
  await runRef.set(
    {
      lastSeq: seq,
      ...(message
        ? { uiSnapshot: { lastSeq: seq, message: toJsonSafe(message) } }
        : {}),
    },
    { merge: true }
  );
}

export class RunInProgressError extends Error {
  readonly activeRunId: string | null;
  constructor(sessionId: string, activeRunId: string | null = null) {
    super(`run_in_progress:${sessionId}`);
    this.name = 'RunInProgressError';
    this.activeRunId = activeRunId;
  }
}

export function idleReplayStatus(activeRunId: unknown): 204 | 200 {
  return typeof activeRunId === 'string' && activeRunId.length > 0 ? 200 : 204;
}

export function padSeq(seq: number): string {
  return String(seq).padStart(SEQ_PAD, '0');
}

function isDelta(chunk: UiChunk): boolean {
  return chunk.type === 'text-delta' || chunk.type === 'reasoning-delta';
}

function canMerge(a: UiChunk, b: UiChunk): boolean {
  return isDelta(a) && isDelta(b) && a.type === b.type && a.id === b.id;
}

function isBoundary(chunk: UiChunk): boolean {
  return (
    chunk.type.startsWith('tool-') ||
    chunk.type === 'data-checkpoint' ||
    chunk.type === 'finish' ||
    chunk.type === 'error' ||
    chunk.type === 'start'
  );
}

function nextSeq(runId: string): number {
  const seq = (seqByRun.get(runId) ?? 0) + 1;
  seqByRun.set(runId, seq);
  return seq;
}

function streamOf(chunks: UiChunk[]): ReadableStream<UiChunk> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function checkpointIdOf(part: { type: string; id?: string; data?: unknown }): string | null {
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

function chunkIsHaltTurn(chunk: UiChunk): boolean {
  if (chunk.type !== 'tool-output-available') return false;
  const output = chunk.output;
  return (
    typeof output === 'object' &&
    output !== null &&
    (output as { haltTurn?: boolean }).haltTurn === true
  );
}

/** Rebuild the in-progress assistant from coalesced run-log chunks (one commit). */
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

function parsePendingJobContinue(raw: unknown): PendingJobContinue | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.requestId !== 'string' ||
    typeof row.userId !== 'string' ||
    typeof row.skillId !== 'string' ||
    typeof row.continuePrompt !== 'string'
  ) {
    return null;
  }
  const pipelineMode = row.pipelineMode === 'ask' ? 'ask' : 'auto';
  return {
    requestId: row.requestId,
    userId: row.userId,
    pipelineMode,
    skillId: row.skillId,
    continuePrompt: row.continuePrompt,
    ...(typeof row.forceToolName === 'string' && row.forceToolName
      ? { forceToolName: row.forceToolName }
      : {}),
  };
}

/** Persist at most one JobCompleted continue; same requestId is a no-op. */
export async function queuePendingJobContinue(
  sessionId: string,
  payload: PendingJobContinue
): Promise<void> {
  const db = await getDb();
  const sessionRef = db.collection('sessions').doc(sessionId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    const existing = parsePendingJobContinue(snap.data()?.pendingJobContinue);
    if (existing?.requestId === payload.requestId) return;
    tx.set(sessionRef, { pendingJobContinue: payload }, { merge: true });
  });
}

/** Merge consecutive same-id text/reasoning deltas. Flush on other types, char budget, or timer. */
export function coalesceUiChunkStream(
  source: ReadableStream<UiChunk>,
  opts?: { windowMs?: number; maxChars?: number }
): ReadableStream<UiChunk> {
  const windowMs = opts?.windowMs ?? COALESCE_WINDOW_MS;
  const maxChars = opts?.maxChars ?? COALESCE_MAX_CHARS;
  let pending: UiChunk | null = null;
  let pendingChars = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const transform = new TransformStream<UiChunk, UiChunk>({
    transform(chunk, controller) {
      const flush = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (pending) {
          controller.enqueue(pending);
          pending = null;
          pendingChars = 0;
        }
      };

      if (isDelta(chunk) && pending && canMerge(pending, chunk)) {
        const extra = String(chunk.delta ?? '');
        pending = {
          ...pending,
          delta: String(pending.delta ?? '') + extra,
        };
        pendingChars += extra.length;
        if (pendingChars >= maxChars) flush();
        else if (!timer) timer = setTimeout(flush, windowMs);
        return;
      }

      flush();
      if (isDelta(chunk)) {
        pending = { ...chunk };
        pendingChars = String(chunk.delta ?? '').length;
        if (pendingChars >= maxChars) flush();
        else timer = setTimeout(flush, windowMs);
        return;
      }
      controller.enqueue(chunk);
    },
    flush(controller) {
      if (timer) clearTimeout(timer);
      if (pending) controller.enqueue(pending);
    },
  });

  return source.pipeThrough(transform);
}

export async function peekActiveRun(sessionId: string): Promise<string | null> {
  const db = await getDb();
  const snap = await db.collection('sessions').doc(sessionId).get();
  const data = snap.data();
  if (data?.runStatus === 'running' && typeof data.activeRunId === 'string') {
    return data.activeRunId;
  }
  return null;
}

export async function openRun(
  sessionId: string,
  origin: RunOrigin
): Promise<string | null> {
  const db = await getDb();
  const runId = crypto.randomUUID();
  const sessionRef = db.collection('sessions').doc(sessionId);
  const runRef = sessionRef.collection('runs').doc(runId);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (snap.data()?.runStatus === 'running') {
        throw new RunInProgressError(
          sessionId,
          typeof snap.data()?.activeRunId === 'string'
            ? (snap.data()?.activeRunId as string)
            : null
        );
      }
      tx.set(
        sessionRef,
        {
          activeRunId: runId,
          runStatus: 'running',
          ...(origin === 'chat' ? { autoContinueCount: 0 } : {}),
        },
        { merge: true }
      );
      tx.set(runRef, {
        status: 'running',
        origin,
        lastSeq: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof RunInProgressError) return null;
    throw err;
  }
  seqByRun.set(runId, 0);
  chunksByRun.set(runId, []);
  return runId;
}

export async function closeRun(
  sessionId: string,
  runId: string,
  status: 'complete' | 'error'
): Promise<PendingJobContinue | null> {
  const db = await getDb();
  const sessionRef = db.collection('sessions').doc(sessionId);
  const runRef = sessionRef.collection('runs').doc(runId);
  const lastSeq = seqByRun.get(runId) ?? 0;
  await persistUiSnapshot(runRef, runId, lastSeq);
  await runRef.set(
    {
      status,
      lastSeq,
      endedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  let pending: PendingJobContinue | null = null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (snap.data()?.activeRunId !== runId) return;
    pending = parsePendingJobContinue(snap.data()?.pendingJobContinue);
    tx.set(
      sessionRef,
      {
        activeRunId: null,
        runStatus: 'idle',
        ...(pending ? { pendingJobContinue: FieldValue.delete() } : {}),
      },
      { merge: true }
    );
  });
  seqByRun.delete(runId);
  chunksByRun.delete(runId);
  return pending;
}

export async function appendCoalesced(
  sessionId: string,
  runId: string,
  source: ReadableStream<UiChunk>
): Promise<boolean> {
  const db = await getDb();
  const coalesced = coalesceUiChunkStream(source);
  const reader = coalesced.getReader();
  const events = db
    .collection('sessions')
    .doc(sessionId)
    .collection('runs')
    .doc(runId)
    .collection('events');
  const runRef = db
    .collection('sessions')
    .doc(sessionId)
    .collection('runs')
    .doc(runId);
  let lastSeqWrite = 0;
  let haltTurn = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const seq = nextSeq(runId);
      const stamped = stampCheckpointChunk(seq, value);
      if (chunkIsHaltTurn(stamped)) haltTurn = true;
      const buf = chunksByRun.get(runId);
      if (buf) buf.push(stamped);
      else chunksByRun.set(runId, [stamped]);
      await events.doc(padSeq(seq)).set({ seq, chunk: stamped });
      const now = Date.now();
      if (isBoundary(stamped) || now - lastSeqWrite > LAST_SEQ_THROTTLE_MS) {
        lastSeqWrite = now;
        await persistUiSnapshot(runRef, runId, seq);
      }
    }
    await persistUiSnapshot(runRef, runId, seqByRun.get(runId) ?? 0);
    return haltTurn;
  } finally {
    reader.releaseLock();
  }
}
