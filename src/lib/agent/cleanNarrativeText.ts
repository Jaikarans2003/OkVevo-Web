/**
 * Display-boundary cleaner for assistant narrative.
 * Order is pinned: URLs → status markers → optional stack names.
 * URL-first is mandatory — \bFal\b would match inside fal.media otherwise.
 */
import { stripStatusMarkers } from '@/lib/agent/parseStatusMarker';

const STACK_NAMES =
  'Manim|HyperFrames|Fal|Firestore|Firebase|GCS|OpenRouter|Groq';
const STACK_NAME_RE = new RegExp(`\\b(?:${STACK_NAMES})\\b`, 'gi');

function tidyWhitespace(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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
 * Pinned pipeline: stripAssetUrls → stripStatusMarkers → optional stripStackNames.
 */
export function cleanNarrativeText(
  text: string,
  options?: CleanNarrativeOptions
): string {
  let out = stripStatusMarkers(stripAssetUrls(text));
  if (options?.scrubStackNames) {
    out = stripStackNames(out);
  }
  return out;
}
