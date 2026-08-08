import { normalizeLanguageCode } from './transliteration/transliterateWords';

/**
 * After an unpinned detect call, return the language code for a forced second
 * pass. Skip when the first call already passed language, pin is English, or
 * force-fail env is set (failover tests must not burn a second provider call).
 */
export function languageForDetectRepass(opts: {
  firstCallHadLanguage: boolean;
  detectedLanguage?: string;
  forceFail?: boolean;
}): string | undefined {
  if (opts.firstCallHadLanguage || opts.forceFail) return undefined;
  const pin =
    normalizeLanguageCode(opts.detectedLanguage) ?? opts.detectedLanguage;
  if (!pin || pin === 'en') return undefined;
  return pin;
}
