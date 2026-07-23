import {
  finalizeBackgroundFromUrl,
  finalizeRenderFromUrl,
  recordRenderFailure,
} from './storage';
import { saveMessage } from './session';

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

export type FalEvent = {
  taskId: 'fal_image' | 'fal_video';
  status: 'completed' | 'failed';
  mediaUrl?: string;
  error?: string;
};

export type WebhookEvent =
  | ({ source: 'heygen' } & RenderEvent)
  | ({ source: 'fal' } & FalEvent);

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
 * Parse Fal webhook prompt:
 * `Fal fal_image|fal_video completed|failed for session {id}, task {taskId}. media_url: {url|n/a} error: {msg|n/a}`
 */
export function parseFalEvent(prompt: string): FalEvent {
  const head = prompt.match(
    /^Fal (fal_image|fal_video) (completed|failed)\b/
  );
  if (!head) {
    throw new Error(`not a Fal webhook prompt: ${prompt.slice(0, 80)}`);
  }
  const mediaMatch = prompt.match(/media_url:\s*(\S+)/);
  const rawMedia = mediaMatch?.[1];
  const mediaUrl = rawMedia && rawMedia !== 'n/a' ? rawMedia : undefined;
  const errorMatch = prompt.match(/\berror:\s*(.*)$/);
  const rawError = errorMatch?.[1]?.trim();
  const error = rawError && rawError !== 'n/a' ? rawError : undefined;
  return {
    taskId: head[1] as 'fal_image' | 'fal_video',
    status: head[2] as 'completed' | 'failed',
    mediaUrl,
    error,
  };
}

export function parseWebhookEvent(prompt: string): WebhookEvent {
  if (prompt.startsWith('Fal ')) {
    return { source: 'fal', ...parseFalEvent(prompt) };
  }
  return { source: 'heygen', ...parseRenderEvent(prompt) };
}

/**
 * Non-LLM webhook turn: write the render/Fal result once, then fan out to
 * delivery targets. Only `ui` is implemented today.
 */
export async function deliverEvent(
  session: DeliverSession,
  event: WebhookEvent | RenderEvent
): Promise<string> {
  const { sessionId, userId } = session;
  const targets = session.deliveryTargets ?? [{ type: 'ui' }];

  const normalized: WebhookEvent =
    'source' in event
      ? event
      : { source: 'heygen', ...event };

  if (normalized.source === 'fal') {
    if (normalized.status === 'completed') {
      if (!normalized.mediaUrl) {
        throw new Error('completed Fal event missing mediaUrl');
      }
      await finalizeBackgroundFromUrl(
        userId,
        sessionId,
        normalized.taskId,
        normalized.mediaUrl
      );
    } else {
      const label =
        normalized.taskId === 'fal_image' ? 'image' : 'video';
      const text = `Background ${label} generation failed.`;
      await saveMessage(sessionId, userId, 'assistant', text, [
        { type: 'text', text },
      ]);
    }
  } else if (normalized.status === 'completed') {
    if (!normalized.videoUrl) throw new Error('completed event missing videoUrl');
    await finalizeRenderFromUrl(userId, sessionId, normalized.videoUrl);
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

  return `delivered ${normalized.status} for session ${sessionId} to [${targets
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

  const falOk = parseFalEvent(
    'Fal fal_image completed for session s1, task fal_image. media_url: https://x/i.png error: n/a'
  );
  if (
    falOk.taskId !== 'fal_image' ||
    falOk.status !== 'completed' ||
    falOk.mediaUrl !== 'https://x/i.png'
  ) {
    throw new Error('parseFal completed failed');
  }
  const falFail = parseFalEvent(
    'Fal fal_video failed for session s1, task fal_video. media_url: n/a error: boom'
  );
  if (
    falFail.taskId !== 'fal_video' ||
    falFail.status !== 'failed' ||
    falFail.mediaUrl !== undefined ||
    falFail.error !== 'boom'
  ) {
    throw new Error('parseFal failed failed');
  }
  const routed = parseWebhookEvent(
    'Fal fal_video completed for session s1, task fal_video. media_url: https://x/v.mp4 error: n/a'
  );
  if (routed.source !== 'fal' || routed.status !== 'completed') {
    throw new Error('parseWebhookEvent fal route failed');
  }
  console.log('deliverEvent selfcheck ok');
}

// Re-export for scripts that want one entry; identity lives in storage.
export { selfcheckBackgroundIdentity } from './storage';
