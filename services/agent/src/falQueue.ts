import { signCallbackToken } from './callbackToken';

export type FalTaskId = 'fal_image' | 'fal_video';

/** Public Next webhook URL with signed session token (mirrors HeyGen callback). */
export function buildFalWebhookUrl(sessionId: string, taskId: FalTaskId): string {
  const base = process.env.FAL_CALLBACK_URL?.trim();
  if (!base) throw new Error('Missing FAL_CALLBACK_URL');
  const token = signCallbackToken({
    sessionId,
    taskId,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  });
  return `${base}?token=${encodeURIComponent(token)}`;
}

/** Queue submit only — no poll. Fal POSTs the result to webhookUrl when done. */
export async function falQueueSubmit(opts: {
  model: string;
  falKey: string;
  input: Record<string, unknown>;
  webhookUrl: string;
}): Promise<{ request_id: string }> {
  const url = `https://queue.fal.run/${opts.model}?fal_webhook=${encodeURIComponent(opts.webhookUrl)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Key ${opts.falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(opts.input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fal queue submit ${res.status}: ${text.slice(0, 500)}`);
  }

  const body = (await res.json()) as { request_id?: string };
  if (!body.request_id) {
    throw new Error('Fal queue submit returned no request_id');
  }
  return { request_id: body.request_id };
}
