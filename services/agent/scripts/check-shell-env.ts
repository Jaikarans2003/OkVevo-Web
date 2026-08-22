import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  commandAllowedBySkillPrefixes,
  referencesProcEnviron,
} from '../src/tools/general/filesystem';
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

  assert.equal(
    commandAllowedBySkillPrefixes('python -c "print(1)"', ['ffmpeg']),
    false
  );
  assert.equal(
    commandAllowedBySkillPrefixes('ffmpeg -y -i in.mp4 out.mp4', ['ffmpeg']),
    true
  );
  assert.equal(commandAllowedBySkillPrefixes('ffmpeg -y -i in.mp4 out.mp4', undefined), true);
  assert.equal(commandAllowedBySkillPrefixes('ffmpeg -y -i in.mp4 out.mp4', []), false);

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
