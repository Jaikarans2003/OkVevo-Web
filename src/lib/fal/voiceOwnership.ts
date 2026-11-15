/**
 * Cloned-voice ownership. Postgres `cloned_voices` row id =
 * `base64url(custom_voice_id)` is the SoT; the skill's metadata/voices file
 * is a cache.
 *
 * Fal/MiniMax voice-clone (llms.txt 2026-10-10) has no delete-voice API.
 * Unused provider clones auto-delete after 7 days; used clones persist.
 * DELETE /api/fal/voices tombstones the row (`status: 'deleted'`). The row
 * is never removed, so no other uid can register or use that voice_id again.
 * Fal still has no delete-voice API (`provider_deleted: false`).
 */

import { sql } from '@/lib/db/client';
import { withTx, type TxSql } from '@/lib/db/tx';
import { classifyMediaValue } from '@/lib/fal/mediaInputs';

export const SPEECH_ENDPOINT = 'fal-ai/minimax/speech-02-hd';
export const VOICE_CLONE_ENDPOINT = 'fal-ai/minimax/voice-clone';

/** Fal retains unused clones for 7 days (voice-clone llms.txt 2026-10-10). */
export const VOICE_RETAIN_MS = 7 * 24 * 60 * 60 * 1000;
export const VOICE_EXPIRE_WARN_MS = 24 * 60 * 60 * 1000;

/** Schema examples on speech-02-hd — not a closed enum, but these are ours. */
export const PRESET_VOICE_IDS = new Set([
  'Wise_Woman',
  'Friendly_Person',
  'Inspirational_girl',
  'Deep_Voice_Man',
  'Calm_Woman',
  'Casual_Guy',
  'Lively_Girl',
  'Patient_Man',
  'Young_Knight',
  'Determined_Man',
  'Lovely_Girl',
  'Decent_Boy',
  'Imposing_Manner',
  'Elegant_Man',
  'Abbess',
  'Sweet_Girl_2',
  'Exuberant_Girl',
]);

export type VoiceStatus = 'active' | 'deleted';

export type ClonedVoiceRecord = {
  uid: string;
  custom_voice_id: string;
  character: string;
  project: string;
  cloned_at: string;
  used_in_tts_at: string | null;
  consent_at: string | null;
  sample_sha256: string | null;
  status: VoiceStatus;
  deleted_at: string | null;
};

export function isPresetVoice(voiceId: string): boolean {
  return PRESET_VOICE_IDS.has(voiceId);
}

export function isVoiceTombstoned(
  record: { status?: string; deleted?: boolean } | null | undefined
): boolean {
  if (!record) return false;
  return record.status === 'deleted' || record.deleted === true;
}

/**
 * True → refuse the speech job with 403 before any hold.
 * Preset ids and empty voice_id pass. A custom id must be owned by uid
 * and not tombstoned.
 */
export function speechVoiceOwnershipDenied(opts: {
  voiceId: string;
  uid: string;
  record: { uid: string; status?: string; deleted?: boolean } | null;
}): boolean {
  const voiceId = opts.voiceId.trim();
  if (!voiceId || isPresetVoice(voiceId)) return false;
  if (isVoiceTombstoned(opts.record)) return true;
  return !opts.record || opts.record.uid !== opts.uid;
}

/**
 * Voice a speech-02-hd body selects. Fal reads voice_setting.voice_id only;
 * a top-level voice_id is also checked so ownership never trusts the
 * field Fal ignores (the schema guard rejects it later).
 */
export function speechVoiceId(args: Record<string, unknown>): string {
  const setting = args.voice_setting;
  const nested =
    setting && typeof setting === 'object' ? (setting as Record<string, unknown>).voice_id : undefined;
  for (const value of [nested, args.voice_id]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/** Any existing row (active or tombstone) blocks a new registration of this id. */
export function cloneRegisterDenied(existing: { status?: string } | null): boolean {
  return existing != null;
}

export function voiceDocId(customVoiceId: string): string {
  return Buffer.from(customVoiceId, 'utf8').toString('base64url');
}

export function extractCustomVoiceId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const rec = payload as Record<string, unknown>;
  for (const key of ['custom_voice_id', 'voice_id']) {
    const value = rec[key];
    if (typeof value === 'string' && value.trim() && !isPresetVoice(value.trim())) {
      return value.trim();
    }
  }
  for (const key of ['data', 'output', 'result']) {
    const found = extractCustomVoiceId(rec[key]);
    if (found) return found;
  }
  return null;
}

/** Unused clone whose Fal 7-day window ends within 24h. Already-expired rows are not counted. */
export function expiresWithin1Day(
  row: Pick<ClonedVoiceRecord, 'cloned_at' | 'used_in_tts_at'> & { status?: string },
  nowMs: number
): boolean {
  if (isVoiceTombstoned(row) || row.used_in_tts_at) return false;
  const cloned = Date.parse(row.cloned_at);
  if (!Number.isFinite(cloned)) return false;
  const left = cloned + VOICE_RETAIN_MS - nowMs;
  return left > 0 && left <= VOICE_EXPIRE_WARN_MS;
}

export function countVoiceStats(
  rows: Iterable<Pick<ClonedVoiceRecord, 'cloned_at' | 'used_in_tts_at'> & { status?: string }>,
  nowMs: number
) {
  let cloned = 0;
  let expiringWithin1Day = 0;
  for (const row of rows) {
    if (isVoiceTombstoned(row)) continue;
    cloned += 1;
    if (expiresWithin1Day(row, nowMs)) expiringWithin1Day += 1;
  }
  return { cloned, expiringWithin1Day };
}

export function parseClonedVoice(data: unknown): ClonedVoiceRecord | null {
  if (!data || typeof data !== 'object') return null;
  const rec = data as Record<string, unknown>;
  if (typeof rec.uid !== 'string' || typeof rec.custom_voice_id !== 'string') return null;
  return {
    uid: rec.uid,
    custom_voice_id: rec.custom_voice_id,
    character: typeof rec.character === 'string' ? rec.character : '',
    project: typeof rec.project === 'string' ? rec.project : '',
    cloned_at: typeof rec.cloned_at === 'string' ? rec.cloned_at : '',
    used_in_tts_at: typeof rec.used_in_tts_at === 'string' ? rec.used_in_tts_at : null,
    consent_at: typeof rec.consent_at === 'string' ? rec.consent_at : null,
    sample_sha256: typeof rec.sample_sha256 === 'string' ? rec.sample_sha256 : null,
    status: rec.status === 'deleted' || rec.deleted === true ? 'deleted' : 'active',
    deleted_at: typeof rec.deleted_at === 'string' ? rec.deleted_at : null,
  };
}

/** cloned_voices row -> the doc shape parseClonedVoice reads (uid, not user_id). */
function voiceRowToDoc(row: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!row) return undefined;
  return { ...row, uid: row.user_id };
}

