import { NextRequest, NextResponse } from 'next/server';

import { env } from '@/config/env';
import { auth } from '@/lib/firebase-admin';
import { isMeterableEndpoint } from '@/lib/fal/allowlist';
import {
  estimateUnitPriceCost,
  falQueueCancel,
  falQueueGet,
  falServerKey,
  getEndpointPricing,
  submitFalQueue,
} from '@/lib/fal/client';
import { parseFalQueuePath } from '@/lib/fal/queuePath';
import { adjustedUsd, QuantityError, quantity } from '@/lib/fal/quantity';
import { gatewayIdToken } from '@/lib/gateway/auth';
import {
  InsufficientCreditsError,
  patchGatewayJob,
  readGatewayJob,
  rebindGatewayJob,
  reconcileCredits,
  releaseCredits,
  reserveCredits,
} from '@/lib/gateway/debit';
import { creditsFromUsd } from '@/lib/gateway/pricing';

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
] as const;

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
}): Promise<number> {
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

export async function settleFalJob(opts: {
  requestId: string;
  ok: boolean;
  payload?: unknown;
  metrics?: unknown;
}): Promise<void> {
  const job = await readGatewayJob(opts.requestId);
  if (!job || job.status !== 'reserved') return;
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
    });
    actual = creditsFromUsd(rawUsd).credits;
    await reconcileCredits({
      requestId: opts.requestId,
      actualCredits: actual,
      provider: 'fal',
      model: endpoint,
      costUsd: creditsFromUsd(rawUsd).costUsd,
      priceUsd: rawUsd,
    });
  } catch (err) {
    if (err instanceof QuantityError) {
      console.error('fal settle quantity failed, keeping estimate', err);
      await reconcileCredits({
        requestId: opts.requestId,
        actualCredits: actual,
        provider: 'fal',
        model: endpoint,
      });
    } else {
      throw err;
    }
  }
  if (opts.payload !== undefined) {
    await patchGatewayJob(opts.requestId, { payload: opts.payload });
  }
}

function falStatusOf(json: unknown): string {
  const rec = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  return String(rec.status ?? '').toUpperCase();
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
  const pricing = await getEndpointPricing(endpoint);
  if (!pricing) {
    return jsonError(502, 'Fal pricing unavailable');
  }
  const args = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const submitArgs = pickSubmitArgs(body);
  let rawUsd: number;
  try {
    rawUsd = await meterRawUsd({
      endpoint,
      unit: pricing.unit,
      unitPrice: pricing.unitPrice,
      args: submitArgs,
    });
  } catch (err) {
    const msg = err instanceof QuantityError ? err.message : 'cannot meter this request';
    return jsonError(400, msg);
  }
  const estimated = creditsFromUsd(rawUsd).credits;
  const holdId = crypto.randomUUID();
  try {
    await reserveCredits({
      uid,
      requestId: holdId,
      provider: 'fal',
      estimatedCredits: estimated,
      extra: {
        endpoint,
        unit: pricing.unit,
        unitPrice: pricing.unitPrice,
        submitArgs,
      },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return jsonError(402, 'insufficient credits');
    }
    throw err;
  }

  try {
    const submitted = await submitFalQueue(endpoint, args);
    await rebindGatewayJob(holdId, submitted.request_id);
    await patchGatewayJob(submitted.request_id, {
      falStatusUrl: submitted.status_url,
      falResponseUrl: submitted.response_url,
      falCancelUrl: submitted.cancel_url,
    });
    return NextResponse.json(proxyUrls(endpoint, submitted.request_id));
  } catch (err) {
    console.error('fal submit failed', err);
    await releaseCredits(holdId);
    return jsonError(502, 'Fal submit failed');
  }
}

async function handleStatus(uid: string, requestId: string): Promise<Response> {
  const job = await readGatewayJob(requestId);
  if (!job || job.uid !== uid) return jsonError(404, 'unknown Fal job');

  if (job.status === 'released') {
    return NextResponse.json({ status: 'ERROR', error: 'cancelled' });
  }

  if (job.status === 'settled' && job.payload !== undefined) {
    return NextResponse.json({ status: 'COMPLETED' });
  }

  const url = job.falStatusUrl;
  if (!url) return jsonError(502, 'missing Fal status url');
  const { status, json } = await falQueueGet(url);
  const falStatus = falStatusOf(json);
  if (falStatus === 'COMPLETED' && job.status === 'reserved') {
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

  if (parsed.kind === 'submit') {
    if (request.method !== 'POST') return jsonError(405, 'method not allowed');
    let body: unknown = {};
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return jsonError(400, 'invalid json');
    }
    return handleSubmit(uid, parsed.endpoint, body);
  }

  if (parsed.kind === 'status' && request.method === 'GET') {
    return handleStatus(uid, parsed.requestId);
  }
  if (parsed.kind === 'response' && request.method === 'GET') {
    return handleResponse(uid, parsed.requestId);
  }
  if (parsed.kind === 'cancel' && (request.method === 'PUT' || request.method === 'POST')) {
    return handleCancel(uid, parsed.requestId);
  }
  return jsonError(405, 'method not allowed');
}
