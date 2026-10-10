/**
 * GET — list cloned voices owned by the signed-in uid.
 * Local metadata/voices files are a cache of this list.
 */

import { NextRequest, NextResponse } from 'next/server';

import { uidFromIdToken } from '@/lib/gateway/auth';
import { listClonedVoicesForUid } from '@/lib/fal/voiceOwnership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await uidFromIdToken(request);
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  const voices = await listClonedVoicesForUid(user.uid);
  return NextResponse.json({ voices });
}
