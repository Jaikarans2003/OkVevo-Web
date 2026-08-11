import type { FalTaskId } from './falQueue';

export type RenderEvent = {
  status: 'completed' | 'failed';
  videoUrl?: string;
};

export type FalEvent = {
  taskId: FalTaskId;
  status: 'completed' | 'failed';
  mediaUrl?: string;
  payloadUrl?: string;
  error?: string;
};

export type WebhookEvent =
  | ({ source: 'heygen' } & RenderEvent)
  | ({ source: 'fal' } & FalEvent);

export function parseRenderEvent(prompt: string): RenderEvent {
  const status =
    /HeyGen render completed/.test(prompt) ? 'completed' : 'failed';
  const urlMatch = prompt.match(/video_url:\s*(\S+)/);
  const raw = urlMatch?.[1];
  const videoUrl = raw && raw !== 'n/a' ? raw : undefined;
  return { status, videoUrl };
}

export function parseFalEvent(prompt: string): FalEvent {
  const head = prompt.match(
    /^Fal (fal_image|fal_video|fal_stt) (completed|failed)\b/
  );
  if (!head) {
    throw new Error(`not a Fal webhook prompt: ${prompt.slice(0, 80)}`);
  }
  const mediaMatch = prompt.match(/media_url:\s*(\S+)/);
  const rawMedia = mediaMatch?.[1];
  const mediaUrl = rawMedia && rawMedia !== 'n/a' ? rawMedia : undefined;
  const payloadMatch = prompt.match(/payload_url:\s*(\S+)/);
  const rawPayload = payloadMatch?.[1];
  const payloadUrl = rawPayload && rawPayload !== 'n/a' ? rawPayload : undefined;
  const errorMatch = prompt.match(/\berror:\s*(.*)$/);
  const rawError = errorMatch?.[1]?.trim();
  const error = rawError && rawError !== 'n/a' ? rawError : undefined;
  return {
    taskId: head[1] as FalTaskId,
    status: head[2] as 'completed' | 'failed',
    mediaUrl,
    payloadUrl,
    error,
  };
}

export function parseWebhookEvent(prompt: string): WebhookEvent {
  if (prompt.startsWith('Fal ')) {
    return { source: 'fal', ...parseFalEvent(prompt) };
  }
  return { source: 'heygen', ...parseRenderEvent(prompt) };
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
    'Fal fal_image completed for session s1, task fal_image. media_url: https://x/i.png payload_url: n/a error: n/a'
  );
  if (
    falOk.taskId !== 'fal_image' ||
    falOk.status !== 'completed' ||
    falOk.mediaUrl !== 'https://x/i.png' ||
    falOk.payloadUrl !== undefined
  ) {
    throw new Error('parseFal completed failed');
  }
  const falFail = parseFalEvent(
    'Fal fal_video failed for session s1, task fal_video. media_url: n/a payload_url: n/a error: boom'
  );
  if (
    falFail.taskId !== 'fal_video' ||
    falFail.status !== 'failed' ||
    falFail.mediaUrl !== undefined ||
    falFail.error !== 'boom'
  ) {
    throw new Error('parseFal failed failed');
  }
  const sttOk = parseFalEvent(
    'Fal fal_stt completed for session s1, task fal_stt. media_url: n/a payload_url: https://x/p.json error: n/a'
  );
  if (
    sttOk.taskId !== 'fal_stt' ||
    sttOk.payloadUrl !== 'https://x/p.json' ||
    sttOk.mediaUrl !== undefined
  ) {
    throw new Error('parseFal stt failed');
  }
  const routed = parseWebhookEvent(
    'Fal fal_video completed for session s1, task fal_video. media_url: https://x/v.mp4 payload_url: n/a error: n/a'
  );
  if (routed.source !== 'fal' || routed.status !== 'completed') {
    throw new Error('parseWebhookEvent fal route failed');
  }
  console.log('deliverEventParse selfcheck ok');
}
