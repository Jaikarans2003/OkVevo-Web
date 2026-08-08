/**
 * Sarvam Batch STT (saaras:v4 translit) via raw fetch.
 * Gate 3 (2026-08-08, job 20260808_bf7c45af-…): live Batch returns
 * timestamps.words + start_time_seconds + end_time_seconds (phrase-level).
 * Official docs still document timestamps.chunks — accept both; prefer chunks.
 */
import fs from 'fs';
import path from 'path';

const BASE = 'https://api.sarvam.ai';
const POLL_MS = 5000;
const MAX_POLLS = 120;

export type SarvamPhrase = { text: string; start: number; end: number };

export type SarvamBatchErrorKind = 'transient' | 'permanent' | 'missing_timestamps';

export class SarvamBatchError extends Error {
  kind: SarvamBatchErrorKind;
  status?: number;

  constructor(message: string, kind: SarvamBatchErrorKind, status?: number) {
    super(message);
    this.name = 'SarvamBatchError';
    this.kind = kind;
    this.status = status;
  }
}

type UploadUrls = Record<string, { file_url?: string } | string> | Array<{ file_url?: string; url?: string } | string>;

function apiKey(): string {
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) {
    throw new SarvamBatchError('SARVAM_API_KEY is not set', 'permanent');
  }
  return key;
}

function classifyStatus(status: number): SarvamBatchErrorKind {
  if (status === 429 || status === 500 || status === 502 || status === 503) return 'transient';
  return 'permanent';
}

