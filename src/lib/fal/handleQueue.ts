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
import { freeSlot, takeNextQueued } from '@/lib/fal/dispatch';
import {
  FAL_ACCOUNT_CONCURRENCY_NEW,
  FAL_ACCOUNT_CONCURRENCY_SELF_SERVE_MAX,
  dailySpendAlertUsd,
  parseQueue,
  PLAN_SLOTS,
  QUEUE_CAP,
  QueueFullError,
  slotWaitMessage,
  slotsForPlan,
  spendAlertCrossed,
} from '@/lib/fal/falQueue';
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
import { clientRequestHash, pickSubmitArgs } from '@/lib/fal/idempotency';
import { gatewayIdToken } from '@/lib/gateway/auth';
import {
  InsufficientCreditsError,
  PlanNotActiveError,
  claimFalSubmit,
  IdempotencyConflictError,
  markFalRun,
  patchGatewayJob,
  peekFalRun,
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

/**
 * Singular media keys no wired endpoint accepts (schemas use the *_urls
 * arrays or named slots). Rejected before any hold with the right shape named.
 */
const SINGULAR_MEDIA_KEYS = ['video_url'] as const;

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: { message } }, { status });
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
  const requestId = job.id;
  if (!opts.ok) {
    await releaseCredits(requestId);
    await finishSlot(job.uid, job.holdId || requestId);
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
      requestId,
      actualCredits: actual,
      provider: 'fal',
      model: endpoint,
      costUsd: creditsFromUsd(rawUsd).costUsd,
      priceUsd: rawUsd,
    });
    await patchGatewayJob(requestId, {
      settledAt: FieldValue.serverTimestamp(),
      settledCredits: actual,
      settledFalUsd: rawUsd,
    });
    if (rateCardEntry(endpoint) && opts.payload !== undefined) {
      await indexPayloadMedia(endpoint, opts.payload, args, job.uid, requestId);
    }
  } catch (err) {
    if (err instanceof QuantityError) {
      console.error('fal settle quantity failed, keeping estimate', err);
      await reconcileCredits({
        requestId,
        actualCredits: actual,
        provider: 'fal',
        model: endpoint,
      });
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
        id: requestId,
        text: `settled ${endpoint} but clonedVoices write failed`,
      },
      { nowMs: Date.now(), store: firestoreAlertStore(db) }
    );
  }
  if (opts.payload !== undefined) {
    await patchGatewayJob(requestId, { payload: opts.payload });
  }
  await finishSlot(job.uid, job.holdId || requestId);
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

async function slotView(uid: string, holdId: string) {
  const [userSnap, queueSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('falQueue').doc(uid).get(),
  ]);
  const decision = slotsForPlan(userSnap.data()?.plan, userSnap.data()?.planStatus);
  const queue = parseQueue(queueSnap.data());
  const queuedAt = queue.queued.indexOf(holdId);
  const running = queue.running.includes(holdId) || queuedAt < 0;
  return {
    slotsInUse: queue.running.length,
    slotsLimit: decision.admit ? decision.slots : 0,
    queuePosition: queuedAt >= 0 ? queuedAt + 1 : 0,
    state: (queuedAt >= 0 ? 'queued' : running ? 'running' : 'done') as 'queued' | 'running' | 'done',
  };
}

function withSlot(
  body: Record<string, unknown>,
  slot: { slotsInUse: number; slotsLimit: number; queuePosition: number; state: 'queued' | 'running' | 'done' }
) {
  return {
    ...body,
    state: slot.state,
    queue_position: slot.queuePosition,
    slots_in_use: slot.slotsInUse,
    slots_limit: slot.slotsLimit,
    ...(slot.state === 'queued'
      ? { message: slotWaitMessage(slot.slotsInUse, slot.slotsLimit) }
      : {}),
  };
}

async function finishSlot(uid: string, holdId: string) {
  await freeSlot(uid, holdId);
  await dispatchQueued(uid);
}

