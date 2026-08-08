/**
 * Self-check: Sarvam phrase → Groq timestamp redistribution.
 * Run: npx tsx src/tools/lib/transliteration/mapSarvamToGroqTiming.selfcheck.ts
 *
 * Settled algorithm: duration_weight (even kept for comparison).
 * english_worded: no keep-native, skew>2 phrase-bound, expand multi-word, append fallbacks.
 */
import assert from 'node:assert';
import {
  assignTokensDurationWeight,
  assignTokensEven,
  expandMultiWordTokens,
  mapSarvamToGroqTiming,
  SKEW_RATIO_THRESHOLD,
} from './mapSarvamToGroqTiming.ts';

function hasKannada(s: string): boolean {
  return /[\u0C80-\u0CFF]/.test(s);
}

function main() {
  // Duration-weight: long first word gets more tokens.
  {
    const tokens = ['a', 'b', 'c', 'd', 'e', 'f'];
    const weighted = assignTokensDurationWeight(tokens, [3, 1]);
    assert.equal(weighted.length, 2);
    assert.ok(weighted[0].split(' ').length >= weighted[1].split(' ').length);
    const even = assignTokensEven(tokens, 2);
    assert.equal(even.join(' ').split(/\s+/).filter(Boolean).length, 6);
    assert.equal(weighted.join(' ').split(/\s+/).filter(Boolean).length, 6);
    assert.ok(
      weighted[0].split(/\s+/).length > even[0].split(/\s+/).length ||
        weighted[0].split(/\s+/).length >= 4
    );
  }

  // Groq timestamps preserved on 1:1; phrase text fully consumed; no spaces after expand.
  {
    const groq = [
      { word: 'ನಾ', start: 0, end: 1 },
      { word: 'ಮ', start: 1, end: 2 },
      { word: 'ಸ್ಕಾರ', start: 2, end: 3 },
    ];
    const phrases = [{ text: 'Strong body idre', start: 0, end: 3 }];
    const out = mapSarvamToGroqTiming(groq, phrases, 'duration_weight');
    assert.equal(out.words.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.equal(out.words[i].start, groq[i].start);
      assert.equal(out.words[i].end, groq[i].end);
    }
    const consumed = out.words.map((w) => w.word);
    assert.deepEqual(consumed, ['Strong', 'body', 'idre']);
    assert.ok(out.words.every((w) => !/\s/.test(w.word)));
    assert.equal(out.fallbackPhraseIndices.length, 0);
  }

  // Zero overlap → fallback index + append phrase-bound words; uncovered Groq dropped.
  {
    const groq = [
      { word: 'keep', start: 0, end: 1 },
      { word: 'me', start: 1, end: 2 },
    ];
    const phrases = [{ text: 'orphan phrase', start: 10, end: 12 }];
    const out = mapSarvamToGroqTiming(groq, phrases, 'duration_weight');
    assert.deepEqual(out.fallbackPhraseIndices, [0]);
    assert.deepEqual(
      out.words.map((w) => w.word),
      ['orphan', 'phrase']
    );
    assert.ok(out.words[0].start >= 10 && out.words[out.words.length - 1].end <= 12);
    assert.ok(!out.words.some((w) => w.word === 'keep' || w.word === 'me'));
  }

  // Multi-phrase + last inclusive end.
  {
    const groq = [
      { word: 'a', start: 0, end: 1 },
      { word: 'b', start: 1, end: 2 },
      { word: 'c', start: 2, end: 3 },
    ];
    const phrases = [
      { text: 'one two', start: 0, end: 2 },
      { text: 'three', start: 2, end: 3 },
    ];
    const out = mapSarvamToGroqTiming(groq, phrases, 'even');
    assert.equal(out.words[out.words.length - 1].word, 'three');
    assert.equal(out.words[out.words.length - 1].start, 2);
    assert.equal(out.words[out.words.length - 1].end, 3);
  }

  // Empty-slot under-token: fewer Sarvam tokens than members → drop empties, no native.
  {
    const groq = [
      { word: 'ಸ್ಟ್ರಾಂಗ್', start: 0, end: 1 },
      { word: 'ಬಾಡಿನ', start: 1, end: 2 },
      { word: 'native3', start: 2, end: 3 },
      { word: 'native4', start: 3, end: 4 },
    ];
    const phrases = [{ text: 'Strong body', start: 0, end: 4 }];
    const out = mapSarvamToGroqTiming(groq, phrases, 'duration_weight');
    assert.ok(out.words.every((w) => !hasKannada(w.word)));
    assert.ok(!out.words.some((w) => w.word === 'native3' || w.word === 'native4'));
    assert.deepEqual(
      out.words.map((w) => w.word),
      ['Strong', 'body']
    );
  }

  // Mild multi-word pack then expand → no spaces; sub-word times inside parent.
  {
    const expanded = expandMultiWordTokens([
      { word: 'one two three', start: 10, end: 16 },
    ]);
    assert.equal(expanded.length, 3);
    assert.ok(expanded.every((w) => !/\s/.test(w.word)));
    assert.equal(expanded[0].start, 10);
    assert.equal(expanded[2].end, 16);
    for (const w of expanded) {
      assert.ok(w.start >= 10 && w.end <= 16);
    }

    const groq = [
      { word: 'a', start: 0, end: 2 },
      { word: 'b', start: 2, end: 3 },
    ];
    // 3 tokens / 2 members = 1.5 ≤ threshold → pack then expand
    const phrases = [{ text: 'alpha beta gamma', start: 0, end: 3 }];
    assert.ok(3 / 2 <= SKEW_RATIO_THRESHOLD);
    const out = mapSarvamToGroqTiming(groq, phrases, 'duration_weight');
    assert.ok(out.words.every((w) => !/\s/.test(w.word)));
    assert.equal(out.words.map((w) => w.word).join(' '), 'alpha beta gamma');
  }

  // Skew >2 (44→6 style): phrase-bound even spacing, not 6 blobs.
  {
    const groq = Array.from({ length: 6 }, (_, i) => ({
      word: `g${i}`,
      start: i,
      end: i + 1,
    }));
    const tokens = Array.from({ length: 44 }, (_, i) => `t${i}`);
    const phrases = [{ text: tokens.join(' '), start: 0, end: 6 }];
    assert.ok(44 / 6 > SKEW_RATIO_THRESHOLD);
    const out = mapSarvamToGroqTiming(groq, phrases, 'duration_weight');
    assert.equal(out.words.length, 44);
    assert.ok(out.words.every((w) => !/\s/.test(w.word)));
    assert.equal(out.words[0].word, 't0');
    assert.equal(out.words[43].word, 't43');
    assert.ok(Math.abs(out.words[0].start - 0) < 1e-9);
    assert.ok(Math.abs(out.words[43].end - 6) < 1e-9);
  }

  // Uncovered early Groq word (mid before phrase start) → absent from output.
  {
    const groq = [
      { word: 'ಸ್ಟ್ರಾಂಗ್', start: 0, end: 1.12 }, // mid 0.56 < 0.8
      { word: 'a', start: 1, end: 2 },
      { word: 'b', start: 2, end: 3 },
    ];
    const phrases = [{ text: 'Strong body', start: 0.8, end: 3 }];
    const out = mapSarvamToGroqTiming(groq, phrases, 'duration_weight');
    assert.ok(!out.words.some((w) => hasKannada(w.word)));
    assert.ok(!out.words.some((w) => w.word === 'ಸ್ಟ್ರಾಂಗ್'));
    assert.deepEqual(
      out.words.map((w) => w.word),
      ['Strong', 'body']
    );
  }

  console.log('mapSarvamToGroqTiming.selfcheck: ok (duration_weight + english_worded guards)');
}

main();
