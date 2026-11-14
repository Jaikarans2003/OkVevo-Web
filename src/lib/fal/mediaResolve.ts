/**
 * Server side of media inputs: resolves drama-upload:// ids and Fal output
 * URLs into Fal-fetchable URLs plus the measured MediaContext the rate card
 * meters from. Every failure throws MediaResolveError BEFORE any credit hold.
 */

import { createHash } from 'node:crypto';

import { sql } from '@/lib/db/client';
import { getAdminBucket } from '@/lib/firebase-admin';
import {
  classifyMediaValue,
  MEDIA_ARG_KEYS,
  payloadMediaEntries,
  validateAndBuildMedia,
  type MeasuredMedia,
  type MediaEntry,
} from '@/lib/fal/mediaInputs';
import type { MediaContext } from '@/lib/fal/rateCard';
import { SIGNED_GET_TTL_MS, uploadExpired } from '@/lib/fal/uploads';

export class MediaResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaResolveError';
  }
}

export type ResolvedMedia = {
  /** Args with media values replaced by signed GET / Fal media URLs. */
  falArgs: Record<string, unknown>;
  media: MediaContext;
};

function falIndexId(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

async function resolveUpload(id: string, uid: string): Promise<{ url: string; measured: MeasuredMedia }> {
  const rows = await sql`select * from drama_uploads where id = ${id}`;
  const data = rows[0] as Record<string, unknown> | undefined;
  if (!data) throw new MediaResolveError('unknown upload — upload the file first');
  if (data.user_id !== uid) throw new MediaResolveError('upload belongs to another user');
  const createdAtMs = (data.created_at as Date | undefined)?.getTime();
  if (typeof createdAtMs !== 'number' || uploadExpired(createdAtMs, Date.now())) {
    throw new MediaResolveError('upload expired (7-day retention) — upload it again');
  }
  // Overwrite check: a replaced object has a new generation; never meter or
  // ship bytes that were swapped in after measurement.
  const file = getAdminBucket().file(data.path as string);
  const [meta] = await file.getMetadata().catch(() => [null] as const);
  if (!meta || String(meta.generation) !== String(data.generation)) {
    throw new MediaResolveError('upload was replaced after measurement — upload it again');
  }
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + SIGNED_GET_TTL_MS,
  });
  return {
    url,
    measured: {
      kind: data.kind as MeasuredMedia['kind'],
      seconds: typeof data.duration_seconds === 'number' ? data.duration_seconds : undefined,
      width: typeof data.width === 'number' ? data.width : undefined,
      height: typeof data.height === 'number' ? data.height : undefined,
    },
  };
}

async function resolveFalUrl(url: string): Promise<MeasuredMedia> {
  // A Fal media URL is only trusted when it is a known output of this
  // gateway (fal_media_index, written at settle). The URL itself is the
  // capability, so reuse across users is fine; a FOREIGN url is unknown and
  // rejected.
  const rows = await sql`select * from fal_media_index where id = ${falIndexId(url)}`;
  const data = rows[0] as Record<string, unknown> | undefined;
  if (!data) {
    throw new MediaResolveError(
      'URL is not a known Fal output of this gateway — download it and upload the file instead'
    );
  }
  return {
    kind: data.kind as MeasuredMedia['kind'],
    seconds: typeof data.seconds === 'number' ? data.seconds : undefined,
    width: typeof data.width === 'number' ? data.width : undefined,
    height: typeof data.height === 'number' ? data.height : undefined,
  };
}

export async function resolveMediaArgs(
  endpoint: string,
  args: Record<string, unknown>,
  uid: string
): Promise<ResolvedMedia> {
  const falArgs: Record<string, unknown> = { ...args };
  const entries: MediaEntry[] = [];
  for (const key of Object.keys(MEDIA_ARG_KEYS)) {
    if (!(key in args) || args[key] == null) continue;
    const many = MEDIA_ARG_KEYS[key].endsWith('[]');
    const values: unknown[] = many
      ? Array.isArray(args[key])
        ? (args[key] as unknown[])
        : (() => {
            throw new MediaResolveError(`${key} must be an array`);
          })()
      : [args[key]];
    if (many && values.length === 0) {
      delete falArgs[key];
      continue;
    }
    const urls: string[] = [];
    for (const v of values) {
      const ref = classifyMediaValue(v);
      if (typeof ref === 'string') throw new MediaResolveError(ref);
      if (ref.kind === 'upload') {
        const got = await resolveUpload(ref.id, uid);
        urls.push(got.url);
        entries.push({ key, measured: got.measured });
      } else {
        const measured = await resolveFalUrl(ref.url);
        urls.push(ref.url);
        entries.push({ key, measured });
      }
    }
    falArgs[key] = many ? urls : urls[0];
  }
  const built = validateAndBuildMedia(endpoint, entries, args);
  if ('error' in built) throw new MediaResolveError(built.error);
  return { falArgs, media: built.media };
}

/** Record a settled job's output media so later jobs can reference it by URL. */
export async function indexPayloadMedia(
  endpoint: string,
  payload: unknown,
  submitArgs: Record<string, unknown>,
  uid: string,
  requestId: string
): Promise<void> {
  for (const entry of payloadMediaEntries(endpoint, payload, submitArgs)) {
    await sql`
      insert into fal_media_index ${sql({
        id: falIndexId(entry.url),
        url: entry.url,
        kind: entry.kind,
        seconds: entry.seconds ?? null,
        width: entry.width ?? null,
        height: entry.height ?? null,
        endpoint,
        uid,
        request_id: requestId,
      })}
      on conflict (id) do update set
        url = excluded.url,
        kind = excluded.kind,
        seconds = excluded.seconds,
        width = excluded.width,
        height = excluded.height,
        endpoint = excluded.endpoint,
        uid = excluded.uid,
        request_id = excluded.request_id
    `;
  }
}
