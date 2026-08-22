/**
 * Run: npx tsx services/agent/src/tools/lib/hfProjectSync.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  hfProjectObjectPath,
  isHfProjectPath,
  runHfProjectPrefix,
  stampFromStoragePrefix,
  syncHfProjectFileAfterEdit,
  writeScaffoldRunStamp,
} from './hfProjectSync.ts';

assert.ok(isHfProjectPath('/tmp/okvevo/s/hf-project/index.html'));
assert.ok(isHfProjectPath('/tmp/okvevo/s/hf-project/compositions/captions-overlay.html'));
assert.equal(isHfProjectPath('/tmp/okvevo/s/manim_scripts/Foo.py'), false);

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-sync-'));
const projectDir = path.join(workdir, 'hf-project');
const filePath = path.join(projectDir, 'compositions', 'captions-overlay.html');
fs.mkdirSync(path.dirname(filePath), { recursive: true });
fs.writeFileSync(filePath, '<div>edited</div>\n', 'utf-8');

const expectedStorage =
  'users/u1/sessions/s1/hf-project/compositions/captions-overlay.html';
assert.equal(
  hfProjectObjectPath('u1', 's1', filePath, workdir),
  expectedStorage
);

const stampedWorkdir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-sync-run-'));
const stampedProject = path.join(stampedWorkdir, 'hf-project');
const stampedFile = path.join(stampedProject, 'index.html');
fs.mkdirSync(stampedProject, { recursive: true });
fs.writeFileSync(stampedFile, '<html></html>\n', 'utf-8');
writeScaffoldRunStamp(stampedWorkdir, { skillId: 'talking-head', runId: 'abcd1234' });
assert.equal(
  hfProjectObjectPath('u1', 's1', stampedFile, stampedWorkdir),
  'users/u1/sessions/s1/runs/talking-head-abcd1234/hf-project/index.html'
);
stampFromStoragePrefix(
  stampedWorkdir,
  runHfProjectPrefix('u1', 's1', 'edu-video', 'deadbeef')
);
assert.equal(
  hfProjectObjectPath('u1', 's1', stampedFile, stampedWorkdir),
  'users/u1/sessions/s1/runs/edu-video-deadbeef/hf-project/index.html'
);
fs.rmSync(stampedWorkdir, { recursive: true, force: true });

void (async () => {
  const uploads: Array<{ local: string; storage: string }> = [];
  const sync = await syncHfProjectFileAfterEdit(
    'u1',
    's1',
    filePath,
    async (local, storage) => {
      uploads.push({ local, storage });
      return `https://example.com/${storage}`;
    },
    workdir
  );
  assert.ok(sync);
  assert.equal(sync!.storagePath, expectedStorage);
  assert.equal(sync!.warning, undefined);
  assert.deepEqual(uploads, [{ local: filePath, storage: expectedStorage }]);
  assert.ok(fs.existsSync(filePath), 'local file kept after keep-local upload');

  // Simulate cold restore: wipe local dir, "restore" from GCS fixture that has the edit
  fs.rmSync(projectDir, { recursive: true, force: true });
  assert.equal(fs.existsSync(filePath), false);
  const gcsFixture: Record<string, string> = {
    [expectedStorage]: '<div>edited</div>\n',
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, gcsFixture[expectedStorage], 'utf-8');
  assert.equal(
    fs.readFileSync(filePath, 'utf-8'),
    '<div>edited</div>\n',
    'restore carries the edit, not scaffold'
  );

  fs.rmSync(workdir, { recursive: true, force: true });
  console.log('hfProjectSync.selfcheck: ok');
})();
