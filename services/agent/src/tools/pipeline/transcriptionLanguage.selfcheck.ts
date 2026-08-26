/**
 * Offline guards for transcription language routing.
 * Run: npx tsx src/tools/pipeline/transcriptionLanguage.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyTranscriptionResumeChoice,
  normalizeLanguageCode,
  pinnedLanguageFromRequest,
  resolveRequestedLanguage,
  TRANSCRIPTION_LANGUAGE_CHOICES,
} from '../lib/transcriptionLanguage.ts';

const SKILLS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../Skills'
);

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

  for (const skill of ['edu-video', 'talking-head']) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(SKILLS_ROOT, skill, 'skill.json'), 'utf8')
    ) as {
      phases?: Record<
        string,
        { kind?: string; choices?: { id: string }[]; allowFreeform?: boolean }
      >;
    };
    const language = manifest.phases?.['transcription-language'];
    const paused = manifest.phases?.['transcription-paused'];
    assert.equal(language?.kind, 'selection', `${skill} transcription-language kind`);
    assert.deepEqual(
      (language?.choices ?? []).map((c) => c.id).sort(),
      ['auto', 'en']
    );
    assert.equal(language?.allowFreeform, false);
    assert.equal(paused?.kind, 'selection', `${skill} transcription-paused kind`);
    assert.deepEqual(
      (paused?.choices ?? []).map((c) => c.id).sort(),
      ['abort', 'continue', 'retry']
    );
  }

  const transcribeSource = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'transcribe.ts'),
    'utf8'
  );
  assert.match(transcribeSource, /missingConfirmedFields/);
  assert.match(transcribeSource, /\['language'\]/);

  console.log('transcriptionLanguage.selfcheck: ok');
}

main();
