import 'dotenv/config';
import assert from 'node:assert/strict';
import { referencesProcEnviron } from '../src/policies';
import { evaluateToolCall } from '../src/permissions';
import { commandTargetsOwnedEditFile } from '../src/tools/lib/ownedEditFiles';
import { execCommand, sanitizedShellEnv } from '../src/tools/lib/utils';

async function main() {
  process.env.CHECK_FAKE_SECRET_TOKEN = 'must-not-leak';
  const env = sanitizedShellEnv();
  const sensitiveName = /KEY|SECRET|TOKEN|CREDENTIAL|JSON|PASSWORD/i;

  assert.equal(
    Object.keys(env).some((key) => sensitiveName.test(key)),
    false
  );
  assert.equal('CHECK_FAKE_SECRET_TOKEN' in env, false);
  assert(referencesProcEnviron('cat /proc/1/environ'));
  assert(referencesProcEnviron('strings "/proc/self/environ"'));
  assert.equal(referencesProcEnviron('printf environ'), false);

  // Owned HTML rewrite denied
  assert(commandTargetsOwnedEditFile('sed -i s/a/b/ hf-project/index.html'));

  // run_command allow-matchers gate binaries (replaces commandPolicy prefixes)
  const ffmpegOnly = { allow: ['run_command(ffmpeg:*)'] };
  assert.equal(
    evaluateToolCall(ffmpegOnly, 'run_command', { command: 'python -c "print(1)"' }).verdict,
    'deny'
  );
  assert.equal(
    evaluateToolCall(ffmpegOnly, 'run_command', { command: 'ffmpeg -y -i in.mp4 out.mp4' }).verdict,
    'allow'
  );
  assert.equal(
    evaluateToolCall(undefined, 'run_command', { command: 'ffmpeg -y -i in.mp4 out.mp4' }).verdict,
    'allow'
  );
  // Floor denies fire regardless of skill permissions
  assert.equal(
    evaluateToolCall(ffmpegOnly, 'run_command', { command: 'cat /proc/1/environ' }).verdict,
    'deny'
  );
  assert.equal(
    evaluateToolCall(undefined, 'run_command', { command: 'sed -i s/a/b/ hf-project/index.html' }).verdict,
    'deny'
  );

  // Credential-file floor (non-overridable, including path tools)
  const catAllowed = { allow: ['run_command(cat:*)'] };
  assert.equal(
    evaluateToolCall(catAllowed, 'run_command', { command: 'cat .env' }).verdict,
    'deny'
  );
  assert.equal(
    evaluateToolCall(undefined, 'run_command', { command: 'cat ~/.ssh/id_rsa' }).verdict,
    'deny'
  );
  assert.equal(
    evaluateToolCall(undefined, 'read_file', { path: 'gcp-service-account.json' }).verdict,
    'deny'
  );
  assert.equal(
    evaluateToolCall(undefined, 'write_file', { path: 'google-credentials.json' }).verdict,
    'deny'
  );
  assert.equal(
    evaluateToolCall(undefined, 'read_file', { path: 'src/agent.ts' }).verdict,
    'allow'
  );

  const result = await execCommand('env', { env });
  assert(result.success, result.stderr);
  const childKeys = result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(0, line.indexOf('=')));
  assert.equal(childKeys.some((key) => sensitiveName.test(key)), false);
  assert.equal(result.stdout.includes('must-not-leak'), false);

  delete process.env.CHECK_FAKE_SECRET_TOKEN;
  console.log('check-shell-env: OK');
}

void main();
