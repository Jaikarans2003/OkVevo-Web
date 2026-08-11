/**
 * Fal queue adapter for ElevenLabs Scribe v2 (speech-to-text).
 * Submit-only — result arrives via fal_webhook (no status polling).
 */

import {
  buildFalWebhookUrl,
  falQueueSubmit,
} from '../../falQueue';

export const ELEVENLABS_SCRIBE_V2_MODEL =
  'fal-ai/elevenlabs/speech-to-text/scribe-v2';

export type ElevenLabsWord = {
  text?: string;
  start?: number;
  end?: number;
  type?: string;
  speaker_id?: string;
};

export type ElevenLabsSttResult = {
  text?: string;
  language_code?: string;
  language_probability?: number;
  words?: ElevenLabsWord[];
  audio_duration_secs?: number;
};

export class ElevenLabsSttError extends Error {
  kind: 'transient' | 'permanent';
  status?: number;

  constructor(
    message: string,
    opts: { kind: 'transient' | 'permanent'; status?: number }
  ) {
    super(message);
    this.kind = opts.kind;
    this.status = opts.status;
  }
}

function falKey(): string {
  const key = process.env.FAL_API_KEY?.trim();
  if (!key) {
    throw new ElevenLabsSttError('FAL_API_KEY is not set', { kind: 'permanent' });
  }
  return key;
}

function classifyHttp(status: number): 'transient' | 'permanent' {
  if (status === 429 || status >= 500) return 'transient';
  return 'permanent';
}

/** Queue Scribe v2; Fal POSTs result to webhook when done. */
export async function submitElevenLabsScribeV2(opts: {
  sessionId: string;
  audioUrl: string;
}): Promise<{ request_id: string }> {
  const key = falKey();
  const webhookUrl = buildFalWebhookUrl(opts.sessionId, 'fal_stt');
  try {
    return await falQueueSubmit({
      model: ELEVENLABS_SCRIBE_V2_MODEL,
      falKey: key,
      webhookUrl,
      input: {
        audio_url: opts.audioUrl,
        tag_audio_events: false,
        diarize: false,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const statusMatch = msg.match(/\b(\d{3})\b/);
    const status = statusMatch ? Number(statusMatch[1]) : undefined;
    throw new ElevenLabsSttError(msg, {
      kind: classifyHttp(status ?? 500),
      status,
    });
  }
}
