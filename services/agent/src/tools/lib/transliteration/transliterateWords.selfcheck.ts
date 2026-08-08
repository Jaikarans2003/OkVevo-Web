/**
 * Self-check: Sarvam allowlist gate + abbrev override.
 * Run: npx tsx src/tools/lib/transliteration/transliterateWords.selfcheck.ts
 */
import assert from 'node:assert';
import {
  isSarvamSupportedLanguage,
  normalizeLanguageCode,
  transliterateWords,
} from './transliterateWords.ts';

async function main() {
  assert.ok(isSarvamSupportedLanguage(normalizeLanguageCode('kn')));
  assert.ok(isSarvamSupportedLanguage(normalizeLanguageCode('kn-IN')));
  assert.ok(isSarvamSupportedLanguage(normalizeLanguageCode('Kannada')));
  assert.ok(isSarvamSupportedLanguage(normalizeLanguageCode('hi')));
  assert.ok(isSarvamSupportedLanguage(normalizeLanguageCode('ta')));
  assert.equal(isSarvamSupportedLanguage(normalizeLanguageCode('ja')), false);

  // Abbreviation override wins over Sarvam-mapped text.
  {
    const out = await transliterateWords(
      {
        language: 'kn',
        audioPath: '/dev/null',
        words: [{ word: 'ಬಿಪಿ', start: 0, end: 0.5 }],
        segments: [{ start: 0, end: 1, text: 'ಬಿಪಿ' }],
        text: 'ಬಿಪಿ',
      },
      {
        loadDictionary: async () => ({ ಬಿಪಿ: 'BP' }),
        runSarvam: async () => [{ text: 'WRONG', start: 0, end: 1 }],
      }
    );
    assert.equal(out.words[0].word, 'BP');
    assert.equal(out.words[0].start, 0);
    assert.equal(out.words[0].end, 0.5);
  }

  // Sarvam phrase redistributed; Groq times kept; segment text rebuilt.
  {
    const out = await transliterateWords(
      {
        language: 'kn',
        audioPath: '/dev/null',
        words: [
          { word: 'ಆ', start: 0, end: 1 },
          { word: 'ಬಿ', start: 1, end: 2 },
        ],
        segments: [{ start: 0, end: 2, text: 'ಆ ಬಿ' }],
        text: 'ಆ ಬಿ',
      },
      {
        loadDictionary: async () => ({}),
        runSarvam: async () => [{ text: 'Strong body', start: 0, end: 2 }],
      }
    );
    assert.equal(out.words.map((w) => w.word).join(' '), 'Strong body');
    assert.equal(out.segments[0].text, 'Strong body');
    assert.equal(out.words[0].start, 0);
    assert.equal(out.words[1].end, 2);
  }

  // Zero-overlap phrase → fallback index; native kept.
  {
    const out = await transliterateWords(
      {
        language: 'kn',
        audioPath: '/dev/null',
        words: [{ word: 'ನಾನು', start: 0, end: 1 }],
        segments: [{ start: 0, end: 1, text: 'ನಾನು' }],
        text: 'ನಾನು',
      },
      {
        loadDictionary: async () => ({}),
        runSarvam: async () => [{ text: 'ghost', start: 9, end: 10 }],
      }
    );
    assert.equal(out.words[0].word, 'ನಾನು');
    assert.deepEqual(out.transliterationFallbacks, [0]);
  }

  // Hindi (Sarvam-supported) runs Sarvam path.
  {
    let called = 0;
    const out = await transliterateWords(
      {
        language: 'hi',
        audioPath: '/dev/null',
        words: [{ word: 'नमस्ते', start: 0, end: 1 }],
        segments: [{ start: 0, end: 1, text: 'नमस्ते' }],
        text: 'नमस्ते',
      },
      {
        loadDictionary: async () => ({}),
        runSarvam: async () => {
          called++;
          return [{ text: 'namaste', start: 0, end: 1 }];
        },
      }
    );
    assert.equal(called, 1);
    assert.equal(out.words[0].word, 'namaste');
  }

  // Unsupported language (e.g. ja via Auto-detect pin) → passthrough, no Sarvam.
  {
    let called = 0;
    const out = await transliterateWords(
      {
        language: 'ja',
        audioPath: '/dev/null',
        words: [{ word: 'こんにちは', start: 0, end: 1 }],
        segments: [{ start: 0, end: 1, text: 'こんにちは' }],
        text: 'こんにちは',
      },
      {
        runSarvam: async () => {
          called++;
          return [];
        },
      }
    );
    assert.equal(called, 0);
    assert.equal(out.words[0].word, 'こんにちは');
  }

  console.log('transliterateWords.selfcheck: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
