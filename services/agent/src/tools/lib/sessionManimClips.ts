export type SessionManimClip = {
  safeName: string;
  clip_url: string;
};

/** kind manim_* minus manim_script_* — same filter as historic clip count. */
export function isRenderedManimClipKind(kind: unknown): boolean {
  return (
    typeof kind === 'string' &&
    kind.startsWith('manim_') &&
    !kind.startsWith('manim_script_')
  );
}

export function sessionManimClipFromDoc(data: {
  kind?: unknown;
  url?: unknown;
}): SessionManimClip | null {
  if (!isRenderedManimClipKind(data.kind)) return null;
  const url = data.url;
  if (typeof url !== 'string' || !url) return null;
  return {
    safeName: (data.kind as string).slice('manim_'.length),
    clip_url: url,
  };
}

type RankedClip = { clip: SessionManimClip; t: number };

function createdAtMs(data: { createdAt?: unknown }): number {
  const c = data.createdAt as { toMillis?: () => number } | number | undefined;
  if (c && typeof c === 'object' && typeof c.toMillis === 'function') return c.toMillis();
  if (typeof c === 'number') return c;
  return 0;
}

/** Latest URL per safeName. */
export function listSessionManimClipsFromDocs(
  docs: Array<{ data: () => Record<string, unknown> }>
): SessionManimClip[] {
  const ranked: RankedClip[] = [];
  for (const doc of docs) {
    const data = doc.data();
    const clip = sessionManimClipFromDoc(data);
    if (!clip) continue;
    ranked.push({ clip, t: createdAtMs(data) });
  }
  ranked.sort((a, b) => b.t - a.t);
  const bySafe = new Map<string, SessionManimClip>();
  for (const { clip } of ranked) {
    if (!bySafe.has(clip.safeName)) bySafe.set(clip.safeName, clip);
  }
  return [...bySafe.values()];
}

export async function listSessionManimClips(
  userId: string,
  sessionId: string
): Promise<SessionManimClip[]> {
  // Lazy import so pure helpers/selfchecks do not need Firebase env.
  const { db } = await import('../../firebase.js');
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .get();
  return listSessionManimClipsFromDocs(snap.docs);
}

export async function countRenderedManimClips(
  userId: string,
  sessionId: string
): Promise<number> {
  return (await listSessionManimClips(userId, sessionId)).length;
}
