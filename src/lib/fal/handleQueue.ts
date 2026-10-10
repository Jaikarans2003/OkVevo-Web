import { NextRequest, NextResponse } from 'next/server';

import { FieldValue } from 'firebase-admin/firestore';

import { env } from '@/config/env';
import { auth, db } from '@/lib/firebase-admin';
import { isMeterableEndpoint } from '@/lib/fal/allowlist';
import {
  estimateUnitPriceCost,
  falQueueCancel,
  falQueueGet,
  falServerKey,
  getEndpointPricing,
  submitFalQueue,
} from '@/lib/fal/client';
import {
  breakerDecision,
  dailySpendLimitFromEnv,
  killSwitchDisabled,
} from '@/lib/fal/dramaSwitches';
import {
  indexPayloadMedia,
  MediaResolveError,
  resolveMediaArgs,
} from '@/lib/fal/mediaResolve';
import { parseFalQueuePath } from '@/lib/fal/queuePath';
import { applyFalSafetyOff } from '@/lib/fal/safety';
import {
  FAILED_STATUS_HTTP,
  RELEASED_STATUS,
  SETTLED_STATUS_BODY,
} from '@/lib/fal/statusContract';
import { adjustedUsd, quantity, QuantityError } from '@/lib/fal/quantity';
import { pickMediaArgs } from '@/lib/fal/mediaInputs';
import { gatewayIdToken } from '@/lib/gateway/auth';
import {
  DailySpendLimitError,
  InsufficientCreditsError,
  PlanNotActiveError,
  claimFalSubmit,
  IdempotencyConflictError,
  markFalRun,
  patchGatewayJob,
  readGatewayJob,
  rebindGatewayJob,
  reconcileCredits,
  releaseCredits,
  reserveFalRun,
} from '@/lib/gateway/debit';
import { omitUndefined } from '@/lib/gateway/reserve';
import { creditsFromUsd } from '@/lib/gateway/pricing';
import {
  MAX_JOB_CREDITS,
  rateCardEntry,
  resolveRateCard,
  submitPriceGate,
  settleFromSnapshot,
  type MediaContext,
  type PriceSnapshot,
} from '@/lib/fal/rateCard';
import { canonicalBodyHash } from '@/lib/fal/idempotency';
import { sendOpsAlert, utcDay } from '@/lib/ops/alert';
import { firestoreAlertStore } from '@/lib/ops/firestoreAlertStore';
import {
  SPEECH_ENDPOINT,
  VOICE_CLONE_ENDPOINT,
  extractCustomVoiceId,
  isPresetVoice,
  markVoiceUsedInTts,
  readClonedVoice,
  recordClonedVoice,
  sampleSha256FromAudioUrl,
  speechVoiceOwnershipDenied,
} from '@/lib/fal/voiceOwnership';

const SUBMIT_KEYS = [
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
  // speech-02-hd voice selection (harmless absent on other endpoints).
  'voice_id',
  'language_boost',
  'audio_url',
  'model',
] as const;

/**
 * Singular media keys no wired endpoint accepts (schemas use the *_urls
 * arrays or named slots). Rejected before any hold with the right shape named.
 */
const SINGULAR_MEDIA_KEYS = ['video_url'] as const;

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { message } }, { status });
}

function pickSubmitArgs(body: unknown): Record<string, unknown> {
  const rec = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const k of SUBMIT_KEYS) {
    if (k in rec) out[k] = rec[k];
  }
  return out;
}

function proxyUrls(endpoint: string, requestId: string) {
  const base = `${env.siteUrl}/api/gateway/fal/queue/${endpoint}/requests/${requestId}`;
  return {
    request_id: requestId,
    response_url: base,
    status_url: `${base}/status`,
    cancel_url: `${base}/cancel`,
  };
}

