/**
 * Offline guards for transliterate_captions Ask/auto/idempotency + concepts refuse.
 * Run: npx tsx src/tools/pipeline/transliterateCaptions.selfcheck.ts
 *
 * Exercises pure decision helpers via lightweight stubs — no Firebase / Sarvam.
 */
import assert from 'node:assert';
import {
  isSarvamSupportedLanguage,
  normalizeLanguageCode,
} from '../lib/transliteration/transliterateWords.ts';

/** Mirrors tool auto-guard + idempotency + concepts refuse rules. */
function decideTransliterateCaptions(opts: {
  pipelineMode: 'ask' | 'auto';
  captionMode?: 'native' | 'english_worded';
  captionModeApplied: boolean;
  language?: string;
}): 'noop_auto' | 'noop_applied' | 'ask' | 'apply_native' | 'apply_english' | 'force_native' {
  if (opts.pipelineMode !== 'ask') return 'noop_auto';
  if (opts.captionMode && opts.captionModeApplied) return 'noop_applied';
  if (!isSarvamSupportedLanguage(normalizeLanguageCode(opts.language))) {
    return 'force_native';
  }
  if (!opts.captionMode) return 'ask';
  return opts.captionMode === 'native' ? 'apply_native' : 'apply_english';
}

function conceptsShouldRefuse(opts: {
  captionMode?: 'native' | 'english_worded';
  captionModeApplied: boolean;
}): boolean {
  return Boolean(opts.captionMode) && !opts.captionModeApplied;
}

function main() {
  assert.equal(
    decideTransliterateCaptions({
      pipelineMode: 'auto',
      captionModeApplied: false,
      language: 'kn',
    }),
    'noop_auto'
  );
  assert.equal(
    decideTransliterateCaptions({
      pipelineMode: 'ask',
      captionMode: 'english_worded',
      captionModeApplied: true,
      language: 'kn',
    }),
    'noop_applied'
  );
  assert.equal(
    decideTransliterateCaptions({
      pipelineMode: 'ask',
      captionModeApplied: false,
      language: 'hi',
    }),
    'ask'
  );
  assert.equal(
    decideTransliterateCaptions({
      pipelineMode: 'ask',
      captionModeApplied: false,
      language: 'ta',
    }),
    'ask'
  );
  assert.equal(
    decideTransliterateCaptions({
      pipelineMode: 'ask',
      captionMode: 'native',
      captionModeApplied: false,
      language: 'kn',
    }),
    'apply_native'
  );
  assert.equal(
    decideTransliterateCaptions({
      pipelineMode: 'ask',
      captionMode: 'english_worded',
      captionModeApplied: false,
      language: 'kn',
    }),
    'apply_english'
  );
  // Auto-detect can pin Whisper-only languages (e.g. ja) → skip English Worded.
  assert.equal(
    decideTransliterateCaptions({
      pipelineMode: 'ask',
      captionModeApplied: false,
      language: 'ja',
    }),
    'force_native'
  );

  assert.equal(
    conceptsShouldRefuse({ captionMode: 'english_worded', captionModeApplied: false }),
    true
  );
  assert.equal(
    conceptsShouldRefuse({ captionMode: 'english_worded', captionModeApplied: true }),
    false
  );
  assert.equal(conceptsShouldRefuse({ captionModeApplied: false }), false);

  console.log('transliterateCaptions.selfcheck: ok');
}

main();
