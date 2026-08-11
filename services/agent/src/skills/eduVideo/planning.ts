import {
  MIN_MODE_C_GAP_SECONDS,
  partitionTimeline,
  TIMELINE_EPSILON,
} from '../../lib/timelinePlanning';

export const HF_SEGMENT_EPSILON = TIMELINE_EPSILON;
export { MIN_MODE_C_GAP_SECONDS };

export type TimedConcept = {
  concept_name: string;
  explanation: string;
  start_seconds: number;
  end_seconds: number;
};

export type PlannedSegment = {
  start: number;
  end: number;
  mode: 'A' | 'C';
  manim_index?: number;
  concept_name?: string;
};

type ManimClipRef = {
  start_seconds: number;
  end_seconds: number;
  concept_name?: string;
};

type SegmentAnchor = {
  start: number;
  end: number;
  type: 'A';
  manim_index?: number;
  concept_name?: string;
};

/** ponytail: drop only if trim leaves less than this; upgrade path = split long excerpts in extract prompt */
export const MIN_CONCEPT_SECONDS = 4;

/** Trim later starts forward to abut prior concepts; drop only if window too short after trim. */
export function resolveNonOverlappingConcepts(concepts: TimedConcept[]): TimedConcept[] {
  const valid = concepts.filter((c) => c.end_seconds > c.start_seconds);
  const sorted = [...valid].sort(
    (a, b) => a.start_seconds - b.start_seconds || a.end_seconds - b.end_seconds
  );

  const result: TimedConcept[] = [];

  for (const concept of sorted) {
    let start_seconds = concept.start_seconds;
    const end_seconds = concept.end_seconds;

    for (const prior of result) {
      if (start_seconds < prior.end_seconds) {
        start_seconds = prior.end_seconds;
      }
    }

    if (end_seconds - start_seconds < MIN_CONCEPT_SECONDS) continue;

    result.push({ ...concept, start_seconds, end_seconds });
  }

  return result;
}

/** Extend each concept end to the next start when the gap is under MIN_MODE_C_GAP_SECONDS. */
export function bridgeConceptGaps(concepts: TimedConcept[]): TimedConcept[] {
  if (concepts.length < 2) return concepts.map((c) => ({ ...c }));
  const result = concepts.map((c) => ({ ...c }));
  for (let i = 0; i < result.length - 1; i++) {
    const gap = result[i + 1].start_seconds - result[i].end_seconds;
    if (gap > 0 && gap < MIN_MODE_C_GAP_SECONDS) {
      result[i].end_seconds = result[i + 1].start_seconds;
    }
  }
  return result;
}

/** Mode A from Manim clips, Mode C fills gaps. */
export function buildDeterministicSegments(
  manimClips: ManimClipRef[],
  totalDuration: number
): PlannedSegment[] {
  const anchors: SegmentAnchor[] = manimClips.map((clip, manim_index) => ({
    start: clip.start_seconds,
    end: clip.end_seconds,
    type: 'A',
    manim_index,
    concept_name: clip.concept_name,
  }));

  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const a = anchors[i];
      const b = anchors[j];
      if (
        a.start < b.end - TIMELINE_EPSILON &&
        b.start < a.end - TIMELINE_EPSILON
      ) {
        throw new Error(
          `Overlapping Manim clip anchors: [${a.start}-${a.end}] vs [${b.start}-${b.end}]`
        );
      }
    }
  }

  const raw = partitionTimeline(anchors, totalDuration, 'C');

  return raw.map((seg): PlannedSegment => {
    const base: PlannedSegment = {
      start: seg.start,
      end: seg.end,
      mode: seg.type === 'A' ? 'A' : 'C',
    };
    if (seg.type !== 'A') return base;

    const anchor = seg as SegmentAnchor;
    return {
      ...base,
      ...(anchor.manim_index !== undefined && { manim_index: anchor.manim_index }),
      ...(anchor.concept_name !== undefined && { concept_name: anchor.concept_name }),
    };
  });
}

export function segmentsCoverTimeline(
  segments: PlannedSegment[],
  totalDuration: number
): boolean {
  if (segments.length === 0) return false;
  if (Math.abs(segments[0].start) > TIMELINE_EPSILON) return false;

  let cursor = 0;
  for (const seg of segments) {
    if (Math.abs(seg.start - cursor) > TIMELINE_EPSILON) return false;
    if (seg.end <= seg.start) return false;
    cursor = seg.end;
  }
  return Math.abs(cursor - totalDuration) <= TIMELINE_EPSILON;
}

/** With Manim clips, timeline must include A (C optional when short gaps are absorbed); all-C when no clips. */
export function segmentsHaveRequiredModes(
  segments: PlannedSegment[],
  hasManimClips: boolean
): boolean {
  const modes = new Set(segments.map((s) => s.mode));
  if (hasManimClips) {
    return modes.has('A');
  }
  return modes.has('C');
}

export function validatePlannedSegments(
  segments: PlannedSegment[],
  totalDuration: number,
  hasManimClips: boolean
): void {
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      if (
        a.start < b.end - TIMELINE_EPSILON &&
        b.start < a.end - TIMELINE_EPSILON
      ) {
        throw new Error(
          `Overlapping segments: [${a.start}-${a.end}] vs [${b.start}-${b.end}]`
        );
      }
    }
  }

  if (!segmentsCoverTimeline(segments, totalDuration)) {
    throw new Error('Segments do not cover the full timeline contiguously');
  }

  if (hasManimClips && !segmentsHaveRequiredModes(segments, true)) {
    throw new Error('Timeline with Manim clips must include Mode A');
  }

  for (const seg of segments) {
    if (seg.mode === 'A' && seg.manim_index == null) {
      throw new Error('Mode A segment missing manim_index');
    }
  }
}
