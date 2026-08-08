/**
 * Self-check: Gate 3 Batch timestamp parser + phrase normalization.
 * Run: npx tsx src/tools/lib/sarvamBatch.selfcheck.ts
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'path';
import { parseSarvamTimestamps } from './sarvamBatch.ts';

const fixturePath = path.join(
  __dirname,
  'transliteration/fixtures/sarvam-batch-2mp3-translit.json'
);

function main() {
  // Documented Batch shape (chunks).
  {
    const phrases = parseSarvamTimestamps({
      chunks: ['hello world', 'second'],
      start_time_seconds: [0.1, 1.5],
      end_time_seconds: [1.5, 2.0],
    });
    assert.equal(phrases.length, 2);
    assert.equal(phrases[0].text, 'hello world');
    assert.equal(phrases[0].start, 0.1);
    assert.equal(phrases[1].end, 2.0);
  }

  // Gate 3 live v4 shape (words = phrase arrays).
  {
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as {
      timestamps: unknown;
    };
    const phrases = parseSarvamTimestamps(raw.timestamps);
    assert.equal(phrases.length, 4);
    assert.ok(phrases[0].text.includes('Strong body'));
    assert.equal(phrases[0].start, 0.8);
    assert.equal(phrases[3].end, 53.73);
    // Prefer chunks when both exist.
    const both = parseSarvamTimestamps({
      chunks: ['from chunks'],
      words: ['from words'],
      start_time_seconds: [0],
      end_time_seconds: [1],
    });
    assert.equal(both[0].text, 'from chunks');
  }

  // Empty / missing → throw
  assert.throws(() => parseSarvamTimestamps(null));
  assert.throws(() =>
    parseSarvamTimestamps({ words: [], start_time_seconds: [], end_time_seconds: [] })
  );

  console.log('sarvamBatch.selfcheck: ok');
}

main();
