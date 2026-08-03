/** Locked draft_video.metadata keys from session.renderSnapshot.
 * keep in sync with infrastructure/lambdas/hyperframes-render-completion/index.js draft_video metadata
 * and services/agent/src/storage.ts finalizeRenderFromLocalFile
 */
export const RENDER_SNAPSHOT_METADATA_KEYS = [
  'orientation',
  'speaker_video_url',
  'speaker_audio_url',
  'manim_clips',
  'transcript_words',
  'total_duration',
  'segments_plan',
  'composition_manifest_url',
  'brand_colors',
] as const;

export type RenderSnapshotManimClip = {
  concept_name: string;
  clip_url: string;
  start_seconds: number;
  end_seconds: number;
};

export type RenderSnapshot = {
  orientation: 'horizontal' | 'vertical';
  speaker_video_url: string;
  speaker_audio_url?: string | null;
  manim_clips: RenderSnapshotManimClip[];
  transcript_words: Array<{ word: string; start: number; end: number }>;
  total_duration: number;
  segments_plan: { segments: unknown[]; total_duration: number };
  composition_manifest_url?: string;
  brand_colors?: { primary: string; accent: string; bg_dark: string };
  scaffoldedAt: string;
};

/** Map session stash → draft_video.metadata (omit undefined/null optionals). */
export function draftMetadataFromRenderSnapshot(
  snap: RenderSnapshot | null | undefined
): Record<string, unknown> | undefined {
  if (!snap || typeof snap !== 'object') return undefined;
  if (
    (snap.orientation !== 'horizontal' && snap.orientation !== 'vertical') ||
    typeof snap.speaker_video_url !== 'string' ||
    !Array.isArray(snap.manim_clips) ||
    !Array.isArray(snap.transcript_words) ||
    typeof snap.total_duration !== 'number' ||
    !snap.segments_plan ||
    !Array.isArray(snap.segments_plan.segments)
  ) {
    return undefined;
  }

  const meta: Record<string, unknown> = {
    orientation: snap.orientation,
    speaker_video_url: snap.speaker_video_url,
    manim_clips: snap.manim_clips,
    transcript_words: snap.transcript_words,
    total_duration: snap.total_duration,
    segments_plan: snap.segments_plan,
  };
  if (snap.speaker_audio_url != null && snap.speaker_audio_url !== '') {
    meta.speaker_audio_url = snap.speaker_audio_url;
  }
  if (typeof snap.composition_manifest_url === 'string' && snap.composition_manifest_url) {
    meta.composition_manifest_url = snap.composition_manifest_url;
  }
  if (snap.brand_colors) {
    meta.brand_colors = snap.brand_colors;
  }
  return meta;
}

/** Required recipe fields for restore_generation — never fall back to live session. */
export function parseRestoreRecipe(
  metadata: unknown
): {
  orientation: 'horizontal' | 'vertical';
  speaker_video_url: string;
  speaker_audio_url?: string;
  manim_clips: RenderSnapshotManimClip[];
  transcript_words: Array<{ word: string; start: number; end: number }>;
  total_duration: number;
  segments_plan: { segments: unknown[]; total_duration: number };
  brand_colors?: { primary: string; accent: string; bg_dark: string };
} {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error(
      'This draft_video has no restore snapshot (pre-snapshot final or incomplete metadata). Tag a final rendered after snapshot support, or rebuild from the live session.'
    );
  }
  const m = metadata as Record<string, unknown>;
  if (m.orientation !== 'horizontal' && m.orientation !== 'vertical') {
    throw incomplete('orientation');
  }
  if (typeof m.speaker_video_url !== 'string' || !m.speaker_video_url) {
    throw incomplete('speaker_video_url');
  }
  if (!Array.isArray(m.manim_clips)) throw incomplete('manim_clips');
  if (!Array.isArray(m.transcript_words)) throw incomplete('transcript_words');
  if (typeof m.total_duration !== 'number') throw incomplete('total_duration');
  const plan = m.segments_plan as { segments?: unknown[]; total_duration?: number } | undefined;
  if (!plan || !Array.isArray(plan.segments) || typeof plan.total_duration !== 'number') {
    throw incomplete('segments_plan');
  }

  return {
    orientation: m.orientation,
    speaker_video_url: m.speaker_video_url,
    ...(typeof m.speaker_audio_url === 'string' && m.speaker_audio_url
      ? { speaker_audio_url: m.speaker_audio_url }
      : {}),
    manim_clips: m.manim_clips as RenderSnapshotManimClip[],
    transcript_words: m.transcript_words as Array<{
      word: string;
      start: number;
      end: number;
    }>,
    total_duration: m.total_duration,
    segments_plan: { segments: plan.segments, total_duration: plan.total_duration },
    ...(m.brand_colors && typeof m.brand_colors === 'object'
      ? { brand_colors: m.brand_colors as { primary: string; accent: string; bg_dark: string } }
      : {}),
  };
}

function incomplete(field: string): Error {
  return new Error(
    `This draft_video restore snapshot is incomplete (missing ${field}). Pre-snapshot finals cannot be restored — rebuild from the live session or re-render a new final.`
  );
}
