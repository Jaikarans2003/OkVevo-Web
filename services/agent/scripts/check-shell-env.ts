import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  commandAllowedBySkillPrefixes,
  referencesProcEnviron,
} from '../src/tools/general/filesystem';
import { commandTargetsOwnedEditFile } from '../src/tools/lib/ownedEditFiles';
import { execCommand, sanitizedShellEnv } from '../src/tools/lib/utils';
import { SKILL_COMMAND_PREFIXES } from '../src/tools/catalog';

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

  // Prefix policy (temporary key for the assert — do not leave in catalog)
  const prev = SKILL_COMMAND_PREFIXES['__check_shell_prefixes__'];
  SKILL_COMMAND_PREFIXES['__check_shell_prefixes__'] = ['ffmpeg'];
  assert.equal(
    commandAllowedBySkillPrefixes('python -c "print(1)"', '__check_shell_prefixes__'),
    false
  );
  assert.equal(
    commandAllowedBySkillPrefixes('ffmpeg -y -i in.mp4 out.mp4', '__check_shell_prefixes__'),
    true
  );
  if (prev === undefined) {
    delete SKILL_COMMAND_PREFIXES['__check_shell_prefixes__'];
  } else {
    SKILL_COMMAND_PREFIXES['__check_shell_prefixes__'] = prev;
  }

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
