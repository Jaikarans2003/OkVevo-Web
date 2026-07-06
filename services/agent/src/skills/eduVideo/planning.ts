import {
  partitionTimeline,
  resolveNonOverlapping,
  TIMELINE_EPSILON,
} from '../../lib/timelinePlanning';

export const HF_SEGMENT_EPSILON = TIMELINE_EPSILON;

export type VisualKind = 'manim' | 'hyperframes' | 'none';

export type TimedConcept = {
  concept_name: string;
  explanation: string;
  start_seconds: number;
  end_seconds: number;
  visual: VisualKind;
  drop_reason?: string;
};

export type PlannedSegment = {
  start: number;
  end: number;
  mode: 'A' | 'B' | 'C';
  manim_index?: number;
  concept_name?: string;
  explanation?: string;
};

/** Greedy non-overlap: first chronological visual wins; losers become visual none. */
export function resolveNonOverlappingConcepts(concepts: TimedConcept[]): TimedConcept[] {
  const result = concepts.map((c) => ({ ...c }));
  const visualEntries = result
    .map((c, index) => ({ c, index }))
    .filter(
      ({ c }) =>
        (c.visual === 'manim' || c.visual === 'hyperframes') &&
        c.end_seconds > c.start_seconds
    );

  const { dropped } = resolveNonOverlapping(
    visualEntries.map(({ c, index }) => ({
      start: c.start_seconds,
      end: c.end_seconds,
      index,
    }))
  );

  for (const { index } of dropped) {
    result[index] = {
      ...result[index],
      visual: 'none',
      drop_reason: 'overlaps_with_higher_priority_concept',
    };
  }

  return result;
}

function conceptDuration(c: TimedConcept): number {
  return Math.max(0, c.end_seconds - c.start_seconds);
}

function promoteVisual(
  concepts: TimedConcept[],
  target: 'manim' | 'hyperframes',
  excludeName?: string
): boolean {
  const candidates = concepts
    .filter(
      (c) =>
        c.end_seconds > c.start_seconds &&
        c.concept_name !== excludeName &&
        c.visual !== target
    )
    .sort((a, b) => conceptDuration(b) - conceptDuration(a));

  const pick = candidates[0];
  if (!pick) return false;

  const idx = concepts.findIndex(
    (c) =>
      c.concept_name === pick.concept_name &&
      c.start_seconds === pick.start_seconds &&
      c.end_seconds === pick.end_seconds
  );
  if (idx < 0) return false;

  concepts[idx] = { ...concepts[idx], visual: target, drop_reason: undefined };
  return true;
}

/** Ensure at least one manim and one hyperframes concept when any valid window exists. */
export function enforceMandatoryVisuals(concepts: TimedConcept[]): TimedConcept[] {
  const result = concepts.map((c) => ({ ...c }));
  const hasValid = result.some((c) => c.end_seconds > c.start_seconds);
  if (!hasValid) return result;

  let manimName: string | undefined;
  if (!result.some((c) => c.visual === 'manim')) {
    promoteVisual(result, 'manim');
    manimName = result.find((c) => c.visual === 'manim')?.concept_name;
  }

  if (!result.some((c) => c.visual === 'hyperframes')) {
    promoteVisual(result, 'hyperframes', manimName);
  }

  return result;
}

type ManimClipRef = {
  start_seconds: number;
  end_seconds: number;
  concept_name?: string;
};

type HfConceptRef = {
  start_seconds: number;
  end_seconds: number;
  concept_name: string;
  explanation: string;
};

type SegmentAnchor = {
  start: number;
  end: number;
  type: 'A' | 'B';
  manim_index?: number;
  concept_name?: string;
  explanation?: string;
};

/** Mode A from clips, Mode B from hyperframes concepts, Mode C fills gaps. */
export function buildDeterministicSegments(
  manimClips: ManimClipRef[],
  hfConcepts: HfConceptRef[],
  totalDuration: number
): PlannedSegment[] {
  const anchors: SegmentAnchor[] = [];

  manimClips.forEach((clip, manim_index) => {
    anchors.push({
      start: clip.start_seconds,
      end: clip.end_seconds,
      type: 'A',
      manim_index,
      concept_name: clip.concept_name,
    });
  });

  for (const hf of hfConcepts) {
    anchors.push({
      start: hf.start_seconds,
      end: hf.end_seconds,
      type: 'B',
      concept_name: hf.concept_name,
      explanation: hf.explanation,
    });
  }

  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const a = anchors[i];
      const b = anchors[j];
      if (
        a.start < b.end - TIMELINE_EPSILON &&
        b.start < a.end - TIMELINE_EPSILON
      ) {
        throw new Error(
          `Overlapping segment anchors: ${a.type} [${a.start}-${a.end}] vs ${b.type} [${b.start}-${b.end}]`
        );
      }
    }
  }

  const raw = partitionTimeline(anchors, totalDuration, 'C');

  return raw.map((seg): PlannedSegment => {
    const base: PlannedSegment = {
      start: seg.start,
      end: seg.end,
      mode: seg.type as 'A' | 'B' | 'C',
    };
    if (seg.type !== 'A' && seg.type !== 'B') return base;

    const anchor = seg as SegmentAnchor;
    return {
      ...base,
      ...(anchor.manim_index !== undefined && { manim_index: anchor.manim_index }),
      ...(anchor.concept_name !== undefined && { concept_name: anchor.concept_name }),
      ...(anchor.explanation !== undefined && { explanation: anchor.explanation }),
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

export function segmentsIncludeAllModes(segments: PlannedSegment[]): boolean {
  const modes = new Set(segments.map((s) => s.mode));
  return modes.has('A') && modes.has('B') && modes.has('C');
}
