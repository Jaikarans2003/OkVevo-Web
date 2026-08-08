import type { StitchWord } from '../transcriptStitch';
import type { SarvamPhrase } from '../sarvamBatch';

export type MapTimingMode = 'duration_weight' | 'even';

export type MapSarvamResult = {
  words: StitchWord[];
  /** Phrase indices (into `phrases`) with zero Groq midpoint overlap. */
  fallbackPhraseIndices: number[];
};

/** tokens/members above this → phrase-bound even spacing instead of pack. */
export const SKEW_RATIO_THRESHOLD = 2;

/**
 * Same membership rule as transliterateWords.wordsForSegment:
 * midpoint in [start, end) except last window uses inclusive end.
 */
export function wordsForPhraseWindow(
  words: StitchWord[],
  start: number,
  end: number,
  isLast: boolean
): { globalIndex: number; word: StitchWord }[] {
  const out: { globalIndex: number; word: StitchWord }[] = [];
  for (let g = 0; g < words.length; g++) {
    const w = words[g];
    const mid = (w.start + w.end) / 2;
    const inWin = isLast ? mid >= start && mid <= end : mid >= start && mid < end;
    if (inWin) out.push({ globalIndex: g, word: w });
  }
  return out;
}

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Split tokens across N slots by cumulative duration fractions (greedy). */
export function assignTokensDurationWeight(
  tokens: string[],
  durations: number[]
): string[] {
  const n = durations.length;
  if (n === 0) return [];
  if (tokens.length === 0) return Array.from({ length: n }, () => '');
  if (n === 1) return [tokens.join(' ')];

  const total = durations.reduce((a, b) => a + Math.max(0, b), 0);
  if (!(total > 0)) return assignTokensEven(tokens, n);

  const slots: string[][] = Array.from({ length: n }, () => []);
  let tokenIdx = 0;
  let cumFrac = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      while (tokenIdx < tokens.length) slots[i].push(tokens[tokenIdx++]);
      break;
    }
    cumFrac += Math.max(0, durations[i]) / total;
    const targetCount = Math.max(tokenIdx, Math.round(cumFrac * tokens.length));
    while (tokenIdx < targetCount && tokenIdx < tokens.length) {
      slots[i].push(tokens[tokenIdx++]);
    }
  }
  while (tokenIdx < tokens.length) slots[n - 1].push(tokens[tokenIdx++]);
  return slots.map((s) => s.join(' '));
}

/** Even token split across N slots. */
export function assignTokensEven(tokens: string[], n: number): string[] {
  if (n <= 0) return [];
  if (tokens.length === 0) return Array.from({ length: n }, () => '');
  if (n === 1) return [tokens.join(' ')];
  const slots: string[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < tokens.length; t++) {
    const slot = Math.min(n - 1, Math.floor((t * n) / tokens.length));
    slots[slot].push(tokens[t]);
  }
  return slots.map((s) => s.join(' '));
}

/** Evenly space tokens across [start, end]. */
export function evenlySpacedWords(
  tokens: string[],
  start: number,
  end: number
): StitchWord[] {
  const n = tokens.length;
  if (n === 0) return [];
  const dur = Math.max(0, end - start);
  const slot = n > 0 ? dur / n : 0;
  return tokens.map((word, i) => ({
    word,
    start: start + i * slot,
    end: start + (i + 1) * slot,
  }));
}

/**
 * Split space-containing words into proportional timed sub-words.
 * Contract: every returned word.word is a single display token.
 */
export function expandMultiWordTokens(words: StitchWord[]): StitchWord[] {
  const out: StitchWord[] = [];
  for (const w of words) {
    const parts = w.word.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      if (parts.length === 1) out.push({ ...w, word: parts[0] });
      continue;
    }
    const dur = Math.max(0, w.end - w.start);
    const slot = dur / parts.length;
    for (let i = 0; i < parts.length; i++) {
      out.push({
        word: parts[i],
        start: w.start + i * slot,
        end: w.start + (i + 1) * slot,
      });
    }
  }
  return out;
}

/**
 * Redistribute Sarvam phrase text onto Groq word timestamps.
 *
 * english_worded contract:
 * - never keep native/English on empty/uncovered slots
 * - severe token/slot skew → phrase-bound even spacing for that phrase
 * - zero-overlap phrases append evenly spaced words (still recorded as fallback)
 * - multi-word packed slots are expanded before return
 */
export function mapSarvamToGroqTiming(
  groqWords: StitchWord[],
  phrases: SarvamPhrase[],
  mode: MapTimingMode = 'duration_weight'
): MapSarvamResult {
  const phraseBlocks: { insertAfterClaimedMax: number; words: StitchWord[] }[] =
    [];
  const fallbackBlocks: StitchWord[] = [];
  const fallbackPhraseIndices: number[] = [];

  for (let pi = 0; pi < phrases.length; pi++) {
    const P = phrases[pi];
    const members = wordsForPhraseWindow(
      groqWords,
      P.start,
      P.end,
      pi === phrases.length - 1
    );
    const tokens = tokenize(P.text);

    if (members.length === 0) {
      fallbackPhraseIndices.push(pi);
      if (tokens.length > 0) {
        fallbackBlocks.push(...evenlySpacedWords(tokens, P.start, P.end));
      }
      continue;
    }

    const skew =
      members.length > 0 ? tokens.length / members.length : Infinity;

    if (tokens.length === 0) {
      // No Sarvam text for this window — drop member slots (no keep-native).
      continue;
    }

    if (skew > SKEW_RATIO_THRESHOLD) {
      phraseBlocks.push({
        insertAfterClaimedMax: Math.max(...members.map((m) => m.globalIndex)),
        words: evenlySpacedWords(tokens, P.start, P.end),
      });
      continue;
    }

    const durations = members.map((m) =>
      Math.max(0, m.word.end - m.word.start)
    );
    const pieces =
      mode === 'even'
        ? assignTokensEven(tokens, members.length)
        : assignTokensDurationWeight(tokens, durations);

    const packed: StitchWord[] = [];
    for (let i = 0; i < members.length; i++) {
      const text = (pieces[i] ?? '').trim();
      if (!text) continue; // drop empty — never keep native
      const slot = members[i].word;
      packed.push({ word: text, start: slot.start, end: slot.end });
    }
    phraseBlocks.push({
      insertAfterClaimedMax: Math.max(...members.map((m) => m.globalIndex)),
      words: packed,
    });
  }

  // Rebuild from phrase blocks (claimed only) + fallback appends.
  // Uncovered Groq indices are dropped.
  phraseBlocks.sort(
    (a, b) => a.insertAfterClaimedMax - b.insertAfterClaimedMax
  );
  const assembled: StitchWord[] = [];
  for (const block of phraseBlocks) assembled.push(...block.words);
  assembled.push(...fallbackBlocks);

  return {
    words: expandMultiWordTokens(assembled),
    fallbackPhraseIndices,
  };
}
