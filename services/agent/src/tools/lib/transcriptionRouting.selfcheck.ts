/**
 * English path must not pull ElevenLabs; auto resolves to scribe routing helpers.
 * Run: npx tsx src/tools/lib/transcriptionRouting.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  pinnedLanguageFromRequest,
  resolveRequestedLanguage,
} from './transcriptionLanguage.ts';

function main() {
  // English pin never leaves Groq path helpers.
  assert.equal(pinnedLanguageFromRequest('en'), 'en');
  assert.equal(resolveRequestedLanguage(undefined, 'auto'), 'auto');

  const transcribeSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/tools/pipeline/transcribe.ts'),
    'utf8'
  );

  // English branch uses pinned en; auto imports elevenLabs.
  assert.ok(transcribeSrc.includes("from '../lib/elevenLabsStt'"));
  assert.ok(transcribeSrc.includes("requestedLanguage === 'auto'"));
  assert.ok(transcribeSrc.includes('pinnedLanguageFromRequest(requestedLanguage)'));
  assert.ok(!transcribeSrc.includes('forceLanguageRepass'));
  assert.ok(!transcribeSrc.includes('transliterate'));
  assert.ok(!transcribeSrc.includes('sarvam'));

  console.log('transcriptionRouting.selfcheck: ok');
}

main();
