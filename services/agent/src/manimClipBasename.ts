/** Pick next manim/{safeName}[_N].mp4 name given existing basenames under manim/. */
export function nextManimClipBasename(
  safeName: string,
  existingBasenames: Iterable<string>
): string {
  const taken = new Set([...existingBasenames].map((name) => name.toLowerCase()));
  const first = `${safeName}.mp4`;
  if (!taken.has(first.toLowerCase())) return first;
  let n = 2;
  while (taken.has(`${safeName}_${n}.mp4`.toLowerCase())) n += 1;
  return `${safeName}_${n}.mp4`;
}
