import 'dotenv/config';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RENDER_ZIP_DIRECT_CAP_BYTES,
  RENDER_ZIP_URL_CAP_BYTES,
  renderIdempotencyKeyFromZip,
  renderIngestMode,
  zipHyperframesProject,
} from '../src/tools/pipeline/hyperframes';

const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const HEYGEN_KEY_CHARSET = /^[A-Za-z0-9_:.-]+$/;

function writeProject(root: string, files: Record<string, string | Buffer>): void {
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
}

async function withTempProject(
  files: Record<string, string | Buffer>,
  fn: (dir: string) => void | Promise<void>
): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-idem-'));
  try {
    writeProject(dir, files);
    await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function zipEntryNames(zipPath: string): string[] {
  const out = execFileSync(
    'python3',
    [
      '-c',
      'import sys, zipfile; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))',
      zipPath,
    ],
    { encoding: 'utf8' }
  );
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function keyFromProject(session: string, projectDir: string): Promise<string> {
  const zipPath = path.join(os.tmpdir(), `hf-idem-zip-${process.pid}-${Math.random().toString(36).slice(2)}.zip`);
  try {
    await zipHyperframesProject(projectDir, zipPath);
    return renderIdempotencyKeyFromZip(session, zipPath);
  } finally {
    fs.rmSync(zipPath, { force: true });
  }
}

const baseFiles = {
  'index.html': '<html>v1</html>',
  'assets/manim-0.mp4': 'video-bytes-v1',
  'compositions/captions-overlay.html': '<div>captions-v1</div>',
  'compositions/sections/section-0.html': '<section>s0</section>',
  'COMPOSITION_MANIFEST.json': JSON.stringify({ generated_at: '2026-01-01T00:00:00.000Z' }),
};

async function main(): Promise<void> {
  assert.equal(RENDER_ZIP_URL_CAP_BYTES, 32 * 1024 * 1024, 'URL_CAP locked at 32 MiB');
  assert.equal(RENDER_ZIP_DIRECT_CAP_BYTES, 200 * 1024 * 1024, 'DIRECT_CAP locked at 200 MiB');
  assert.equal(renderIngestMode(0), 'url');
  assert.equal(renderIngestMode(RENDER_ZIP_URL_CAP_BYTES), 'url');
  assert.equal(renderIngestMode(RENDER_ZIP_URL_CAP_BYTES + 1), 'asset_id');
  assert.equal(renderIngestMode(RENDER_ZIP_DIRECT_CAP_BYTES), 'asset_id');
  assert.throws(
    () => renderIngestMode(RENDER_ZIP_DIRECT_CAP_BYTES + 1),
    /NON_RETRYABLE/,
    'over Direct cap must fail closed'
  );

  await withTempProject(baseFiles, async (dirA) => {
    const zipA = path.join(os.tmpdir(), `hf-idem-a-${process.pid}.zip`);
    const zipB = path.join(os.tmpdir(), `hf-idem-b-${process.pid}.zip`);
    try {
      // Identical zip bytes (zip twice from same tree) → same key.
      await zipHyperframesProject(dirA, zipA);
      await zipHyperframesProject(dirA, zipB);
      const keyA = renderIdempotencyKeyFromZip(sessionId, zipA);
      const keyB = renderIdempotencyKeyFromZip(sessionId, zipB);
      assert.equal(keyA, keyB, 'identical zip bytes must produce the same key');

      assert.match(keyA, HEYGEN_KEY_CHARSET, 'key must satisfy HeyGen charset');
      assert.equal(keyA, `${sessionId}.${keyA.split('.')[1]}`, 'key is sessionId.hash');
      assert.equal(keyA.split('.')[1].length, 16, 'hash suffix is 16 hex chars');
      assert.ok(keyA.length <= 255, 'key must be under 255 chars');

      const retryKey = `${keyA}.r1`;
      assert.match(retryKey, HEYGEN_KEY_CHARSET, '.r1 retry suffix must stay charset-legal');
      assert.ok(retryKey.length <= 255, '.r1 key must be under 255 chars');

      assert.notEqual(
        renderIdempotencyKeyFromZip('other-session', zipA),
        keyA,
        'different sessions must not collide'
      );

      const names = zipEntryNames(zipA);
      assert.ok(names.includes('index.html'), 'archive must have index.html at root');
      assert.ok(
        names.includes('assets/manim-0.mp4'),
        'archive must include nested assets with POSIX paths'
      );
      assert.ok(fs.statSync(zipA).size <= RENDER_ZIP_URL_CAP_BYTES);
      assert.equal(renderIngestMode(fs.statSync(zipA).size), 'url');

      const fingerprint = keyA.split('.')[1];
      const storageRel = `render-projects/${fingerprint}.zip`;
      fs.writeFileSync(path.join(dirA, 'assets', 'manim-0.mp4'), 'video-bytes-CHANGED');
      const keyChanged = await keyFromProject(sessionId, dirA);
      assert.notEqual(
        keyChanged.split('.')[1],
        fingerprint,
        'content change must move fingerprint path'
      );
      assert.notEqual(
        `render-projects/${keyChanged.split('.')[1]}.zip`,
        storageRel,
        'Firebase zip path must change with content fingerprint'
      );
    } finally {
      fs.rmSync(zipA, { force: true });
      fs.rmSync(zipB, { force: true });
    }
  });

  await withTempProject(baseFiles, async (dir) => {
    const before = await keyFromProject(sessionId, dir);
    fs.writeFileSync(path.join(dir, 'assets', 'manim-0.mp4'), 'video-bytes-CHANGED');
    assert.notEqual(
      await keyFromProject(sessionId, dir),
      before,
      'changing only assets/manim-0.mp4 must produce a new key'
    );
  });

  await withTempProject(baseFiles, async (dir) => {
    const before = await keyFromProject(sessionId, dir);
    fs.writeFileSync(
      path.join(dir, 'compositions', 'captions-overlay.html'),
      '<div>captions-CHANGED</div>'
    );
    assert.notEqual(
      await keyFromProject(sessionId, dir),
      before,
      'changing only captions must produce a new key'
    );
  });

  await withTempProject(baseFiles, async (dir) => {
    const before = await keyFromProject(sessionId, dir);
    fs.writeFileSync(
      path.join(dir, 'compositions', 'sections', 'section-0.html'),
      '<section>CHANGED</section>'
    );
    assert.notEqual(
      await keyFromProject(sessionId, dir),
      before,
      'changing only section HTML must produce a new key'
    );
  });

  // Manifest generated_at is in the zip → must move the key (fixes stale SignatureDoesNotMatch).
  await withTempProject(baseFiles, async (dir) => {
    const before = await keyFromProject(sessionId, dir);
    fs.writeFileSync(
      path.join(dir, 'COMPOSITION_MANIFEST.json'),
      JSON.stringify({ generated_at: '2099-12-31T23:59:59.999Z' })
    );
    assert.notEqual(
      await keyFromProject(sessionId, dir),
      before,
      'manifest generated_at delta that alters zip must produce a new key'
    );
  });

  console.log('check-render-idempotency: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
