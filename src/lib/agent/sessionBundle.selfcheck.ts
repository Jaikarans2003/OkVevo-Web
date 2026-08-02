/**
 * Assert session bundle path helpers + zipDirectory + export token TTL.
 * Run: npx tsx src/lib/agent/sessionBundle.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import {
  EXPORT_TOKEN_TTL_MS,
  isExportTokenFresh,
  s3RenderPrefix,
  sessionStoragePrefix,
  sessionUploadPrefix,
  validatePurgeRequest,
  zipDirectory,
} from './sessionBundle.ts';

assert.equal(
  sessionStoragePrefix('u1', 's1'),
  'users/u1/sessions/s1/'
);
assert.equal(sessionUploadPrefix('u1', 's1'), 'uploads/u1/s1/');

const now = Date.now();
assert.equal(isExportTokenFresh(Timestamp.fromMillis(now), now), true);
assert.equal(
  isExportTokenFresh(Timestamp.fromMillis(now - EXPORT_TOKEN_TTL_MS + 1000), now),
  true
);
assert.equal(
  isExportTokenFresh(Timestamp.fromMillis(now - EXPORT_TOKEN_TTL_MS - 1), now),
  false
);
assert.equal(isExportTokenFresh(null, now), false);

assert.equal(s3RenderPrefix('u1', 's1'), 'renders/users/u1/sessions/s1/');
assert.equal(
  validatePurgeRequest({ confirm: true, exportToken: 'abc' }, { exportToken: 'abc', exportTokenAt: Timestamp.fromMillis(now) }),
  null
);
assert.ok(
  validatePurgeRequest({ confirm: false, exportToken: 'abc' }, { exportToken: 'abc', exportTokenAt: Timestamp.fromMillis(now) })
);
assert.ok(
  validatePurgeRequest({ confirm: true, exportToken: 'nope' }, { exportToken: 'abc', exportTokenAt: Timestamp.fromMillis(now) })
);
assert.ok(
  validatePurgeRequest(
    { confirm: true, exportToken: 'abc' },
    { exportToken: 'abc', exportTokenAt: Timestamp.fromMillis(now - EXPORT_TOKEN_TTL_MS - 1) }
  )
);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'okvevo-zip-selfcheck-'));
const staging = path.join(root, 'bundle');
fs.mkdirSync(path.join(staging, 'firestore-export'), { recursive: true });
fs.writeFileSync(
  path.join(staging, 'firestore-export', 'session.json'),
  JSON.stringify({ id: 's1' })
);
fs.mkdirSync(path.join(staging, 'storage', 'users', 'u1', 'sessions', 's1'), {
  recursive: true,
});
fs.writeFileSync(
  path.join(staging, 'storage', 'users', 'u1', 'sessions', 's1', 'note.txt'),
  'hello'
);
const zipPath = path.join(root, 'out.zip');
await zipDirectory(staging, zipPath);
assert.ok(fs.existsSync(zipPath));
assert.ok(fs.statSync(zipPath).size > 0);

// Spot-check zip contents via python
const { execFileSync } = await import('node:child_process');
const names = execFileSync(
  'python3',
  ['-c', 'import zipfile,sys; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zipPath],
  { encoding: 'utf8' }
);
assert.ok(names.includes('firestore-export/session.json'));
assert.ok(names.includes('storage/users/u1/sessions/s1/note.txt'));

fs.rmSync(root, { recursive: true, force: true });
console.log('sessionBundle.selfcheck: ok');
