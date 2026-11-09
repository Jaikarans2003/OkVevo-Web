import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/firebase-admin';
import { gatewayIdToken } from '@/lib/gateway/auth';
import { invalidTokenResponse } from '@/lib/gateway/httpErrors';
import { loadModelCatalog } from '@/lib/gateway/modelCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const idToken = gatewayIdToken(request);
  if (!idToken) return invalidTokenResponse();
  try {
    await auth.verifyIdToken(idToken);
  } catch {
    return invalidTokenResponse();
  }

  try {
    const body = await loadModelCatalog();
    return NextResponse.json(body, {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (err) {
    console.error('gateway: model catalog failed', err);
    return NextResponse.json(
      { error: { message: 'model catalog unavailable', type: 'server_error', code: 'internal_error' } },
      { status: 502 }
    );
  }
}
