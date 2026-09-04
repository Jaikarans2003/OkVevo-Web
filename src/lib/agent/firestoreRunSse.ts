import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { seedOpenPartStarts } from '@/lib/agent/seedOpenPartStarts';
import { logStudioDelta } from '@/lib/agent/studioPerf';
import {
  createReconnectPacer,
  mergeConsecutiveDeltas,
} from '@/lib/agent/smoothStreamSkipStatus';

const STREAM_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1',
  'x-accel-buffering': 'no',
};

function sseFrame(seq: number, chunk: unknown): string {
  return `id: ${seq}\ndata: ${JSON.stringify(chunk)}\n\n`;
}

export function streamRunEventsFromFirestore(opts: {
  sessionId: string;
  runId: string;
  afterSeq: number;
  signal?: AbortSignal;
  onListenError?: () => void;
}): Response {
  const { sessionId, runId, afterSeq, signal, onListenError } = opts;
  const encoder = new TextEncoder();
  const eventsQuery = query(
    collection(db, 'sessions', sessionId, 'runs', runId, 'events'),
    where('seq', '>', afterSeq),
    orderBy('seq')
  );
  const runDoc = doc(db, 'sessions', sessionId, 'runs', runId);

  let finish: (sendDone: boolean) => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const seen = { text: new Set<string>(), tool: new Set<string>() };
      let cursor = afterSeq;
      let closed = false;
      let currentSeq = afterSeq;
      let unsubEvents = () => {};
      let unsubRun = () => {};

      const pacer = createReconnectPacer((chunk) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseFrame(currentSeq, chunk)));
        } catch {
          finish(false);
        }
      });

      const emitBatch = (rows: Array<{ seq?: unknown; chunk?: unknown }>) => {
        const raw: Record<string, unknown>[] = [];
        for (const data of rows) {
          if (typeof data.seq === 'number') {
            cursor = data.seq;
            currentSeq = data.seq;
          }
          if (data.chunk && typeof data.chunk === 'object') {
            raw.push(data.chunk as Record<string, unknown>);
          }
        }
        for (const chunk of mergeConsecutiveDeltas(raw)) {
          for (const next of seedOpenPartStarts(chunk, seen)) {
            logStudioDelta('reconnect-fs', next);
            void pacer.push(next);
          }
        }
      };

      finish = (sendDone: boolean) => {
        if (closed) return;
        closed = true;
        unsubEvents();
        unsubRun();
        void pacer.close().then(() => {
          try {
            if (sendDone) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
            controller.close();
          } catch {
            // already closed
          }
        });
      };

      unsubEvents = onSnapshot(
        eventsQuery,
        (snap) => {
          if (closed) return;
          emitBatch(
            snap
              .docChanges()
              .filter((change) => change.type === 'added')
              .map((change) => change.doc.data())
          );
        },
        (err) => {
          console.error(
            '[agent] firestore event listen failed',
            { sessionId, runId },
            err
          );
          onListenError?.();
          finish(false);
        }
      );

      unsubRun = onSnapshot(
        runDoc,
        async (snap) => {
          const status = snap.data()?.status;
          if (!status || status === 'running') return;
          try {
            const rest = await getDocs(
              query(
                collection(db, 'sessions', sessionId, 'runs', runId, 'events'),
                where('seq', '>', cursor),
                orderBy('seq')
              )
            );
            if (!closed) emitBatch(rest.docs.map((restDoc) => restDoc.data()));
          } catch {
            // closing anyway
          }
          finish(true);
        },
        (err) => {
          console.error(
            '[agent] firestore run listen failed',
            { sessionId, runId },
            err
          );
          onListenError?.();
          finish(false);
        }
      );

      const onAbort = () => finish(false);
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) finish(false);
    },
    cancel() {
      finish(false);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: STREAM_HEADERS,
  });
}
