import { NextRequest, NextResponse } from 'next/server';

import { verifyFalWebhook } from '@/lib/fal/verifyWebhook';
import { settleFalJob } from '@/lib/fal/handleQueue';
import { readGatewayJob } from '@/lib/gateway/debit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer());

  const falAuth = await verifyFalWebhook(
    {
      requestId: req.headers.get('x-fal-webhook-request-id'),
      userId: req.headers.get('x-fal-webhook-user-id'),
      timestamp: req.headers.get('x-fal-webhook-timestamp'),
      signature: req.headers.get('x-fal-webhook-signature'),
    },
    rawBody
  );
  if (!falAuth.ok) {
    return NextResponse.json({ error: falAuth.error }, { status: falAuth.status });
  }

  let event: {
    request_id?: string;
    status?: string;
    error?: string;
    payload?: unknown;
    metrics?: unknown;
  };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const requestId =
    event.request_id || req.headers.get('x-fal-webhook-request-id') || '';
  if (!requestId) {
    return NextResponse.json({ ok: true });
  }

  const job = await readGatewayJob(requestId);
  if (!job) {
    return NextResponse.json({ ok: true });
  }

  const falStatus = (event.status ?? '').toUpperCase();
  if (falStatus === 'OK') {
    await settleFalJob({
      requestId,
      ok: true,
      payload: event.payload,
      metrics: event.metrics,
    });
  } else if (falStatus === 'ERROR') {
    await settleFalJob({ requestId, ok: false });
  }

  return NextResponse.json({ ok: true });
}