async function sarvamJson<T>(
  method: string,
  urlPath: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    'api-subscription-key': apiKey(),
  };
  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${urlPath}`, { method, headers, body: payload });
  } catch (err: unknown) {
    throw new SarvamBatchError(
      `Sarvam network error: ${err instanceof Error ? err.message : String(err)}`,
      'transient'
    );
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    throw new SarvamBatchError(
      `Sarvam ${method} ${urlPath} → ${res.status}: ${text.slice(0, 400)}`,
      classifyStatus(res.status),
      res.status
    );
  }
  return parsed as T;
}

function firstFileUrl(container: UploadUrls | undefined): string | undefined {
  if (!container) return undefined;
  if (Array.isArray(container)) {
    for (const item of container) {
      if (typeof item === 'string' && item) return item;
      if (item && typeof item === 'object') {
        const u = item.file_url ?? item.url;
        if (u) return u;
      }
    }
    return undefined;
  }
  for (const v of Object.values(container)) {
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object' && typeof v.file_url === 'string') return v.file_url;
  }
  return undefined;
}

function contentTypeForAudio(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.flac':
      return 'audio/flac';
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    default:
      return 'application/octet-stream';
  }
}

/** Normalize Batch (or REST-shaped) timestamps into phrase spans. */
export function parseSarvamTimestamps(raw: unknown): SarvamPhrase[] {
  if (!raw || typeof raw !== 'object') {
    throw new SarvamBatchError('Sarvam response missing timestamps object', 'missing_timestamps');
  }
  const ts = raw as Record<string, unknown>;
  // Prefer documented Batch key; Gate 3 live v4 used `words` for the same phrase arrays.
  const textsRaw = Array.isArray(ts.chunks)
    ? ts.chunks
    : Array.isArray(ts.words)
      ? ts.words
      : null;
  const starts = ts.start_time_seconds;
  const ends = ts.end_time_seconds;
  if (!textsRaw || !Array.isArray(starts) || !Array.isArray(ends)) {
    throw new SarvamBatchError(
      'Sarvam timestamps missing chunks/words + start/end arrays',
      'missing_timestamps'
    );
  }
  if (textsRaw.length === 0) {
    throw new SarvamBatchError('Sarvam timestamps empty', 'missing_timestamps');
  }
  if (textsRaw.length !== starts.length || textsRaw.length !== ends.length) {
    throw new SarvamBatchError(
      `Sarvam timestamp length mismatch texts=${textsRaw.length} starts=${starts.length} ends=${ends.length}`,
      'missing_timestamps'
    );
  }
  const out: SarvamPhrase[] = [];
  for (let i = 0; i < textsRaw.length; i++) {
    const text = textsRaw[i];
    const start = starts[i];
    const end = ends[i];
    if (typeof text !== 'string' || typeof start !== 'number' || typeof end !== 'number') {
      throw new SarvamBatchError(`Sarvam timestamp entry ${i} malformed`, 'missing_timestamps');
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      throw new SarvamBatchError(`Sarvam timestamp entry ${i} bad range`, 'missing_timestamps');
    }
    out.push({ text, start, end });
  }
  return out;
}

async function putAudio(uploadUrl: string, filePath: string): Promise<void> {
  const bytes = fs.readFileSync(filePath);
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentTypeForAudio(filePath),
        'x-ms-blob-type': 'BlockBlob',
      },
      body: bytes,
    });
  } catch (err: unknown) {
    throw new SarvamBatchError(
      `Sarvam upload PUT network error: ${err instanceof Error ? err.message : String(err)}`,
      'transient'
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new SarvamBatchError(
      `Sarvam upload PUT → ${res.status}: ${text.slice(0, 300)}`,
      classifyStatus(res.status),
      res.status
    );
  }
}

export type SarvamTranslitBatchResult = {
  phrases: SarvamPhrase[];
  /** Raw download-files JSON body (for Storage debug). */
  raw: unknown;
};

/**
 * One Batch job: create → upload → start → poll → download-files → parse phrases.
 */
export async function runSarvamTranslitBatch(
  audioPath: string
): Promise<SarvamTranslitBatchResult> {
  if (!fs.existsSync(audioPath)) {
    throw new SarvamBatchError(`Audio not found: ${audioPath}`, 'permanent');
  }
  const fileName = path.basename(audioPath);

  const created = await sarvamJson<{ job_id?: string }>('POST', '/speech-to-text/job/v1', {
    job_parameters: {
      model: 'saaras:v4',
      mode: 'translit',
      with_timestamps: true,
      language_code: 'unknown',
    },
  });
  const jobId = created.job_id;
  if (!jobId) {
    throw new SarvamBatchError('Sarvam create job missing job_id', 'permanent');
  }

  const uploadMeta = await sarvamJson<{ upload_urls?: UploadUrls }>(
    'POST',
    '/speech-to-text/job/v1/upload-files',
    { job_id: jobId, files: [fileName] }
  );
  const putUrl = firstFileUrl(uploadMeta.upload_urls);
  if (!putUrl) {
    throw new SarvamBatchError('Sarvam upload-files missing upload URL', 'permanent');
  }
  await putAudio(putUrl, audioPath);

  await sarvamJson('POST', `/speech-to-text/job/v1/${jobId}/start`, {});

  let status: {
    job_state?: string;
    error_message?: string;
    job_details?: { outputs?: { file_name?: string }[] }[];
  } | null = null;
  for (let i = 0; i < MAX_POLLS; i++) {
    const polled = await sarvamJson<{
      job_state?: string;
      error_message?: string;
      job_details?: { outputs?: { file_name?: string }[] }[];
    }>('GET', `/speech-to-text/job/v1/${jobId}/status`);
    status = polled;
    const state = polled.job_state;
    if (state === 'Completed' || state === 'PartiallyCompleted') break;
    if (state === 'Failed') {
      throw new SarvamBatchError(
        `Sarvam job Failed: ${polled.error_message ?? '(no message)'}`,
        'permanent'
      );
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  if (
    !status ||
    (status.job_state !== 'Completed' && status.job_state !== 'PartiallyCompleted')
  ) {
    throw new SarvamBatchError(
      `Sarvam job timed out (last state=${status?.job_state ?? 'unknown'})`,
      'transient'
    );
  }

  const completed = status;
  const files: string[] = [];
  for (const d of completed.job_details ?? []) {
    for (const o of d.outputs ?? []) {
      if (o.file_name) files.push(o.file_name);
    }
  }
  if (files.length === 0) files.push('0.json');

  const dl = await sarvamJson<{ download_urls?: UploadUrls }>(
    'POST',
    '/speech-to-text/job/v1/download-files',
    { job_id: jobId, files }
  );
  const getUrl = firstFileUrl(dl.download_urls);
  if (!getUrl) {
    throw new SarvamBatchError('Sarvam download-files missing URL', 'permanent');
  }

  let bodyText: string;
  try {
    const res = await fetch(getUrl);
    if (!res.ok) {
      throw new SarvamBatchError(
        `Sarvam result GET → ${res.status}`,
        classifyStatus(res.status),
        res.status
      );
    }
    bodyText = await res.text();
  } catch (err: unknown) {
    if (err instanceof SarvamBatchError) throw err;
    throw new SarvamBatchError(
      `Sarvam result download failed: ${err instanceof Error ? err.message : String(err)}`,
      'transient'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new SarvamBatchError('Sarvam result JSON parse failed', 'permanent');
  }
  const rec = parsed as { timestamps?: unknown };
  return {
    phrases: parseSarvamTimestamps(rec.timestamps),
    raw: parsed,
  };
}
