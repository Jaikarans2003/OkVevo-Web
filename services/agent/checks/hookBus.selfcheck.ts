/**
 * Hook bus: registration order + results, PreToolUse first-block short-circuit,
 * JobCompleted routing errors, UserPromptSubmit/PostToolUse payload plumbing.
 * Firestore-free: every path asserted here stops before a Firestore read/write.
 * Run: npx tsx checks/hookBus.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  emitHook,
  emitPreToolUse,
  onHook,
  type PostToolUseEvent,
} from '../src/hooks/bus';
import { emitJobCompleted } from '../src/hooks/dispatch';
import { getSessionWorkdir } from '../src/tools/lib/utils';
import type { ToolCtx } from '../src/tools';

const ctx: ToolCtx = {
  sessionId: 'hook-bus-selfcheck',
  userId: 'check',
  pipelineMode: 'auto',
  skillName: '',
  taggedArtifacts: [],
  restoreAllowlistUrls: [],
};

async function main() {
  // --- PreToolUse allow path (built-in handlers only, no block) ---
  const allowed = await emitPreToolUse({
    toolName: 'read_file',
    args: { path: 'x' },
    ctx,
    manifest: null,
  });
  assert.equal(allowed.blocked, false);

  // --- PreToolUse first block wins; later handlers do not run ---
  let laterRan = false;
  onHook('PreToolUse', () => {
    laterRan = true;
  });
  const denied = await emitPreToolUse({
    toolName: 'run_command',
    args: { command: 'cat /proc/self/environ' },
    ctx,
    manifest: null,
  });
  assert.equal(denied.blocked, true);
  assert.match(
    String((denied as { output: { stderr: string } }).output.stderr),
    /process environments/
  );
  assert.equal(laterRan, false);

  // --- registration order + results collection (RenderFailed: no harness handlers) ---
  const calls: string[] = [];
  onHook('RenderFailed', () => {
    calls.push('a');
    return 'ra';
  });
  onHook('RenderFailed', () => {
    calls.push('b');
    return 'rb';
  });
  const results = await emitHook('RenderFailed', {
    sessionId: ctx.sessionId,
    userId: ctx.userId,
    status: 'FAILED',
    error: 'boom',
  });
  assert.deepEqual(calls, ['a', 'b']);
  assert.deepEqual(results, ['ra', 'rb']);

  // --- JobCompleted: missing hook is terminal; unstamped job still throws ---
  const terminal = await emitJobCompleted({
    eventName: 'transcript_ready',
    job: { taskId: 'fal_stt', requestId: 'job-a', resumeOnCompletion: true, skillId: 'manim-video' },
    sessionId: ctx.sessionId,
    userId: ctx.userId,
    pipelineMode: 'auto',
  });
  assert.equal(terminal.status, 'delivered');
  await assert.rejects(
    emitJobCompleted({
      eventName: 'transcript_ready',
      job: { taskId: 'fal_stt', requestId: 'unstamped', resumeOnCompletion: false },
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      pipelineMode: 'auto',
    }),
    /missing skillId stamp/
  );

  // --- UserPromptSubmit: plain chat passes through untouched ---
  const workdir = getSessionWorkdir(ctx.sessionId);
  fs.mkdirSync(path.join(workdir, 'hf-project'), { recursive: true });
  try {
    const plain = {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      userMessage: 'hello, just chatting',
      skillId: null,
      taggedArtifacts: [],
      userContent: 'hello, just chatting',
      systemAppends: [] as string[],
    };
    await emitHook('UserPromptSubmit', plain);
    assert.equal(plain.userContent, 'hello, just chatting');
    assert.deepEqual(plain.systemAppends, []);

    // Edit intent with no resolvable target → clarification block injected.
    const edit = {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      userMessage: 'edit the thingamajig',
      skillId: null,
      taggedArtifacts: [],
      userContent: 'edit the thingamajig',
      systemAppends: [] as string[],
    };
    await emitHook('UserPromptSubmit', edit);
    assert.match(edit.userContent, /intent unclear/);
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }

  // --- PostToolUse: haltTurn output captured on the event ---
  const post: PostToolUseEvent = {
    sessionId: ctx.sessionId,
    userId: ctx.userId,
    skillId: null,
    toolCalls: [{ toolName: 'read_file', input: { path: 'x' } }],
    toolResults: [
      {
        toolName: 'ask_clarification',
        output: { haltTurn: true, checkpointDisplay: { checkpointId: 'cp1' } },
      },
    ],
  };
  await emitHook('PostToolUse', post);
  assert.equal(
    (post.checkpointDisplay as { checkpointId: string }).checkpointId,
    'cp1'
  );

  const blockedManim = await emitPreToolUse({
    toolName: 'write_file',
    args: { path: 'manim_scripts/scene.py', content: 'MAX_VISIBLE = 20\n' },
    ctx,
    manifest: null,
  });
  assert.equal(blockedManim.blocked, true);
  assert.match(
    String((blockedManim as { output: { error: string } }).output.error),
    /MAX_VISIBLE/
  );

  const otherWrite = await emitPreToolUse({
    toolName: 'write_file',
    args: { path: 'notes.txt', content: 'MAX_VISIBLE = 20\n' },
    ctx,
    manifest: null,
  });
  assert.equal(otherWrite.blocked, false);

  const fsSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/tools/general/filesystem.ts'),
    'utf-8'
  );
  assert.doesNotMatch(fsSrc, /assertManimMaxVisible/);
  assert.doesNotMatch(fsSrc, /syncHfProjectFileAfterEdit/);

  console.log('hookBus.selfcheck: ok');
}

void main();
