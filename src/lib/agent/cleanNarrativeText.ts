/**
 * Display-boundary cleaner for assistant narrative.
 * Order is pinned: fake tool markup → URLs → status markers → optional stack names.
 * URL-first among content scrubbers is mandatory — \bFal\b would match inside fal.media otherwise.
 */
import { stripStatusMarkers } from '@/lib/agent/parseStatusMarker';

const STACK_NAMES =
  'Manim|HyperFrames|Fal|Amplitude|Firebase|GCS|OpenRouter|Groq';
const STACK_NAME_RE = new RegExp(`\\b(?:${STACK_NAMES})\\b`, 'gi');

/** `<tool_call>…</tool_call>`, `<snake_case>…</snake_case>`, leftover `` `snake_case` ``. */
const FAKE_TOOL_CALL_BLOCK_RE = /<tool_call\b[^>]*>[\s\S]*?<\/tool_call>/gi;
const SNAKE_CASE_BLOCK_RE =
  /<[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b[^>]*>[\s\S]*?<\/[a-z][a-z0-9]*(?:_[a-z0-9]+)+>/gi;
const SNAKE_CASE_ORPHAN_TAG_RE =
  /<\/?[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?:\s[^>]*)?>/gi;
const BACKTICK_SNAKE_TOOL_RE = /`[a-z][a-z0-9]*(?:_[a-z0-9]+)+`/g;
const MM_THINK_BLOCK_RE = /<mm:think\b[^>]*>[\s\S]*?<\/mm:think>/gi;
const THINK_BLOCK_RE = /<think\b[^>]*>[\s\S]*?<\/think>/gi;
const MM_THINK_ORPHAN_RE = /<\/?mm:think\b[^>]*>/gi;
const THINK_ORPHAN_RE = /<\/?think\b[^>]*>/gi;

function tidyWhitespace(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Strip model-emitted fake tool markup by shape (not by tool-name list). */
export function stripFakeToolMarkup(text: string): string {
  return tidyWhitespace(
    text
      .replace(MM_THINK_BLOCK_RE, '')
      .replace(THINK_BLOCK_RE, '')
      .replace(MM_THINK_ORPHAN_RE, '')
      .replace(THINK_ORPHAN_RE, '')
      .replace(FAKE_TOOL_CALL_BLOCK_RE, '')
      .replace(SNAKE_CASE_BLOCK_RE, '')
      .replace(SNAKE_CASE_ORPHAN_TAG_RE, '')
      .replace(BACKTICK_SNAKE_TOOL_RE, '')
  );
}

/** Strip Storage / fal.media / common media URLs from prose. */
export function stripAssetUrls(text: string): string {
  return tidyWhitespace(
    text
      .replace(
        /https?:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com|v\d*\.fal\.media)\S*/gi,
        ''
      )
      .replace(
        /https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg|mp4|webm|mov|mkv)(?:\?\S*)?/gi,
        ''
      )
  );
}

/** Word-boundary strip of internal stack names. Never call on raw text alone — use cleanNarrativeText. */
export function stripStackNames(text: string): string {
  return tidyWhitespace(text.replace(STACK_NAME_RE, ''));
}

export type CleanNarrativeOptions = {
  /** Consumer UI: true. Dev ActivityTrace: false (keep Manim etc. visible). */
  scrubStackNames?: boolean;
};

/**
 * Pinned pipeline: stripFakeToolMarkup → stripAssetUrls → stripStatusMarkers → optional stripStackNames.
 */
export function cleanNarrativeText(
  text: string,
  options?: CleanNarrativeOptions
): string {
  let out = stripStatusMarkers(stripAssetUrls(stripFakeToolMarkup(text)));
  if (options?.scrubStackNames) {
    out = stripStackNames(out);
  }
  return out;
}
