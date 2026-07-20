// Self-check: ensureSessionArtifacts skips when present, restores when missing.
// Run: npm run check-session-artifacts (from services/agent)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureSessionArtifacts,
  sessionArtifactPresent,
} from '../src/tools/lib/utils';

async function main() {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'okvevo-ensure-'));
  const calls: string[] = [];

  try {
    // Skip when local marker exists
    fs.writeFileSync(path.join(workdir, 'transcript.json'), '{"text":"hi","words":[]}');
    assert.equal(sessionArtifactPresent(workdir, 'transcript'), true);

    const present = await ensureSessionArtifacts('u', 's', ['transcript'], {
      workdir,
      getAssetUrl: async () => {
        calls.push('getAssetUrl');
        return 'https://example.com/transcript.json';
      },
      downloadFile: async () => {
        calls.push('downloadFile');
      },
      downloadStoragePrefixToDir: async () => {
        calls.push('downloadPrefix');
      },
      parseStoragePathFromPublicUrl: (url) => url,
    });
    assert.equal(present.transcript, 'present');
    assert.deepEqual(calls, []);

    // Missing → attempts Storage download path
    fs.unlinkSync(path.join(workdir, 'transcript.json'));
    assert.equal(sessionArtifactPresent(workdir, 'transcript'), false);

    const restored = await ensureSessionArtifacts('u', 's', ['transcript'], {
      workdir,
      getAssetUrl: async (_uid, _sid, key) => {
        calls.push(`getAssetUrl:${key}`);
        return 'https://example.com/users/u/sessions/s/transcript.json';
      },
      downloadFile: async (_url, dest) => {
        calls.push(`downloadFile:${path.basename(dest)}`);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, '{"text":"restored","words":[]}');
      },
      downloadStoragePrefixToDir: async () => {
        calls.push('downloadPrefix');
      },
      parseStoragePathFromPublicUrl: (url) =>
        url.replace('https://example.com/', ''),
    });
    assert.equal(restored.transcript, 'restored');
    assert.deepEqual(calls, [
      'getAssetUrl:transcript',
      'downloadFile:transcript.json',
    ]);
    assert.equal(sessionArtifactPresent(workdir, 'transcript'), true);

    // Unavailable when no Storage pointer
    calls.length = 0;
    fs.unlinkSync(path.join(workdir, 'transcript.json'));
    const unavailable = await ensureSessionArtifacts('u', 's', ['transcript'], {
      workdir,
      getAssetUrl: async () => {
        calls.push('getAssetUrl');
        return null;
      },
      downloadFile: async () => {
        calls.push('downloadFile');
      },
      downloadStoragePrefixToDir: async () => {
        calls.push('downloadPrefix');
      },
      parseStoragePathFromPublicUrl: (url) => url,
    });
    assert.equal(unavailable.transcript, 'unavailable');
    assert.deepEqual(calls, ['getAssetUrl']);

    // manim_scripts: missing → prefix download
    calls.length = 0;
    const manim = await ensureSessionArtifacts('u', 's', ['manim_scripts'], {
      workdir,
      getAssetUrl: async () => null,
      downloadFile: async () => {
        calls.push('downloadFile');
      },
      downloadStoragePrefixToDir: async (prefix, dest) => {
        calls.push(`downloadPrefix:${prefix}`);
        fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(path.join(dest, 'SceneFoo.py'), 'from manim import *\n');
      },
      parseStoragePathFromPublicUrl: (url) => url,
    });
    assert.equal(manim.manim_scripts, 'restored');
    assert.deepEqual(calls, [
      'downloadPrefix:users/u/sessions/s/manim_scripts',
    ]);

    // concepts: missing → file download via asset key
    calls.length = 0;
    const concepts = await ensureSessionArtifacts('u', 's', ['concepts'], {
      workdir,
      getAssetUrl: async (_uid, _sid, key) => {
        calls.push(`getAssetUrl:${key}`);
        return 'https://example.com/users/u/sessions/s/concepts.json';
      },
      downloadFile: async (_url, dest) => {
        calls.push(`downloadFile:${path.basename(dest)}`);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, '[{"concept_name":"X","explanation":"Y"}]');
      },
      downloadStoragePrefixToDir: async () => {
        calls.push('downloadPrefix');
      },
      parseStoragePathFromPublicUrl: (url) =>
        url.replace('https://example.com/', ''),
    });
    assert.equal(concepts.concepts, 'restored');
    assert.deepEqual(calls, [
      'getAssetUrl:concepts',
      'downloadFile:concepts.json',
    ]);
    assert.equal(sessionArtifactPresent(workdir, 'concepts'), true);

    console.log('check-session-artifacts: ok');
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
