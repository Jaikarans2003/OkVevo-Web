/**
 * Self-check: remux preserves duration (copy + faststart).
 * Run: npx tsx src/tools/lib/remuxMp4Faststart.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execCommand } from './utils';
import { remuxMp4Faststart } from './remuxMp4Faststart';

async function probeDuration(mediaPath: string): Promise<number> {
  const probe = await execCommand(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${mediaPath}"`,
    { timeoutSeconds: 60 }
  );
  assert.ok(probe.success, probe.stderr);
  const d = Number.parseFloat(probe.stdout.trim());
  assert.ok(Number.isFinite(d) && d > 0);
  return d;
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'okvevo-faststart-'));
  const src = path.join(dir, 'src.mp4');
  try {
    const gen = await execCommand(
      `ffmpeg -y -f lavfi -i color=c=black:s=320x240:d=1 -c:v libx264 -pix_fmt yuv420p "${src}"`,
      { timeoutSeconds: 60 }
    );
    assert.ok(gen.success, gen.stderr);
    const before = await probeDuration(src);
    await remuxMp4Faststart(src);
    const after = await probeDuration(src);
    assert.ok(Math.abs(before - after) < 0.05, `duration drifted ${before} → ${after}`);
    console.log('remuxMp4Faststart.selfcheck: ok');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

void main();