type SubmitOutcome =
  | { ok: true; requestId: string }
  | { ok: false; status: number; message: string };

async function submitReservedHold(
  uid: string,
  runId: string,
  holdId: string,
  keepHoldId: boolean,
  follow: boolean
): Promise<SubmitOutcome> {
  const claimed = await claimFalSubmit(uid, runId);
  if (!claimed) return { ok: false, status: 202, message: 'Fal submit already in progress for this run' };
  const job = await readGatewayJob(holdId);
  const endpoint = job?.endpoint || '';
  const falBody = job?.falBody;
  if (!job || !endpoint || !falBody) {
    await patchGatewayJob(holdId, { status: 'unknown' });
    await markFalRun(uid, runId, { phase: 'unknown' });
    return { ok: false, status: 502, message: 'Fal submit outcome unknown; hold kept, not resubmitted' };
  }
  try {
    const submitted = await submitFalQueue(endpoint, falBody);
    if (keepHoldId) {
      await db.collection('gatewayJobs').doc(submitted.request_id).set({ aliasOf: holdId, uid });
      await patchGatewayJob(holdId, {
        status: 'submitted',
        falRequestId: submitted.request_id,
        falStatusUrl: submitted.status_url,
        falResponseUrl: submitted.response_url,
        falCancelUrl: submitted.cancel_url,
      });
    } else {
      await rebindGatewayJob(holdId, submitted.request_id);
      await patchGatewayJob(submitted.request_id, {
        status: 'submitted',
        falRequestId: submitted.request_id,
        falStatusUrl: submitted.status_url,
        falResponseUrl: submitted.response_url,
        falCancelUrl: submitted.cancel_url,
      });
    }
    await markFalRun(uid, runId, { phase: 'submitted', falRequestId: submitted.request_id });
    return { ok: true, requestId: keepHoldId ? holdId : submitted.request_id };
  } catch (err) {
    console.error('fal submit failed', err);
    const msg = err instanceof Error ? err.message : '';
    const code = Number(/^fal submit (\d+)/.exec(msg)?.[1] ?? 0);
    if (code === 429) {
      await sendOpsAlert(
        {
          severity: 'HIGH',
          condition: 'fal-429',
          id: holdId,
          text: `Fal returned 429 for ${endpoint}. Account concurrency starts at ${FAL_ACCOUNT_CONCURRENCY_NEW} and scales to ${FAL_ACCOUNT_CONCURRENCY_SELF_SERVE_MAX}. Fal queues the overflow. Hold kept, not resubmitted.`,
        },
        { nowMs: Date.now(), store: firestoreAlertStore(db) }
      );
      await patchGatewayJob(holdId, { status: 'unknown' });
      await markFalRun(uid, runId, { phase: 'unknown' });
      return { ok: false, status: 502, message: 'Fal is busy; hold kept, not resubmitted' };
    }
    if (code >= 400 && code < 500) {
      await releaseCredits(holdId);
      await markFalRun(uid, runId, { phase: 'released' });
      await freeSlot(uid, holdId);
      if (follow) await dispatchQueued(uid);
      return { ok: false, status: 502, message: 'Fal submit failed' };
    }
    await patchGatewayJob(holdId, { status: 'unknown' });
    await markFalRun(uid, runId, { phase: 'unknown' });
    return { ok: false, status: 502, message: 'Fal submit outcome unknown; hold kept, not resubmitted' };
  }
}

/** Start queued holds up to the live plan limit. Idempotent: takeNextQueued returns each id once. */
export async function dispatchQueued(uid: string): Promise<void> {
  for (let n = 0; n < PLAN_SLOTS.max + QUEUE_CAP; n++) {
    const next = await takeNextQueued(uid);
    if (!next) return;
    const result = await submitReservedHold(uid, next.runId, next.holdId, true, false);
    if (!result.ok && result.status !== 202) continue;
  }
}

