/** Pick next {skillId}.mp4 name, or legacy final*.mp4 when skillId is omitted. */
export function nextFinalVideoBasename(
  existingNames: Iterable<string>,
  skillId?: string
): string {
  const taken = new Set([...existingNames].map((name) => name.toLowerCase()));
  const prefix = skillId && skillId.length > 0 ? skillId : 'final';
  const first = `${prefix}.mp4`;
  if (!taken.has(first.toLowerCase())) return first;
  let n = 2;
  while (taken.has(`${prefix}_${n}.mp4`.toLowerCase())) n += 1;
  return `${prefix}_${n}.mp4`;
}

/** Legacy finals plus per-skill labels: {skillId}.mp4 / {skillId}_2.mp4. */
export const FINAL_VIDEO_NAME_RE =
  /^(?:draft_video|[a-z0-9-]+(?:_\d+)?)\.mp4$/i;
