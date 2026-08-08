/**
 * Self-check: detect → forced second call gets pinned language.
 * Run: npx tsx src/tools/lib/forceLanguageRepass.selfcheck.ts
 */
import assert from 'node:assert';
import { languageForDetectRepass } from './forceLanguageRepass.ts';

async function mockDetectThenForce(
  detectLanguage: string
): Promise<(string | undefined)[]> {
  const calls: (string | undefined)[] = [];
  const transcribe = async (language?: string) => {
    calls.push(language);
    return { language: language ? language : detectLanguage, text: 'x' };
  };

  const first = await transcribe(undefined);
  const forceLang = languageForDetectRepass({
    firstCallHadLanguage: false,
    detectedLanguage: first.language,
  });
  assert.ok(forceLang, 'expected force language');
  await transcribe(forceLang);
  return calls;
}

async function main() {
  assert.equal(
    languageForDetectRepass({
      firstCallHadLanguage: false,
      detectedLanguage: 'Kannada',
    }),
    'kn'
  );
  assert.equal(
    languageForDetectRepass({
      firstCallHadLanguage: false,
      detectedLanguage: 'kn',
    }),
    'kn'
  );
  assert.equal(
    languageForDetectRepass({
      firstCallHadLanguage: true,
      detectedLanguage: 'kn',
    }),
    undefined
  );
  assert.equal(
    languageForDetectRepass({
      firstCallHadLanguage: false,
      detectedLanguage: 'en',
    }),
    undefined
  );
  assert.equal(
    languageForDetectRepass({
      firstCallHadLanguage: false,
      detectedLanguage: 'kn',
      forceFail: true,
    }),
    undefined
  );

  const calls = await mockDetectThenForce('Kannada');
  assert.deepEqual(calls, [undefined, 'kn']);

  console.log('forceLanguageRepass.selfcheck: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
