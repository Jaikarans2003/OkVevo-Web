export const TIMELINE_EPSILON = 0.5;

/** Mid Mode-A gaps must exceed this (strict >) to emit Mode C; ≤ absorbs into prior A. */
export const MIN_MODE_C_GAP_SECONDS = 1.5;

function itemsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number }
): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Greedy non-overlap: first chronological item wins. */
export function resolveNonOverlapping<T extends { start: number; end: number }>(
  items: T[]
): { kept: T[]; dropped: T[] } {
  const valid = items.filter((item) => item.end > item.start);
  const sorted = [...valid].sort((a, b) => a.start - b.start);

  const kept: T[] = [];
  const dropped: T[] = [];

  for (const item of sorted) {
    if (kept.some((k) => itemsOverlap(k, item))) {
      dropped.push(item);
    } else {
      kept.push(item);
    }
  }

  return { kept, dropped };
}

export function partitionTimeline<T extends { start: number; end: number; type: string }>(
  items: T[],
  totalDuration: number,
  gapFillType: string,
  epsilon = TIMELINE_EPSILON
): Array<T | { start: number; end: number; type: string }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const segments: Array<T | { start: number; end: number; type: string }> = [];
  let cursor = 0;

  for (const anchor of sorted) {
    const gap = anchor.start - cursor;
    if (segments.length === 0) {
      // leading: TIMELINE_EPSILON — real speaker intro, not a flicker
      if (gap > epsilon) {
        segments.push({ start: cursor, end: anchor.start, type: gapFillType });
      } else if (gap > 0) {
        anchor.start = cursor;
      }
    } else if (gap > MIN_MODE_C_GAP_SECONDS) {
      segments.push({ start: cursor, end: anchor.start, type: gapFillType });
    } else if (gap > 0) {
      segments[segments.length - 1].end = anchor.start;
    }
    segments.push({ ...anchor });
    cursor = anchor.end;
  }

  const tail = totalDuration - cursor;
  if (tail > epsilon) {
    segments.push({ start: cursor, end: totalDuration, type: gapFillType });
  } else if (tail > 0 && segments.length > 0) {
    segments[segments.length - 1].end = totalDuration;
  } else if (segments.length === 0 && totalDuration > 0) {
    segments.push({ start: 0, end: totalDuration, type: gapFillType });
  }

  return segments;
}
