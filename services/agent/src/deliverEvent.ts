import { finalizeRenderFromUrl, recordRenderFailure } from './storage';

export type DeliveryTarget = { type: 'ui' | 'whatsapp' | 'telegram' | string };

export type DeliverSession = {
  sessionId: string;
  userId: string;
  deliveryTargets?: DeliveryTarget[];
};

export type RenderEvent = {
  status: 'completed' | 'failed';
  videoUrl?: string;
};

/**
 * Parse the render event out of the webhook prompt string built by the Next
 * receiver: `HeyGen render <status> for session <id>, task <id>. video_url: <url|n/a>`.
 */
export function parseRenderEvent(prompt: string): RenderEvent {
  const status =
    /HeyGen render completed/.test(prompt) ? 'completed' : 'failed';
  const urlMatch = prompt.match(/video_url:\s*(\S+)/);
  const raw = urlMatch?.[1];
  const videoUrl = raw && raw !== 'n/a' ? raw : undefined;
  return { status, videoUrl };
}

/**
 * Non-LLM webhook turn: write the render result once (reusing the existing
 * finalize/failure helpers), then fan out to delivery targets. Only `ui` is
 * implemented today — the Firestore write already drives the polling UI, so
 * `whatsapp`/`telegram` are future one-line cases.
 */
export async function deliverEvent(
  session: DeliverSession,
  event: RenderEvent
): Promise<string> {
  const { sessionId, userId } = session;
  const targets = session.deliveryTargets ?? [{ type: 'ui' }];

  if (event.status === 'completed') {
    if (!event.videoUrl) throw new Error('completed event missing videoUrl');
    await finalizeRenderFromUrl(userId, sessionId, event.videoUrl);
  } else {
    await recordRenderFailure(
      userId,
      sessionId,
      'FAILED',
      'HeyGen cloud render failed'
    );
  }

  for (const t of targets) {
    switch (t.type) {
      case 'ui':
        // Firestore write above already drives the polling UI.
        break;
      default:
        console.warn(`[deliverEvent] unknown delivery target: ${t.type}`);
    }
  }

  return `delivered ${event.status} for session ${sessionId} to [${targets
    .map((t) => t.type)
    .join(', ')}]`;
}

export function selfcheck(): void {
  const ok = parseRenderEvent(
    'HeyGen render completed for session s1, task s1. video_url: https://x/v.mp4'
  );
  if (ok.status !== 'completed' || ok.videoUrl !== 'https://x/v.mp4') {
    throw new Error('parse completed failed');
  }
  const fail = parseRenderEvent(
    'HeyGen render failed for session s1, task s1. video_url: n/a'
  );
  if (fail.status !== 'failed' || fail.videoUrl !== undefined) {
    throw new Error('parse failed failed');
  }
  console.log('deliverEvent selfcheck ok');
}
