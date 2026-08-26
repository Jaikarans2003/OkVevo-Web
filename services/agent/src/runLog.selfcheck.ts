/**
 * Durable UI run log: coalesced deltas reconstruct the same parts; idle replay is 204;
 * JobCompleted persist no longer needs an HTTP response.
 * Run: npx tsx src/runLog.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readUIMessageStream } from 'ai';
import {
  coalesceUiChunkStream,
  idleReplayStatus,
  reconstructUiMessage,
  stampCheckpointChunk,
  upsertCheckpointParts,
  type UiChunk,
} from './runLog.ts';

function streamOf(chunks: UiChunk[]): ReadableStream<UiChunk> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<UiChunk>): Promise<UiChunk[]> {
  const out: UiChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

async function reconstructParts(chunks: UiChunk[]) {
  let last: { parts: unknown[] } | undefined;
  for await (const message of readUIMessageStream({
    stream: streamOf(chunks) as ReadableStream<never>,
  })) {
    last = message as { parts: unknown[] };
  }
  return last?.parts ?? [];
}

const raw: UiChunk[] = [
  { type: 'start', messageId: 'm1' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'Hel' },
  { type: 'text-delta', id: 't1', delta: 'lo ' },
  { type: 'text-delta', id: 't1', delta: 'world' },
  { type: 'text-end', id: 't1' },
  {
    type: 'tool-input-start',
    toolCallId: 'c1',
    toolName: 'extract_concepts',
  },
  {
    type: 'tool-input-available',
    toolCallId: 'c1',
    toolName: 'extract_concepts',
    input: { topic: 'gravity' },
  },
  {
    type: 'tool-output-available',
    toolCallId: 'c1',
    output: { ok: true },
  },
  { type: 'finish' },
];

async function main() {
  const coalesced = await collect(
    coalesceUiChunkStream(streamOf(raw), { windowMs: 10_000, maxChars: 10_000 })
  );
  assert.equal(
    coalesced.filter((c) => c.type === 'text-delta').length,
    1,
    'consecutive text-deltas coalesce'
  );
  assert.equal(
    coalesced.find((c) => c.type === 'text-delta')?.delta,
    'Hello world'
  );
  assert.equal(
    coalesced.filter((c) => c.type.startsWith('tool-')).length,
    3,
    'tool chunks flush immediately'
  );

  const originalParts = await reconstructParts(raw);
  const coalescedParts = await reconstructParts(coalesced);
  assert.deepEqual(
    coalescedParts,
    originalParts,
    'coalesced log reconstructs the same UI parts onFinish would save'
  );

  const snap = await reconstructUiMessage(coalesced);
  assert.ok(snap);
  assert.deepEqual(snap.parts, coalescedParts);

  const numbered = coalesced.map((chunk, i) => stampCheckpointChunk(i + 1, chunk));
  const fromChunks = await reconstructUiMessage(numbered);
  assert.ok(fromChunks);
  assert.deepEqual(fromChunks.parts, coalescedParts);
  assert.equal(numbered.length, numbered.at(-1) ? numbered.length : 0);

  const runLogSrc = fs.readFileSync(path.join(__dirname, 'runLog.ts'), 'utf8');
  assert.match(runLogSrc, /uiSnapshot/);
  assert.match(runLogSrc, /persistUiSnapshot/);
  assert.match(runLogSrc, /chunksByRun/);
  const lastSeq = 4;
  const tail = numbered.filter((_, i) => i + 1 > lastSeq);
  assert.equal(tail.some((c) => c.type === 'start'), false);
  assert.equal(
    tail.some((c) => c.type === 'text-delta' && String(c.delta).includes('Hel')),
    false,
    'live tail after lastSeq omits earlier deltas'
  );

  const pendingThenAnswered = upsertCheckpointParts([
    {
      type: 'data-checkpoint',
      id: 'cp1',
      data: { checkpointId: 'cp1', status: 'pending', seq: 5 },
    },
    {
      type: 'data-checkpoint',
      id: 'cp1',
      data: { checkpointId: 'cp1', status: 'answered', seq: 9 },
    },
    {
      type: 'data-checkpoint',
      id: 'cp1',
      data: { checkpointId: 'cp1', status: 'pending', seq: 5 },
    },
  ]);
  assert.equal(pendingThenAnswered.length, 1);
  assert.equal(
    (pendingThenAnswered[0]!.data as { status: string }).status,
    'answered'
  );

  const twoChunksSameId = await reconstructUiMessage([
    { type: 'start', messageId: 'm-cp' },
    stampCheckpointChunk(5, {
      type: 'data-checkpoint',
      data: { checkpointId: 'cp1', status: 'pending', title: 'a' },
    }),
    stampCheckpointChunk(9, {
      type: 'data-checkpoint',
      data: { checkpointId: 'cp1', status: 'answered', title: 'a' },
    }),
  ]);
  const cpParts = (twoChunksSameId?.parts ?? []).filter(
    (p) => p.type === 'data-checkpoint'
  );
  assert.equal(cpParts.length, 1);
  assert.equal(
    (cpParts[0] as { data: { status: string } }).data.status,
    'answered'
  );

  assert.equal(idleReplayStatus(null), 204);
  assert.equal(idleReplayStatus(undefined), 204);
  assert.equal(idleReplayStatus(''), 204);
  assert.equal(idleReplayStatus('run_1'), 200);

  const dispatchSrc = fs.readFileSync(
    path.join(__dirname, 'hooks/dispatch.ts'),
    'utf8'
  );
  assert.match(dispatchSrc, /startAgentUiRun/);
  assert.doesNotMatch(dispatchSrc, /await result\.result\.text/);
  assert.match(dispatchSrc, /origin:\s*'job_completed'/);

  const agentSrc = fs.readFileSync(path.join(__dirname, 'agent.ts'), 'utf8');
  assert.match(agentSrc, /startAgentUiRun/);
  assert.match(agentSrc, /appendCoalesced/);
  assert.match(agentSrc, /\[agent\] timing session=/);
  assert.match(agentSrc, /prework_ms=/);
  assert.match(agentSrc, /model_ttft_ms=/);
  assert.match(
    agentSrc,
    /text-delta\|text-start\|reasoning-delta\|tool-input-start\|tool-call/,
    'model_ttft_ms must wait for a visible token, not start/start-step'
  );
  assert.match(
    agentSrc,
    /UI HTTP pipe failed; log continues/,
    'HTTP pipe failures must be isolated from persist'
  );
  assert.match(agentSrc, /await httpDone/, 'must wait for HTTP flush before /chat returns');
  assert.doesNotMatch(
    agentSrc,
    /httpBranch\.cancel/,
    'cancelling the HTTP tee branch would cancel persist'
  );
  assert.doesNotMatch(
    agentSrc,
    /abortSignal:\s*(req|request)/,
    'must not abort streamText when the HTTP client disconnects'
  );

  console.log('runLog.selfcheck: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
