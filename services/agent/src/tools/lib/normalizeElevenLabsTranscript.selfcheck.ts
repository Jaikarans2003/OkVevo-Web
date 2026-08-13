/**
 * Normalize ElevenLabs → transcript contract + sanitize.
 * Run: npx tsx src/tools/lib/normalizeElevenLabsTranscript.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { normalizeElevenLabsTranscript, wordsToSegments } from './normalizeElevenLabsTranscript.ts';
import { sanitizeTranscriptWords } from './transcriptSanitize.ts';

function main() {
  const raw = {
    text: 'Hello world test',
    language_code: 'eng',
    words: [
      { text: 'Hello', start: 0.1, end: 0.4, type: 'word' },
      { text: ' ', start: 0.4, end: 0.45, type: 'spacing' },
      { text: 'world', start: 0.45, end: 0.8, type: 'word' },
      { text: ' ', start: 0.8, end: 0.85, type: 'spacing' },
      { text: 'test', start: 1.5, end: 1.9, type: 'word' },
      { text: '(laughs)', start: 2.0, end: 2.2, type: 'audio_event' },
    ],
    audio_duration_secs: 3,
  };

  const out = normalizeElevenLabsTranscript(raw, 0);
  assert.equal(out.language, 'eng');
  assert.equal(out.duration_seconds, 3.5);
  assert.equal(out.words.length, 3);
  assert.equal(out.words[0].word, 'Hello');
  assert.ok(out.segments.length >= 2); // pause gap between world and test
  assert.equal(out.segments[0].text, 'Hello world');

  const sanitized = sanitizeTranscriptWords(out.words, out.duration_seconds);
  assert.equal(sanitized.length, 3);
  assert.ok(sanitized[0].end >= sanitized[0].start);

  const empty = wordsToSegments([], 5);
  assert.deepEqual(empty, [{ start: 0, end: 5, text: '' }]);

  // Real Fal Scribe shape: ISO 639-3 language_code + spacing tokens.
  const kan = normalizeElevenLabsTranscript(
    {
      text: 'ನಮಸ್ಕಾರ ಗುರುಗಳೇ',
      language_code: 'kan',
      words: [
        { text: 'ನಮಸ್ಕಾರ', start: 0.1, end: 0.5, type: 'word' },
        { text: ' ', start: 0.5, end: 0.55, type: 'spacing' },
        { text: 'ಗುರುಗಳೇ', start: 0.55, end: 1.0, type: 'word' },
      ],
      language_probability: 0.99,
    },
    2
  );
  assert.equal(kan.language, 'kn');
  assert.equal(kan.words.length, 2);
  assert.equal(kan.segments[0]?.text, 'ನಮಸ್ಕಾರ ಗುರುಗಳೇ');

  // Extreme container padding → speech + pad (shared with stitch / scaffold).
  const padded = normalizeElevenLabsTranscript(
    {
      text: 'short',
      language_code: 'eng',
      words: [{ text: 'short', start: 0, end: 47, type: 'word' }],
      audio_duration_secs: 300,
    },
    300
  );
  assert.equal(padded.duration_seconds, 47.5);

  console.log('normalizeElevenLabsTranscript.selfcheck: ok');
}

main();
