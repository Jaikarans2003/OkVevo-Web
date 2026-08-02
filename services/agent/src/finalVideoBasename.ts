/** Pick next final*.mp4 name given existing session filenames (incl. legacy draft_video.mp4). */
export function nextFinalVideoBasename(existingNames: Iterable<string>): string {
  const taken = new Set(
    [...existingNames].map((name) => name.toLowerCase())
  );
  if (!taken.has('final.mp4')) return 'final.mp4';
  let n = 2;
  while (taken.has(`final_${n}.mp4`)) n += 1;
  return `final_${n}.mp4`;
}

export const FINAL_VIDEO_NAME_RE = /^(final(?:_\d+)?|draft_video)\.mp4$/i;
