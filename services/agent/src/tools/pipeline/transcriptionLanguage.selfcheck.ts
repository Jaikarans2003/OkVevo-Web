/**
 * Self-check: language pin seeding + resume discrimination.
 * Run: npx tsx src/tools/pipeline/transcriptionLanguage.selfcheck.ts
 */
import assert from 'node:assert';
import { languageForDetectRepass } from '../lib/forceLanguageRepass.ts';
import {
  classifyTranscriptionResumeChoice,
  pinnedLanguageFromRequest,
} from '../lib/transcriptionLanguage.ts';

function main() {
  // Specific intersection pick → seed pin (skip two-pass).
  assert.equal(pinnedLanguageFromRequest('hi'), 'hi');
  assert.equal(pinnedLanguageFromRequest('kn-IN'), 'kn');
  assert.equal(pinnedLanguageFromRequest('auto'), undefined);
  assert.equal(pinnedLanguageFromRequest(undefined), undefined);
  // Existing pin wins over a new request.
  assert.equal(pinnedLanguageFromRequest('hi', 'ta'), 'ta');

  // auto / unset → two-pass helper still used when detect returns non-en.
  assert.equal(
    languageForDetectRepass({
      firstCallHadLanguage: Boolean(pinnedLanguageFromRequest('auto')),
      detectedLanguage: 'kn',
    }),
    'kn'
  );
  assert.equal(
    languageForDetectRepass({
      firstCallHadLanguage: Boolean(pinnedLanguageFromRequest('hi')),
      detectedLanguage: 'kn',
    }),
    undefined
  );

  // Resume discrimination: language vs chunk-fail vs caption-style.
  assert.equal(classifyTranscriptionResumeChoice('auto'), 'language');
  assert.equal(classifyTranscriptionResumeChoice('hi'), 'language');
  assert.equal(classifyTranscriptionResumeChoice('en'), 'language');
  assert.equal(classifyTranscriptionResumeChoice('retry'), 'chunk_fail');
  assert.equal(classifyTranscriptionResumeChoice('continue'), 'chunk_fail');
  assert.equal(classifyTranscriptionResumeChoice('abort'), 'chunk_fail');
  assert.equal(classifyTranscriptionResumeChoice('native'), 'caption_style');
  assert.equal(classifyTranscriptionResumeChoice('english_worded'), 'caption_style');
  assert.equal(classifyTranscriptionResumeChoice('nope'), 'unknown');

  console.log('transcriptionLanguage.selfcheck: ok');
}

main();
