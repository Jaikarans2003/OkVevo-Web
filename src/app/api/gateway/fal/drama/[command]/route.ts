import { NextRequest, NextResponse } from 'next/server';

import { DramaLedger, handleDrama } from '@/lib/fal/dramaGate';
import { uidFromIdToken } from '@/lib/gateway/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ledger = new DramaLedger();

type Ctx = { params: Promise<{ command: string }> };

/** Fixture ledger. Live Fal stays disabled until smoke is approved. */
export async function POST(request: NextRequest, context: Ctx) {
  const user = await uidFromIdToken(request);
  if (!user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  const { command } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const result = await handleDrama(command, user.uid, body, ledger);
  return NextResponse.json(result.body, { status: result.status });
}