export async function dispatchQueuedUsers(): Promise<number> {
  const [waiting, pending] = await Promise.all([
    db.collection('falQueue').where('queuedCount', '>', 0).get(),
    db.collection('falQueue').where('needsSubmit', '==', true).get(),
  ]);
  const uids = new Set([...waiting.docs, ...pending.docs].map((doc) => doc.id));
  for (const uid of uids) await dispatchQueued(uid);
  return uids.size;
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
  const alertUsd = dailySpendAlertUsd(process.env);

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

  const runId = typeof args.run_id === 'string' ? args.run_id.trim() : '';
  const approved =
    typeof args.approved_credits === 'number' ? args.approved_credits : null;
  if (!runId) {
    return jsonError(400, 'run_id is required for every metered submit');
  }
  // Hash the client request before any signed URL is minted. audio_url is
  // both a submit key and a media key; media keys stay as drama-upload://
  // or the original Fal media URL.
  const bodyHash = clientRequestHash(endpoint, args);
  const peeked = await peekFalRun(uid, runId, bodyHash);
  if (peeked.action === 'conflict') {
    return jsonError(409, 'idempotency conflict');
  }
  if (peeked.action === 'replay' && peeked.falRequestId) {
    const slot = await slotView(uid, peeked.holdId || peeked.falRequestId);
    return NextResponse.json(
      withSlot({ ...proxyUrls(endpoint, peeked.falRequestId), status: 'IN_PROGRESS', logs: [] }, {
        ...slot,
        state: 'running',
      })
    );
  }
  if (peeked.action === 'replay' && peeked.holdId) {
    const existing = await readGatewayJob(peeked.holdId);
    if (existing?.status === 'queued') {
      const slot = await slotView(uid, existing.holdId || existing.id);
      return NextResponse.json(
        withSlot(
          { ...proxyUrls(endpoint, existing.id), status: 'IN_QUEUE', logs: [] },
          { ...slot, state: 'queued' }
        )
      );
    }
  }
  if (peeked.action === 'replay' || peeked.action === 'unknown') {
    return jsonError(202, 'Fal submit outcome unknown; hold kept, not resubmitted');
  }
  const skipLimits = peeked.action === 'continue';

  // Signed URLs are minted only after the request hash. Replay and conflict
  // returned above, so a retry does not mint a URL or open a hold.
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
  const resolvedMediaArgs = pickMediaArgs(falBody);

  let rawUsd = 0;
  let snapshot: PriceSnapshot | undefined;
  let estimated = 0;
  if (!skipLimits) {
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
    estimated = creditsFromUsd(rawUsd).credits;
    if (!(rawUsd > 0) || estimated <= 0) {
      return jsonError(400, 'unpriced Fal request — estimate is not a positive price');
    }
    // Alert only. The balance check, MAX_JOB_CREDITS, and idempotency still gate the submit.
    const spendSnap = await db.doc(`spendDaily/${day}`).get();
    const spendUsd =
      Number(spendSnap.data()?.falUsd ?? 0) + Number(spendSnap.data()?.falUsdHeld ?? 0) + rawUsd;
    if (spendAlertCrossed(spendUsd, alertUsd)) {
      await sendOpsAlert(
        {
          severity: 'HIGH',
          condition: 'daily-spend',
          id: day,
          text: `daily Fal spend $${spendUsd.toFixed(2)} passed the $${alertUsd} alert. Submits are not blocked.`,
        },
        { nowMs, store: firestoreAlertStore(db) }
      );
    }
    if (estimated > MAX_JOB_CREDITS) {
      return jsonError(400, `job exceeds MAX_JOB_CREDITS (${MAX_JOB_CREDITS})`);
    }
    // approved_credits is required only for drama-skill (rate-card) jobs.
    const gate = submitPriceGate(estimated, approved, runId, !!card);
    if (gate === 'price_exceeded') {
      return jsonError(409, 'price is higher than the approved estimate; confirm again');
    }
    if (gate === 'approved_required') {
      return jsonError(400, 'approved_credits is required for drama-skill jobs');
    }
  }
  const extra = skipLimits
    ? undefined
    : omitUndefined({
    endpoint,
    unit: snapshot?.unit ?? pricing?.unit,
    unitPrice: snapshot?.unitPrice ?? pricing?.unitPrice,
    submitArgs,
    media,
    priceSnapshot: snapshot,
    reservedFalUsd: rawUsd,
    spendDay: day,
    runId,
    falBody: applyFalSafetyOff(endpoint, { ...submitArgs, ...resolvedMediaArgs }),
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
      const slot = await slotView(uid, reserved.holdId);
      return NextResponse.json(
        withSlot({ ...proxyUrls(endpoint, reserved.falRequestId), status: 'IN_PROGRESS', logs: [] }, {
          ...slot,
          state: 'running',
        })
      );
    }
    if (reserved.kind === 'unknown') {
      return jsonError(202, 'Fal submit outcome unknown; hold kept, not resubmitted');
    }
    holdId = reserved.holdId;
    if (reserved.placement === 'queued') {
      const slot = await slotView(uid, holdId);
      return NextResponse.json(
        withSlot(
          { ...proxyUrls(endpoint, holdId), status: 'IN_QUEUE', logs: [] },
          { ...slot, state: 'queued', queuePosition: reserved.position ?? slot.queuePosition }
        )
      );
    }
    const outcome = await submitReservedHold(uid, runId, holdId, false, true);
    if (!outcome.ok && outcome.message === 'Fal submit failed') {
      return jsonError(502, 'Fal submit failed');
    }
    if (!outcome.ok) return jsonError(outcome.status, outcome.message);
    const slot = await slotView(uid, holdId);
    return NextResponse.json(
      withSlot({ ...proxyUrls(endpoint, outcome.requestId), status: 'IN_QUEUE', logs: [] }, {
        ...slot,
        state: 'running',
        queuePosition: 0,
      })
    );
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
    if (err instanceof QueueFullError) {
      return jsonError(429, `queue is full (${QUEUE_CAP} jobs)`);
    }
    throw err;
  }
}