export async function readClonedVoice(customVoiceId: string): Promise<ClonedVoiceRecord | null> {
  const rows = await sql`select * from cloned_voices where id = ${voiceDocId(customVoiceId)}`;
  return parseClonedVoice(voiceRowToDoc(rows[0] as Record<string, unknown> | undefined));
}

export async function listClonedVoicesForUid(uid: string): Promise<ClonedVoiceRecord[]> {
  const rows = await sql`select * from cloned_voices where user_id = ${uid}`;
  return rows
    .map((r) => parseClonedVoice(voiceRowToDoc(r as Record<string, unknown>)))
    .filter((r): r is ClonedVoiceRecord => r != null && !isVoiceTombstoned(r));
}

/**
 * ponytail: admin counts scan the table. Ceiling ~10k rows; upgrade to
 * count() + unused+cloned_at range index when that is too slow.
 */
export async function listAllClonedVoices(): Promise<ClonedVoiceRecord[]> {
  const rows = await sql`select * from cloned_voices`;
  return rows
    .map((r) => parseClonedVoice(voiceRowToDoc(r as Record<string, unknown>)))
    .filter((r): r is ClonedVoiceRecord => r != null);
}

export async function recordClonedVoice(
  row: Omit<ClonedVoiceRecord, 'status' | 'deleted_at'>
): Promise<'ok' | 'exists' | 'tombstoned'> {
  const id = voiceDocId(row.custom_voice_id);
  return withTx(async (tx: TxSql) => {
    const existing = await tx`select * from cloned_voices where id = ${id} for update`;
    if (existing.length > 0) {
      const rec = parseClonedVoice(voiceRowToDoc(existing[0] as Record<string, unknown>));
      return isVoiceTombstoned(rec) ? 'tombstoned' : 'exists';
    }
    await tx`
      insert into cloned_voices ${tx({
        id,
        user_id: row.uid,
        custom_voice_id: row.custom_voice_id,
        character: row.character,
        project: row.project,
        cloned_at: row.cloned_at,
        used_in_tts_at: row.used_in_tts_at,
        consent_at: row.consent_at,
        sample_sha256: row.sample_sha256,
        status: 'active',
        deleted_at: null,
      })}
    `;
    return 'ok' as const;
  });
}

export async function markVoiceUsedInTts(customVoiceId: string, uid: string, atIso: string): Promise<void> {
  const id = voiceDocId(customVoiceId);
  await withTx(async (tx: TxSql) => {
    const rows = await tx`select * from cloned_voices where id = ${id} for update`;
    const row = parseClonedVoice(voiceRowToDoc(rows[0] as Record<string, unknown> | undefined));
    if (!row || row.uid !== uid || row.used_in_tts_at || isVoiceTombstoned(row)) return;
    await tx`update cloned_voices set used_in_tts_at = ${atIso} where id = ${id}`;
  });
}

export async function sampleSha256FromAudioUrl(audioUrl: unknown, uid: string): Promise<string | null> {
  const ref = classifyMediaValue(audioUrl);
  if (typeof ref === 'string' || ref.kind !== 'upload') return null;
  const rows = await sql`select user_id, sha256 from drama_uploads where id = ${ref.id}`;
  const data = rows[0] as Record<string, unknown> | undefined;
  if (!data || data.user_id !== uid || typeof data.sha256 !== 'string') return null;
  return data.sha256;
}

export async function deleteClonedVoiceRecord(
  uid: string,
  customVoiceId: string
): Promise<'ok' | 'missing' | 'forbidden'> {
  const id = voiceDocId(customVoiceId);
  return withTx(async (tx: TxSql) => {
    const rows = await tx`select * from cloned_voices where id = ${id} for update`;
    if (rows.length === 0) return 'missing' as const;
    const row = parseClonedVoice(voiceRowToDoc(rows[0] as Record<string, unknown>));
    if (!row || row.uid !== uid) return 'forbidden' as const;
    if (isVoiceTombstoned(row)) return 'ok' as const;
    await tx`update cloned_voices set status = 'deleted', deleted_at = ${new Date().toISOString()} where id = ${id}`;
    return 'ok' as const;
  });
}