async function uidFromRequest(request: NextRequest): Promise<string | null> {
  const token = gatewayIdToken(request);
  if (!token) return null;
  try {
    return (await auth.verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export async function meterRawUsd(opts: {
  endpoint: string;
  unit: string;
  unitPrice: number;
  args: Record<string, unknown>;
  payload?: unknown;
  metrics?: unknown;
  nowMs?: number;
  /** Server-measured reference media (drama rate-card jobs). */
  media?: MediaContext;
  /** Settle passes the stored snapshot and must not re-fetch. */
  snapshot?: PriceSnapshot;
}): Promise<number> {
  if (opts.snapshot) {
    return settleFromSnapshot({
      snapshot: opts.snapshot,
      args: opts.args,
      payload: opts.payload,
      media: opts.media,
      nowMs: opts.nowMs ?? Date.parse(opts.snapshot.fetchedAt),
    });
  }
  if (rateCardEntry(opts.endpoint)) {
    const nowMs = opts.nowMs ?? Date.now();
    const live = isCardOnly(opts.endpoint)
      ? null
      : opts.unitPrice > 0
        ? opts.unitPrice
        : null;
    const resolved = resolveRateCard({
      endpoint: opts.endpoint,
      args: opts.args,
      payload: opts.payload,
      media: opts.media,
      liveUnitPrice: live,
      liveFetchedAtMs: live != null ? nowMs : null,
      nowMs,
    });
    if (resolved.alert) console.error(resolved.alert);
    return resolved.rawUsd;
  }
  const qty = quantity({
    unit: opts.unit,
    endpoint: opts.endpoint,
    args: opts.args,
    payload: opts.payload,
    metrics: opts.metrics,
  });
  const estimated = await estimateUnitPriceCost(opts.endpoint, qty);
  if (estimated != null) return estimated;
  return adjustedUsd({
    endpoint: opts.endpoint,
    args: opts.args,
    unitPrice: opts.unitPrice,
    qty,
  });
}

function isCardOnly(endpoint: string): boolean {
  return rateCardEntry(endpoint)?.source === 'card';
}

export async function settleFalJob(opts: {
  requestId: string;
  ok: boolean;
  payload?: unknown;
  metrics?: unknown;
}): Promise<void> {
  const job = await readGatewayJob(opts.requestId);
  if (!job || (job.status !== 'reserved' && job.status !== 'submitted')) return;
  if (!opts.ok) {
    await releaseCredits(opts.requestId);
    return;
  }
  const endpoint = job.endpoint || '';
  const unit = job.unit || '';
  const unitPrice = job.unitPrice ?? 0;
  const args = job.submitArgs ?? {};
  let actual = job.estimatedCredits;
  try {
    const rawUsd = await meterRawUsd({
      endpoint,
      unit,
      unitPrice,
      args,
      payload: opts.payload,
      metrics: opts.metrics,
      media: job.media,
      snapshot: job.priceSnapshot as PriceSnapshot | undefined,
    });
    actual = Math.min(creditsFromUsd(rawUsd).credits, job.estimatedCredits);
    if (creditsFromUsd(rawUsd).credits > job.estimatedCredits) {
      // Formula landed above the reserve: the user is never charged more
      // than approved — OkVevo absorbs the difference and flags it.
      const day = utcDay(Date.now());
      await sendOpsAlert(
        {
          severity: 'HIGH',
          condition: 'fal-over-reserve',
          id: opts.requestId,
          text: `settle formula ${creditsFromUsd(rawUsd).credits} credits exceeds reserve ${job.estimatedCredits} on ${endpoint}; absorbed`,
        },
        { nowMs: Date.now(), store: firestoreAlertStore(db) }
      );
      await db.doc(`spendDaily/${day}`).set(
        { overReserveEvents: FieldValue.increment(1) },
        { merge: true }
      );
    }
    await reconcileCredits({
      requestId: opts.requestId,
      actualCredits: actual,
      provider: 'fal',
      model: endpoint,
      costUsd: creditsFromUsd(rawUsd).costUsd,
      priceUsd: rawUsd,
    });
    await closeFalSpendHold(job, rawUsd, actual);
    await patchGatewayJob(opts.requestId, {
      settledAt: FieldValue.serverTimestamp(),
      settledCredits: actual,
      settledFalUsd: rawUsd,
    });
    if (rateCardEntry(endpoint) && opts.payload !== undefined) {
      await indexPayloadMedia(endpoint, opts.payload, args, job.uid, opts.requestId);
    }
  } catch (err) {
    if (err instanceof QuantityError) {
      console.error('fal settle quantity failed, keeping estimate', err);
      await reconcileCredits({
        requestId: opts.requestId,
        actualCredits: actual,
        provider: 'fal',
        model: endpoint,
      });
      await closeFalSpendHold(job, 0, actual);
    } else {
      throw err;
    }
  }
  try {
    await persistVoiceOwnership(job.uid, endpoint, args, opts.payload, job);
  } catch (err) {
    console.error('fal voice ownership persist failed', err);
    await sendOpsAlert(
      {
        severity: 'HIGH',
        condition: 'voice-record-failed',
        id: opts.requestId,
        text: `settled ${endpoint} but clonedVoices write failed`,
      },
      { nowMs: Date.now(), store: firestoreAlertStore(db) }
    );
  }
  if (opts.payload !== undefined) {
    await patchGatewayJob(opts.requestId, { payload: opts.payload });
  }
}

async function persistVoiceOwnership(
  uid: string,
  endpoint: string,
  args: Record<string, unknown>,
  payload: unknown,
  job: {
    character?: string;
    project?: string;
    consentAt?: string;
    sampleSha256?: string;
  }
): Promise<void> {
  if (endpoint === VOICE_CLONE_ENDPOINT) {
    const customVoiceId = extractCustomVoiceId(payload);
    if (!customVoiceId) return;
    const recorded = await recordClonedVoice({
      uid,
      custom_voice_id: customVoiceId,
      character: job.character ?? '',
      project: job.project ?? '',
      cloned_at: new Date().toISOString(),
      used_in_tts_at: null,
      consent_at: job.consentAt ?? null,
      sample_sha256: job.sampleSha256 ?? null,
    });
    if (recorded === 'tombstoned') {
      throw new Error('custom_voice_id is tombstoned and cannot be registered again');
    }
    return;
  }
  if (endpoint === SPEECH_ENDPOINT) {
    const voiceId = typeof args.voice_id === 'string' ? args.voice_id.trim() : '';
    if (!voiceId || isPresetVoice(voiceId)) return;
    await markVoiceUsedInTts(voiceId, uid, new Date().toISOString());
  }
}

function falStatusOf(json: unknown): string {
  const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  return String(rec.status ?? '').toUpperCase();
}

/** Kill-switch doc cache — a toggle takes effect within a minute, no deploy. */
let killCache = { atMs: 0, disabled: false };
async function dramaKillSwitchDisabled(nowMs: number): Promise<boolean> {
  if (nowMs - killCache.atMs < 60_000) return killCache.disabled;
  const snap = await db.doc('opsConfig/drama').get();
  killCache = { atMs: nowMs, disabled: killSwitchDisabled(snap.data()) };
  return killCache.disabled;
}

async function closeFalSpendHold(
  job: { reservedFalUsd?: number; spendDay?: string },
  settledRawUsd: number,
  actualCredits: number
): Promise<void> {
  const reserved = Number(job.reservedFalUsd ?? 0);
  const day = job.spendDay || utcDay(Date.now());
  await db.doc(`spendDaily/${day}`).set(
    omitUndefined({
      falUsd: FieldValue.increment(settledRawUsd),
      falUsdHeld: reserved > 0 ? FieldValue.increment(-reserved) : undefined,
      creditsCharged: FieldValue.increment(actualCredits),
      jobs: FieldValue.increment(1),
    }),
    { merge: true }
  );
}

async function handleSubmit(
  uid: string,
  endpoint: string,
  body: unknown
): Promise<Response> {
  if (!isMeterableEndpoint(endpoint)) {
    return jsonError(400, `Fal endpoint is not meterable on the OkVevo gateway: ${endpoint}`);
  }
  if (!falServerKey()) {
    return jsonError(500, 'FAL_KEY missing');
  }
  const card = rateCardEntry(endpoint);
  const pricing = card?.source === 'card' ? null : await getEndpointPricing(endpoint);
  if (!card && !pricing) {
    return jsonError(502, 'Fal pricing unavailable');
  }
  const args = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const nowMs = Date.now();
  const day = utcDay(nowMs);
  const limitUsd = dailySpendLimitFromEnv(process.env);
  if (await dramaKillSwitchDisabled(nowMs)) {
    return jsonError(503, 'generation is temporarily disabled');
  }

  if (card && SINGULAR_MEDIA_KEYS.some((key) => args[key] != null)) {
    return jsonError(400, 'use the *_urls array media keys on a reference-to-video endpoint');
  }
  if (card && args.audio_url != null && endpoint !== VOICE_CLONE_ENDPOINT) {
    return jsonError(
      400,
      endpoint === SPEECH_ENDPOINT
        ? 'clone the voice first with fal-ai/minimax/voice-clone, then pass custom_voice_id as voice_id'
        : 'audio_url is only valid on fal-ai/minimax/voice-clone'
    );
  }

  // Custom voice_id is a capability on OkVevo's Fal account. Refuse before
  // any hold when the requesting uid does not own the clone record.
  if (endpoint === SPEECH_ENDPOINT) {
    const voiceId = typeof args.voice_id === 'string' ? args.voice_id.trim() : '';
    if (voiceId && !isPresetVoice(voiceId)) {
      const owned = await readClonedVoice(voiceId);
      if (speechVoiceOwnershipDenied({ voiceId, uid, record: owned })) {
        return jsonError(403, 'custom voice_id is not owned by this account');
      }
    }
  }

  // Media references (drama-upload:// / Fal output URLs) resolve to Fal-
  // fetchable URLs + the measured MediaContext BEFORE any hold.
  let falBody = args;
  let media: MediaContext | undefined;
  if (card) {
    try {
      const resolved = await resolveMediaArgs(endpoint, args, uid);
      falBody = resolved.falArgs;
      media = resolved.media;
    } catch (err) {
      if (err instanceof MediaResolveError) return jsonError(400, err.message);
      throw err;
    }
  }

  const submitArgs = pickSubmitArgs(falBody);
  const mediaArgs = pickMediaArgs(falBody);
  const runId = typeof args.run_id === 'string' ? args.run_id.trim() : '';
  const approved =
    typeof args.approved_credits === 'number' ? args.approved_credits : null;
  let rawUsd: number;
  let snapshot: PriceSnapshot | undefined;
  try {
    if (rateCardEntry(endpoint)) {
      const live = isCardOnly(endpoint) ? null : pricing?.unitPrice ?? null;
      const resolved = resolveRateCard({
        endpoint,
        args: submitArgs,
        media,
        liveUnitPrice: live,
        liveFetchedAtMs: live != null ? nowMs : null,
        nowMs,
      });
      if (resolved.alert) console.error(resolved.alert);
      rawUsd = resolved.rawUsd;
      snapshot = resolved.snapshot;
    } else {
      if (!pricing) return jsonError(502, 'Fal pricing unavailable');
      rawUsd = await meterRawUsd({
        endpoint,
        unit: pricing.unit,
        unitPrice: pricing.unitPrice,
        args: submitArgs,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'cannot meter this request';
    return jsonError(400, msg);
  }
  const estimated = creditsFromUsd(rawUsd).credits;
  if (!(rawUsd > 0) || estimated <= 0) {
    return jsonError(400, 'unpriced Fal request — estimate is not a positive price');
  }
  // Warn from settled + in-flight holds + this job. Stop is re-checked
  // inside the reserve transaction so two concurrent submits cannot both pass.
  const spendSnap = await db.doc(`spendDaily/${day}`).get();
  const spendUsd =
    Number(spendSnap.data()?.falUsd ?? 0) +
    Number(spendSnap.data()?.falUsdHeld ?? 0) +
    rawUsd;
  const warnDecision = breakerDecision(spendUsd, limitUsd);
  if (warnDecision !== 'ok') {
    await sendOpsAlert(
      {
        severity: 'HIGH',
        condition: warnDecision === 'stop' ? 'circuit-breaker' : 'circuit-breaker-80',
        id: day,
        text:
          warnDecision === 'stop'
            ? `daily Fal spend $${spendUsd.toFixed(2)} reached the $${limitUsd} limit; new submits refused`
            : `daily Fal spend $${spendUsd.toFixed(2)} at 80% of the $${limitUsd} limit`,
      },
      { nowMs, store: firestoreAlertStore(db) }
    );
    if (warnDecision === 'stop') {
      return jsonError(429, 'daily Fal spend limit reached — new jobs resume next UTC day');
    }
  }
  if (estimated > MAX_JOB_CREDITS) {
    return jsonError(400, `job exceeds MAX_JOB_CREDITS (${MAX_JOB_CREDITS})`);
  }
  // Pure approval gate, before any reserve: a refusal here can leave no hold.
  const gate = submitPriceGate(estimated, approved, runId);
  if (gate === 'price_exceeded') {
    return jsonError(409, 'price is higher than the approved estimate; confirm again');
  }
  if (gate === 'approved_required') {
    return jsonError(400, 'run_id and approved_credits are required for every metered submit');
  }
  const bodyHash = canonicalBodyHash({ endpoint, submitArgs, mediaArgs, runId });
  const extra = omitUndefined({
    endpoint,
    unit: snapshot?.unit ?? pricing?.unit,
    unitPrice: snapshot?.unitPrice ?? pricing?.unitPrice,
    submitArgs,
    media,
    priceSnapshot: snapshot,
    reservedFalUsd: rawUsd,
    spendDay: day,
    spendLimitUsd: limitUsd,
    character: typeof args.character === 'string' ? args.character.trim().slice(0, 80) : undefined,
    project: typeof args.project === 'string' ? args.project.trim().slice(0, 80) : undefined,
    consentAt:
      args.voice_clone_consent === true ? new Date(nowMs).toISOString() : undefined,
    sampleSha256: (await sampleSha256FromAudioUrl(args.audio_url, uid)) ?? undefined,
  });
  let holdId: string;
  try {
    const reserved = await reserveFalRun({
      uid,
      runId,
      bodyHash,
      estimatedCredits: estimated,
      extra,
    });
    if (reserved.kind === 'replay' && reserved.falRequestId) {
      return NextResponse.json(proxyUrls(endpoint, reserved.falRequestId));
    }
    if (reserved.kind === 'unknown') {
      return jsonError(202, 'Fal submit outcome unknown; hold kept, not resubmitted');
    }
    holdId = reserved.holdId;
    const claimed = await claimFalSubmit(uid, runId);
    if (!claimed) {
      return jsonError(202, 'Fal submit already in progress for this run');
    }
  } catch (err) {
    if (err instanceof PlanNotActiveError) {
      return jsonError(403, 'plan not active');
    }
    if (err instanceof InsufficientCreditsError) {
      return jsonError(402, 'insufficient credits');
    }
    if (err instanceof IdempotencyConflictError) {
      return jsonError(409, 'idempotency conflict');
    }
    if (err instanceof DailySpendLimitError) {
      return jsonError(429, 'daily Fal spend limit reached — new jobs resume next UTC day');
    }
    throw err;
  }

  try {
    const submitted = await submitFalQueue(
      endpoint,
      applyFalSafetyOff(endpoint, { ...submitArgs, ...mediaArgs })
    );
    await rebindGatewayJob(holdId, submitted.request_id);
    await patchGatewayJob(submitted.request_id, {
      status: 'submitted',
      falStatusUrl: submitted.status_url,
      falResponseUrl: submitted.response_url,
      falCancelUrl: submitted.cancel_url,
      priceSnapshot: snapshot,
    });
    if (runId) {
      await markFalRun(uid, runId, { phase: 'submitted', falRequestId: submitted.request_id });
    }
    return NextResponse.json(proxyUrls(endpoint, submitted.request_id));
  } catch (err) {
    console.error('fal submit failed', err);
    const msg = err instanceof Error ? err.message : '';
    const http = /^fal submit (\d+)/.exec(msg);
    const code = http ? Number(http[1]) : 0;
    if (code >= 400 && code < 500) {
      await releaseCredits(holdId);
      if (runId) await markFalRun(uid, runId, { phase: 'released' });
      return jsonError(502, 'Fal submit failed');
    }
    await patchGatewayJob(holdId, { status: 'unknown' });
    if (runId) await markFalRun(uid, runId, { phase: 'unknown' });
    return jsonError(502, 'Fal submit outcome unknown; hold kept, not resubmitted');
  }
}

async function handleStatus(uid: string, requestId: string): Promise<Response> {
  const job = await readGatewayJob(requestId);
  if (!job || job.uid !== uid) return jsonError(404, 'unknown Fal job');

  if (job.status === 'released') {
    // See statusContract.ts: cancelled is HTTP 499, never a status JSON.
    return jsonError(RELEASED_STATUS.http, RELEASED_STATUS.message);
  }

  if (job.status === 'settled' && job.payload !== undefined) {
    return NextResponse.json(SETTLED_STATUS_BODY);
  }

  const url = job.falStatusUrl;
  if (!url) return jsonError(502, 'missing Fal status url');
  const { status, json } = await falQueueGet(url);
  if (status >= 500) {
    console.error('fal status upstream', status, falStatusOf(json));
    return jsonError(502, 'Fal status unavailable');
  }
  const falStatus = falStatusOf(json);
  if (falStatus === 'COMPLETED' && (job.status === 'reserved' || job.status === 'submitted')) {
    let payload: unknown = job.payload;
    if (job.falResponseUrl) {
      const got = await falQueueGet(job.falResponseUrl);
      payload = got.json;
    }
    await settleFalJob({
      requestId,
      ok: true,
      payload,
      metrics: asRecord(json)?.metrics,
    });
  }
  if (falStatus === 'FAILED' || falStatus === 'ERROR') {
    await settleFalJob({ requestId, ok: false });
    if (status >= 200 && status < 300) {
      // FAILED/ERROR is not a status fal_client._parse_status accepts — never
      // proxy it with a 2xx or the SDK poller dies on ValueError. Surface it
      // as an HTTP error so the tool gets a clean raise (statusContract.ts).
      return jsonError(FAILED_STATUS_HTTP, `Fal job ${falStatus.toLowerCase()}`);
    }
  }
  return NextResponse.json(json, { status });
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

async function handleResponse(uid: string, requestId: string): Promise<Response> {
  const job = await readGatewayJob(requestId);
  if (!job || job.uid !== uid) return jsonError(404, 'unknown Fal job');
  if (job.payload !== undefined) {
    return NextResponse.json(job.payload);
  }
  if (!job.falResponseUrl) return jsonError(502, 'missing Fal response url');
  const { status, json } = await falQueueGet(job.falResponseUrl);
  if (status >= 200 && status < 300 && job.status === 'reserved') {
    await settleFalJob({ requestId, ok: true, payload: json });
  }
  return NextResponse.json(json, { status });
}

async function handleCancel(uid: string, requestId: string): Promise<Response> {
  const job = await readGatewayJob(requestId);
  if (!job || job.uid !== uid) return jsonError(404, 'unknown Fal job');
  await settleFalJob({ requestId, ok: false });
  if (job.falCancelUrl) {
    const status = await falQueueCancel(job.falCancelUrl);
    return NextResponse.json({ ok: true }, { status: status >= 400 ? status : 200 });
  }
  return NextResponse.json({ ok: true });
}

export async function handleFalQueue(
  request: NextRequest,
  path: string[]
): Promise<Response> {
  const uid = await uidFromRequest(request);
  if (!uid) {
    return jsonError(401, 'invalid_token');
  }

  let parsed;
  try {
    parsed = parseFalQueuePath(path);
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'bad path');
  }

  try {
    if (parsed.kind === 'submit') {
      if (request.method !== 'POST') return jsonError(405, 'method not allowed');
      let body: unknown = {};
      try {
        const text = await request.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        return jsonError(400, 'invalid json');
      }
      return await handleSubmit(uid, parsed.endpoint, body);
    }

    if (parsed.kind === 'status' && request.method === 'GET') {
      return await handleStatus(uid, parsed.requestId);
    }
    if (parsed.kind === 'response' && request.method === 'GET') {
      return await handleResponse(uid, parsed.requestId);
    }
    if (parsed.kind === 'cancel' && (request.method === 'PUT' || request.method === 'POST')) {
      return await handleCancel(uid, parsed.requestId);
    }
    return jsonError(405, 'method not allowed');
  } catch (err) {
    console.error('fal queue failed', parsed.kind, err);
    const msg = err instanceof Error ? err.message : 'Fal queue failed';
    return jsonError(502, msg);
  }
}
