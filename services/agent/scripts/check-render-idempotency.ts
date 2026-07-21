import 'dotenv/config';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RENDER_ZIP_DIRECT_CAP_BYTES,
  RENDER_ZIP_URL_CAP_BYTES,
  renderIdempotencyKey,
  renderIngestMode,
  zipHyperframesProject,
} from '../src/tools/pipeline/hyperframes';

const sessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

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
    await withTempProject(baseFiles, async (dirB) => {
      // Write files in a different order into a third tree to prove path-sort determinism.
      const dirC = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-idem-'));
      try {
        for (const rel of Object.keys(baseFiles).reverse()) {
          const abs = path.join(dirC, rel);
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, baseFiles[rel as keyof typeof baseFiles]);
        }

        const keyA = renderIdempotencyKey(sessionId, dirA);
        const keyB = renderIdempotencyKey(sessionId, dirB);
        const keyC = renderIdempotencyKey(sessionId, dirC);

        assert.equal(keyA, keyB, 'identical project bytes must produce the same key');
        assert.equal(keyA, keyC, 'key must be independent of file creation order');

        assert.match(keyA, /^[A-Za-z0-9_:.-]+$/, 'key must satisfy HeyGen charset');
        assert.equal(keyA, `${sessionId}.${keyA.split('.')[1]}`, 'key is sessionId.hash');
        assert.equal(keyA.split('.')[1].length, 16, 'hash suffix is 16 hex chars');
        assert.ok(keyA.length <= 255, 'key must be under 255 chars');

        assert.notEqual(
          renderIdempotencyKey('other-session', dirA),
          keyA,
          'different sessions must not collide'
        );

        const zipPath = path.join(os.tmpdir(), `hf-idem-zip-${process.pid}.zip`);
        try {
          await zipHyperframesProject(dirA, zipPath);
          const names = zipEntryNames(zipPath);
          assert.ok(names.includes('index.html'), 'archive must have index.html at root');
          assert.ok(
            names.includes('assets/manim-0.mp4'),
            'archive must include nested assets with POSIX paths'
          );
          assert.ok(fs.statSync(zipPath).size <= RENDER_ZIP_URL_CAP_BYTES);
          assert.equal(renderIngestMode(fs.statSync(zipPath).size), 'url');
        } finally {
          fs.rmSync(zipPath, { force: true });
        }

        const fingerprint = keyA.split('.')[1];
        const storageRel = `render-projects/${fingerprint}.zip`;
        fs.writeFileSync(path.join(dirA, 'assets', 'manim-0.mp4'), 'video-bytes-CHANGED');
        const keyChanged = renderIdempotencyKey(sessionId, dirA);
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
        fs.rmSync(dirC, { recursive: true, force: true });
      }
    });
  });

  await withTempProject(baseFiles, (dir) => {
    const before = renderIdempotencyKey(sessionId, dir);
    fs.writeFileSync(path.join(dir, 'assets', 'manim-0.mp4'), 'video-bytes-CHANGED');
    assert.notEqual(
      renderIdempotencyKey(sessionId, dir),
      before,
      'changing only assets/manim-0.mp4 must produce a new key'
    );
  });

  await withTempProject(baseFiles, (dir) => {
    const before = renderIdempotencyKey(sessionId, dir);
    fs.writeFileSync(
      path.join(dir, 'compositions', 'captions-overlay.html'),
      '<div>captions-CHANGED</div>'
    );
    assert.notEqual(
      renderIdempotencyKey(sessionId, dir),
      before,
      'changing only captions must produce a new key'
    );
  });

  await withTempProject(baseFiles, (dir) => {
    const before = renderIdempotencyKey(sessionId, dir);
    fs.writeFileSync(
      path.join(dir, 'compositions', 'sections', 'section-0.html'),
      '<section>CHANGED</section>'
    );
    assert.notEqual(
      renderIdempotencyKey(sessionId, dir),
      before,
      'changing only section HTML must produce a new key'
    );
  });

  await withTempProject(baseFiles, (dir) => {
    const before = renderIdempotencyKey(sessionId, dir);
    fs.writeFileSync(
      path.join(dir, 'COMPOSITION_MANIFEST.json'),
      JSON.stringify({ generated_at: '2099-12-31T23:59:59.999Z' })
    );
    assert.equal(
      renderIdempotencyKey(sessionId, dir),
      before,
      'changing only COMPOSITION_MANIFEST.json.generated_at must not change the key'
    );
  });

  console.log('check-render-idempotency: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
