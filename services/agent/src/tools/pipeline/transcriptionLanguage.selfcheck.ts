/**
 * Offline guards for transcription language routing.
 * Run: npx tsx src/tools/pipeline/transcriptionLanguage.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  classifyTranscriptionResumeChoice,
  normalizeLanguageCode,
  pinnedLanguageFromRequest,
  resolveRequestedLanguage,
  TRANSCRIPTION_LANGUAGE_CHOICES,
} from '../lib/transcriptionLanguage.ts';

function main() {
  assert.deepEqual(
    TRANSCRIPTION_LANGUAGE_CHOICES.map((c) => c.id),
    ['en', 'auto']
  );

  assert.equal(normalizeLanguageCode('kn-IN'), 'kn');
  assert.equal(normalizeLanguageCode('eng'), 'eng');
  assert.equal(normalizeLanguageCode('Kannada'), 'kn');
  assert.equal(normalizeLanguageCode('kan'), 'kn'); // Fal Scribe ISO 639-3

  assert.equal(pinnedLanguageFromRequest('en'), 'en');
  assert.equal(pinnedLanguageFromRequest('auto'), undefined);
  assert.equal(pinnedLanguageFromRequest(undefined), undefined);

  assert.equal(resolveRequestedLanguage(undefined, 'auto'), 'auto');
  assert.equal(resolveRequestedLanguage('en', 'ask'), 'en');
  assert.equal(resolveRequestedLanguage('auto', 'ask'), 'auto');

  assert.equal(classifyTranscriptionResumeChoice('en'), 'language');
  assert.equal(classifyTranscriptionResumeChoice('auto'), 'language');
  assert.equal(classifyTranscriptionResumeChoice('retry'), 'chunk_fail');
  assert.equal(classifyTranscriptionResumeChoice('english_worded'), 'unknown');
  assert.equal(classifyTranscriptionResumeChoice('hi'), 'unknown');

  console.log('transcriptionLanguage.selfcheck: ok');
}

main();