async function handleStatus(uid: string, requestId: string): Promise<Response> {
  const job = await readGatewayJob(requestId);
  if (!job || job.uid !== uid) return jsonError(404, 'unknown Fal job');

  if (job.status === 'released') {
    // See statusContract.ts: cancelled is HTTP 499, never a status JSON.
    return jsonError(RELEASED_STATUS.http, RELEASED_STATUS.message);
  }

  if (job.status === 'queued') {
    const slot = await slotView(uid, job.holdId || job.id);
    return NextResponse.json(
      withSlot({ status: 'IN_QUEUE', logs: [] }, { ...slot, state: 'queued' })
    );
  }

  if (job.status === 'settled' && job.payload !== undefined) {
    const slot = await slotView(uid, job.holdId || job.id);
    return NextResponse.json(withSlot({ ...SETTLED_STATUS_BODY }, { ...slot, state: 'done', queuePosition: 0 }));
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
  const slot = await slotView(uid, job.holdId || job.id);
  const body =
    json && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : { status: falStatus };
  return NextResponse.json(
    withSlot(body, { ...slot, state: 'running', queuePosition: 0 }),
    { status }
  );
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
  if (job.status === 'queued') {
    await releaseCredits(job.id);
    if (job.runId) await markFalRun(uid, job.runId, { phase: 'released' });
    await finishSlot(job.uid, job.holdId || job.id);
    return NextResponse.json({ ok: true, state: 'done' });
  }
  await settleFalJob({ requestId: job.id, ok: false });
  if (job.falCancelUrl) {
    const status = await falQueueCancel(job.falCancelUrl);
    return NextResponse.json({ ok: true, state: 'done' }, { status: status >= 400 ? status : 200 });
  }
  return NextResponse.json({ ok: true, state: 'done' });
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
