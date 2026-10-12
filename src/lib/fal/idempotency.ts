/**
 * Amendment-1 idempotency. Key is run_id + uid.
 * One decision function; the Firestore transaction in handleQueue applies it
 * together with applyReserve. No second balance.
 */

import { createHash } from 'node:crypto';

import { MEDIA_ARG_KEYS, pickMediaArgs } from '@/lib/fal/mediaInputs';

/**
 * Fields copied onto the Fal submit. Price-relevant params and the prompt
 * live here. Media keys that also appear in this list (audio_url) are hashed
 * from the client ref, not from this copy after URL signing.
 */
export const SUBMIT_KEYS = [
  'duration',
  'num_images',
  'image_size',
  'generate_audio',
  'resolution',
  'num_frames',
  'width',
  'height',
  'enable_web_search',
  'web_search',
  'quality',
  'text',
  'lyrics',
  'size',
  'task',
  'aspect_ratio',
  'prompt',
  'voice_id',
  'voice_setting',
  'language_boost',
  'audio_url',
  'model',
  'prompt_expansion_mode',
  'audio',
  'output_format',
  'seed',
] as const;

export function pickSubmitArgs(body: unknown): Record<string, unknown> {
  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const k of SUBMIT_KEYS) {
    if (k in rec) out[k] = rec[k];
  }
  return out;
}

/**
 * Canonical client request: model id, price-relevant params, prompt, and
 * stable media ids (drama-upload://<id> or the original Fal media URL).
 * Media keys are omitted from submitArgs so a later signed URL cannot
 * change the hash, including keys that are both submit keys and media keys.
 * canonicalBodyHash sorts object keys.
 */
export function hashableClientRequest(
  endpoint: string,
  clientArgs: Record<string, unknown>
): { endpoint: string; submitArgs: Record<string, unknown>; mediaArgs: Record<string, unknown> } {
  const submitArgs = pickSubmitArgs(clientArgs);
  for (const key of Object.keys(MEDIA_ARG_KEYS)) delete submitArgs[key];
  return { endpoint, submitArgs, mediaArgs: pickMediaArgs(clientArgs) };
}

export function clientRequestHash(endpoint: string, clientArgs: Record<string, unknown>): string {
  return canonicalBodyHash(hashableClientRequest(endpoint, clientArgs));
}

export type FalPhase = 'reserved' | 'queued' | 'submitted' | 'unknown' | 'settled' | 'released';

export type IdemRow = {
  uid: string;
  runId: string;
  bodyHash: string;
  phase: FalPhase;
  submitStarted: boolean;
  holdId: string;
  falRequestId?: string;
};

export type IdemDecision =
  | { action: 'create' }
  | { action: 'replay'; row: IdemRow }
  | { action: 'continue'; row: IdemRow }
  | { action: 'unknown'; row: IdemRow }
  | { action: 'conflict' };

export function canonicalBodyHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(',')}}`;
}

export function decideIdempotency(existing: IdemRow | undefined, bodyHash: string): IdemDecision {
  if (!existing) return { action: 'create' };
  if (existing.bodyHash !== bodyHash) return { action: 'conflict' };
  if (existing.phase === 'submitted' && existing.falRequestId) return { action: 'replay', row: existing };
  if (existing.phase === 'queued' && !existing.submitStarted) return { action: 'replay', row: existing };
  if (existing.phase === 'settled' || existing.phase === 'released') return { action: 'replay', row: existing };
  if (existing.phase === 'unknown' || (existing.submitStarted && !existing.falRequestId)) {
    return { action: 'unknown', row: existing };
  }
  if (!existing.submitStarted) return { action: 'continue', row: existing };
  return { action: 'unknown', row: existing };
}

export type MemoryRun = IdemRow & { holds: number; falCalls: number };

/**
 * In-memory stand-in for the Firestore transaction.
 * Parallel callers share one row and one Fal call.
 */
export function memorySubmit(opts: {
  store: Map<string, MemoryRun>;
  key: string;
  uid: string;
  runId: string;
  bodyHash: string;
  fal: () => string;
}): { status: number; falRequestId?: string; holds: number; falCalls: number } {
  const existing = opts.store.get(opts.key);
  const decision = decideIdempotency(existing, opts.bodyHash);
  if (decision.action === 'conflict') {
    return { status: 409, holds: existing?.holds ?? 0, falCalls: existing?.falCalls ?? 0 };
  }
  if (decision.action === 'replay' || decision.action === 'unknown') {
    const row = decision.row as MemoryRun;
    return {
      status: decision.action === 'unknown' ? 202 : 200,
      falRequestId: row.falRequestId,
      holds: row.holds,
      falCalls: row.falCalls,
    };
  }
  let row: MemoryRun;
  if (decision.action === 'create') {
    row = {
      uid: opts.uid,
      runId: opts.runId,
      bodyHash: opts.bodyHash,
      phase: 'reserved',
      submitStarted: false,
      holdId: `hold-${opts.store.size + 1}`,
      holds: (existing?.holds ?? 0) + 1,
      falCalls: 0,
    };
    opts.store.set(opts.key, row);
  } else {
    row = decision.row as MemoryRun;
  }
  if (row.submitStarted) {
    return { status: 202, holds: row.holds, falCalls: row.falCalls };
  }
  row.submitStarted = true;
  const falId = opts.fal();
  row.falCalls += 1;
  if (!falId) {
    row.phase = 'unknown';
    return { status: 202, holds: row.holds, falCalls: row.falCalls };
  }
  row.falRequestId = falId;
  row.phase = 'submitted';
  return { status: 200, falRequestId: falId, holds: row.holds, falCalls: row.falCalls };
}
