/**
 * Self-check: Unicode normalizeTokens + language persist through loadSessionTranscript.
 * Run: npx tsx src/tools/lib/normalizeTokens.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  groupCaptionWords,
  loadSessionTranscript,
  normalizeTokens,
  snapToWords,
} from './utils.ts';

// ── FIX 2: English regression (byte-identical to pre-/gu ASCII \w behavior) ──
const ENGLISH_CASES: [string, string[]][] = [
  ["Hello, world's test!", ['hello', 'world', 's', 'test']],
  ["don't it's", ['don', 't', 'it', 's']],
  ['Q2 2026 results', ['q2', '2026', 'results']],
  ['state-of-the-art', ['state', 'of', 'the', 'art']],
  ['(parenthetical) — aside', ['parenthetical', 'aside']],
];

for (const [input, expected] of ENGLISH_CASES) {
  assert.deepEqual(normalizeTokens(input), expected, `english: ${input}`);
}

// ── FIX 2: Kannada tokens + snap ──
const kn = 'ಪಾಠ';
assert.ok(normalizeTokens(kn).length > 0, 'kannada tokens non-empty');
assert.deepEqual(normalizeTokens(kn), [kn.toLowerCase()]);
const knSnap = snapToWords(kn, [{ word: kn, start: 1, end: 2 }], 10);
assert.equal(knSnap.matched, true, 'kannada snap matched');

// ── FIX 2: second script (Devanagari) ──
const hi = 'पाठ';
assert.ok(normalizeTokens(hi).length > 0, 'devanagari tokens non-empty');
assert.equal(
  snapToWords(hi, [{ word: hi, start: 0.5, end: 1.2 }], 5).matched,
  true,
  'devanagari snap matched'
);

// ── FIX 1: language round-trips through session transcript.json ──
const sessionId = `selfcheck_lang_${Date.now()}`;
const workdir = path.join(os.tmpdir(), 'okvevo', sessionId);
fs.mkdirSync(workdir, { recursive: true });
fs.writeFileSync(
  path.join(workdir, 'transcript.json'),
  JSON.stringify({
    text: 'hello',
    words: [{ word: 'hello', start: 0, end: 0.5 }],
    duration_seconds: 1,
    language: 'English',
  })
);
const loaded = loadSessionTranscript(sessionId);
assert.ok(loaded, 'transcript loads');
assert.equal(loaded!.language, 'English', 'language persisted');
assert.equal(loaded!.text, 'hello');
assert.equal(loaded!.words.length, 1);
fs.rmSync(workdir, { recursive: true, force: true });

// ── FIX 3 audit: captions copy word text unchanged (incl. Kannada) ──
const groups = groupCaptionWords([
  { word: kn, start: 0, end: 0.4 },
  { word: 'ok', start: 0.5, end: 0.8 },
]);
assert.equal(groups[0]?.words[0]?.text, kn, 'CAPTIONS_JSON preserves Kannada');
assert.equal('ಕನ್ನಡ'.toUpperCase(), 'ಕನ್ನಡ', 'toUpperCase no-op for Kannada');

console.log('normalizeTokens.selfcheck: ok');
