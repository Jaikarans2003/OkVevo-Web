/**
 * JobCompleted queues only on RunInProgressError; success never double-continues;
 * supervisor cap writes a visible approval checkpoint.
 * Run: npx tsx src/autoContinue.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTO_CONTINUE_CAP,
  shouldSuperviseContinue,
} from './autoContinue.ts';

const root = path.dirname(fileURLToPath(import.meta.url));

const dispatchSrc = fs.readFileSync(path.join(root, 'hooks/dispatch.ts'), 'utf8');
assert.match(dispatchSrc, /queuePendingJobContinue/);
assert.match(dispatchSrc, /status: 'queued'/);
assert.match(
  dispatchSrc,
  /if \(err instanceof RunInProgressError\)/,
  'only RunInProgressError queues'
);
const catchIdx = dispatchSrc.indexOf('if (err instanceof RunInProgressError)');
const successReturnIdx = dispatchSrc.lastIndexOf("return { status: 'continued', skillId }");
assert.ok(catchIdx > 0 && successReturnIdx > catchIdx);
const successSlice = dispatchSrc.slice(successReturnIdx);
assert.doesNotMatch(
  successSlice,
  /queuePendingJobContinue/,
  'success path must not queue'
);
const beforeCatch = dispatchSrc.slice(0, catchIdx);
assert.doesNotMatch(
  beforeCatch,
  /queuePendingJobContinue/,
  'queue only in RunInProgressError catch'
);

const falSrc = fs.readFileSync(path.join(root, 'falSttDeliver.ts'), 'utf8');
assert.match(falSrc, /result\.status === 'queued'/);
assert.match(
  falSrc,
  /result\.status !== 'queued'/,
  'queued must not clear falSttResumePending'
);

const runLogSrc = fs.readFileSync(path.join(root, 'runLog.ts'), 'utf8');
assert.match(runLogSrc, /pendingJobContinue: FieldValue\.delete\(\)/);
assert.match(
  runLogSrc,
  /existing\?\.requestId === payload\.requestId/,
  'same requestId is a no-op'
);

const agentSrc = fs.readFileSync(path.join(root, 'agent.ts'), 'utf8');
assert.match(agentSrc, /afterCloseRun/);
assert.match(agentSrc, /void afterCloseRun/);

const autoSrc = fs.readFileSync(path.join(root, 'autoContinue.ts'), 'utf8');
assert.match(autoSrc, /writeAskCheckpoint/);
assert.match(autoSrc, /kind: 'approval'/);
assert.match(autoSrc, /allowFreeform: false/);
assert.match(autoSrc, /AUTO_CONTINUE_CAP/);
assert.match(
  autoSrc,
  /saveMessage/,
  'cap exhaust must persist a checkpoint part so the floating card can render'
);
assert.doesNotMatch(
  autoSrc,
  /startAgentUiRun[\s\S]{0,80}count >= AUTO_CONTINUE_CAP/,
  'cap exhaust must not start another silent run'
);

assert.equal(AUTO_CONTINUE_CAP, 3);
assert.equal(
  shouldSuperviseContinue({
    pipelineMode: 'auto',
    pipelineStatus: 'running',
  }),
  true
);
assert.equal(
  shouldSuperviseContinue({
    pipelineMode: 'auto',
    pendingCheckpointId: 'cp1',
    pipelineStatus: 'running',
  }),
  false
);
assert.equal(
  shouldSuperviseContinue({
    pipelineMode: 'auto',
    pipelineStatus: 'complete',
  }),
  false
);
assert.equal(
  shouldSuperviseContinue({
    pipelineMode: 'ask',
    pipelineStatus: 'running',
  }),
  false
);
assert.equal(
  shouldSuperviseContinue({
    pipelineMode: 'auto',
    transcriptionProgress: { status: 'complete' },
  }),
  true
);

const checkpointSrc = fs.readFileSync(
  path.join(root, '../../../src/components/workspace/ai-studio/CheckpointCard.tsx'),
  'utf8'
);
assert.match(checkpointSrc, /winningCheckpointIdsByMessage/);

console.log('autoContinue.selfcheck: ok');
