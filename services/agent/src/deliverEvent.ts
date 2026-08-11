import {
  finalizeBackgroundFromUrl,
  finalizeRenderFromUrl,
  recordRenderFailure,
} from './storage';
import { saveMessage } from './session';
import { clearPendingFalJob, readPendingFalJob } from './pendingFalJob';
import {
  parseWebhookEvent,
  type FalEvent,
  type RenderEvent,
  type WebhookEvent,
} from './deliverEventParse';

export type { FalEvent, RenderEvent, WebhookEvent } from './deliverEventParse';
export { parseFalEvent, parseRenderEvent, parseWebhookEvent } from './deliverEventParse';

export type DeliveryTarget = { type: 'ui' | 'whatsapp' | 'telegram' | string };

export type DeliverSession = {
  sessionId: string;
  userId: string;
  deliveryTargets?: DeliveryTarget[];
};

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
    const pending = await readPendingFalJob(sessionId);
    if (pending?.resumeOnCompletion || normalized.taskId === 'fal_stt') {
      const { deliverFalStt } = await import('./falSttDeliver');
      const message = await deliverFalStt(sessionId, userId, normalized);
      for (const t of targets) {
        if (t.type !== 'ui') {
          console.warn(`[deliverEvent] unknown delivery target: ${t.type}`);
        }
      }
      return message;
    }

    if (normalized.status === 'completed') {
      if (!normalized.mediaUrl) {
        throw new Error('completed Fal event missing mediaUrl');
      }
      if (normalized.taskId === 'fal_image' || normalized.taskId === 'fal_video') {
        await finalizeBackgroundFromUrl(
          userId,
          sessionId,
          normalized.taskId,
          normalized.mediaUrl
        );
      }
    } else {
      const label =
        normalized.taskId === 'fal_image' ? 'image' : 'video';
      const text = `Background ${label} generation failed.`;
      await saveMessage(sessionId, userId, 'assistant', text, [
        { type: 'text', text },
      ]);
    }
    await clearPendingFalJob(sessionId);
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { selfcheck: parseSelfcheck } = require('./deliverEventParse') as {
    selfcheck: () => void;
  };
  parseSelfcheck();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { selfcheck: idempotencySelfcheck } = require('./falSttIdempotency') as {
    selfcheck: () => void;
  };
  idempotencySelfcheck();
  console.log('deliverEvent selfcheck ok');
}

export { selfcheckBackgroundIdentity } from './storage';
