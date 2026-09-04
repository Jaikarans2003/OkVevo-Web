/**
 * Snapshot-then-live resume: key is sessionId:runId; hydrate then ?after=;
 * never replay from 0 after snapshot.
 * Run: npx tsx src/lib/agent/resumeStream.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedOpenPartStarts } from './seedOpenPartStarts.ts';
import {
  isUiSnapshotFresh,
  reconstructUiMessage,
  stampCheckpointChunk,
  upsertCheckpointParts,
} from './reconstructUiMessage.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const shellSrc = fs.readFileSync(
  path.join(root, 'src/components/workspace/ai-studio/AiStudioShell.tsx'),
  'utf8'
);
const streamSrc = fs.readFileSync(
  path.join(
    root,
    'src/app/api/agent/sessions/[sessionId]/stream/route.ts'
  ),
  'utf8'
);
const loadingSrc = fs.readFileSync(
  path.join(root, 'src/components/shared/LoadingScreen.tsx'),
  'utf8'
);
const projectLoaderSrc = fs.readFileSync(
  path.join(
    root,
    'src/components/workspace/ai-studio/AiStudioProjectLoader.tsx'
  ),
  'utf8'
);

assert.match(shellSrc, /pipelineState\?\.activeRunId/);
assert.match(shellSrc, /isPreparingSend=\{isPreparingSend\}/);
assert.match(
  shellSrc,
  /const durableLive = Boolean\(pipelineState\?\.activeRunId\)/
);
assert.match(shellSrc, /durableLive=\{durableLive\}/);
assert.match(
  shellSrc,
  /isPreparingSend \|\|\s*pipelineState\?\.activeRunId/,
  'handleSubmit must reject while a durable run is live'
);
assert.match(
  shellSrc,
  /usePipelineState\(activeSessionId/,
  'pipeline listener must start with the session id, not after sessionReady'
);
assert.match(
  shellSrc,
  /snap\.activeRunId\) \{\s*resumeKeyRef/,
  'session load must resume from the first snapshot when a run is active'
);

const chatBarSrc = fs.readFileSync(
  path.join(root, 'src/components/workspace/ai-studio/AiStudioChatBar.tsx'),
  'utf8'
);
assert.match(
  chatBarSrc,
  /status === 'submitted' \|\| status === 'streaming' \|\| durableLive/,
  'composer sending must OR durableLive so reconnect ready does not unlock'
);

const timelineSrc = fs.readFileSync(
  path.join(root, 'src/components/workspace/ai-studio/AiStudioTimeline.tsx'),
  'utf8'
);
assert.match(timelineSrc, /live-consumer-host/);
assert.match(timelineSrc, /isPreparingSend/);
assert.match(timelineSrc, /pinnedLiveIdRef/);
assert.doesNotMatch(
  timelineSrc,
  /isPendingTurn && !streamingAssistantId/,
  'must not mount a second empty live status on submitted'
);
assert.match(shellSrc, /status === 'submitted' \|\| status === 'streaming'/);
assert.match(shellSrc, /status === 'error'\) clearError\(\)/);
assert.match(shellSrc, /resumeKeyRef/);
assert.match(
  shellSrc,
  /\$\{activeSessionId\}:\$\{runId\}/,
  'resume key includes sessionId'
);
assert.match(shellSrc, /loadedSessionRef\.current = null/);
assert.match(shellSrc, /void stopThis\(\)/);
assert.match(
  shellSrc,
  /prev === 'streaming' \|\| prev === 'submitted'/,
  'SSE close must clear resume key so the same run can re-attach'
);
assert.match(
  shellSrc,
  /snap\.activeRunId !== runId/,
  'stale pipeline activeRunId must not resume a finished run'
);
assert.match(shellSrc, /fetchSessionSnapshot/);
assert.match(
  shellSrc,
  /response\.status === 404\) return \[\]/,
  'new-session assets GET 404 is empty, not an error'
);
assert.match(shellSrc, /reconnect-snapshot-start/);
assert.match(shellSrc, /reconnect-ui-painted/);
assert.match(shellSrc, /action: 'warmup'/);
assert.match(shellSrc, /\?after=\$\{after\}/);
assert.doesNotMatch(shellSrc, /idle:/);
assert.match(
  shellSrc,
  /api: `\/api\/agent\/sessions\/\$\{id\}\/stream\$\{qs\}`/,
  'stream resume must be same-origin (not AGENT_API Cloud Run origin)'
);
assert.doesNotMatch(
  shellSrc,
  /api: `\$\{AGENT_API\}\/sessions\/\$\{id\}\/stream`/,
  'must not resume via Cloud Run origin (CORS Failed to fetch on localhost)'
);
assert.ok(
  shellSrc.indexOf('resumeKeyRef.current = key') <
    shellSrc.indexOf('await resumeStream()'),
  'ref is assigned before resumeStream()'
);

assert.match(streamSrc, /console\.error\('\[agent\] stream poll failed'/);
assert.match(streamSrc, /controller\.close\(\)/);
assert.doesNotMatch(streamSrc, /controller\.error/);
assert.match(streamSrc, /Access-Control-Allow-Origin/);
assert.match(streamSrc, /export async function OPTIONS/);
assert.match(streamSrc, /id: \$\{seq\}/);
assert.match(streamSrc, /seedOpenPartStarts/);

const sessionRouteSrc = fs.readFileSync(
  path.join(root, 'src/app/api/agent/sessions/[sessionId]/route.ts'),
  'utf8'
);
assert.match(sessionRouteSrc, /reconstructUiMessage/);
assert.match(sessionRouteSrc, /lastSeq/);
assert.match(sessionRouteSrc, /isUiSnapshotFresh/);
assert.match(sessionRouteSrc, /uiSnapshot/);
assert.match(
  sessionRouteSrc,
  /data\.seq > lastSeq/,
  'snapshot lastSeq is the reconstructed max seq, not a stale throttled field'
);

const agentRouteSrc = fs.readFileSync(
  path.join(root, 'src/app/api/agent/route.ts'),
  'utf8'
);
assert.match(agentRouteSrc, /AgentCore stream proxy failed/);
assert.doesNotMatch(
  agentRouteSrc,
  /controller\.error\(err\)/,
  'AgentCore proxy must not controller.error (surfaces as Failed to fetch)'
);

assert.doesNotMatch(loadingSrc, /Math.random/);
assert.doesNotMatch(projectLoaderSrc, /Math.random/);
assert.match(loadingSrc, /charCodeAt/);
assert.match(projectLoaderSrc, /charCodeAt/);

assert.match(
  shellSrc,
  /pendingCheckpointId\) return;\s*clearError\(\)/s,
  'error + pending soft-ask must clearError so the card is usable'
);

assert.match(shellSrc, /AbortController/);
assert.match(shellSrc, /10_000/);
assert.match(
  shellSrc,
  /status === 'submitted' \|\| status === 'streaming'\) return/,
  'skip assets fetch while live chat stream holds sockets'
);
assert.match(shellSrc, /streamRunEventsFromFirestore/);
assert.doesNotMatch(shellSrc, /setInterval/);

const hookSrc = fs.readFileSync(
  path.join(root, 'src/hooks/usePipelineState.ts'),
  'utf8'
);
assert.match(hookSrc, /onSnapshot/);
assert.doesNotMatch(hookSrc, /setInterval/);
assert.doesNotMatch(hookSrc, /POLL_MS/);

const sseSrc = fs.readFileSync(
  path.join(root, 'src/lib/agent/firestoreRunSse.ts'),
  'utf8'
);
assert.match(sseSrc, /onSnapshot/);
assert.match(sseSrc, /where\('seq', '>', afterSeq\)/);
assert.match(sseSrc, /createReconnectPacer/);
assert.match(sseSrc, /cancel\(\)/, 'consumer cancel must unsub firestore listens');
assert.match(streamSrc, /createReconnectPacer/);

async function main() {
  const seen = { text: new Set<string>(), tool: new Set<string>() };
  const seeded = seedOpenPartStarts(
    { type: 'text-delta', id: 't1', delta: 'ld' },
    seen
  );
  assert.equal(seeded[0]?.type, 'text-start');
  assert.equal(seeded[1]?.type, 'text-delta');

  const parts = upsertCheckpointParts([
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
  assert.equal(parts.length, 1);
  assert.equal((parts[0]!.data as { status: string }).status, 'answered');

  const reconstructed = await reconstructUiMessage([
    { type: 'start', messageId: 'm1' },
    stampCheckpointChunk(1, {
      type: 'data-checkpoint',
      data: { checkpointId: 'cp1', status: 'pending' },
    }),
    stampCheckpointChunk(2, {
      type: 'data-checkpoint',
      data: { checkpointId: 'cp1', status: 'answered' },
    }),
  ]);
  const cps = (reconstructed?.parts ?? []).filter((p) => p.type === 'data-checkpoint');
  assert.equal(cps.length, 1);

  assert.equal(
    isUiSnapshotFresh(
      { lastSeq: 5, message: { id: 'm', role: 'assistant', parts: [] } },
      5
    ),
    true
  );
  assert.equal(
    isUiSnapshotFresh(
      { lastSeq: 4, message: { id: 'm', role: 'assistant', parts: [] } },
      5
    ),
    false
  );
  assert.equal(isUiSnapshotFresh(undefined, 0), false);

  console.log('resumeStream.selfcheck: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
