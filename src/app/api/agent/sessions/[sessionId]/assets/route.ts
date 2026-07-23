import { NextRequest } from 'next/server';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { listSessionAssetDocs } from '@/lib/agent/sessionAssets';
import { noStoreJson } from '@/lib/agent/noStoreJson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (typeof token !== 'string') return token;

    const { sessionId } = await params;
    const access = await verifySessionAccess(token, sessionId);
    if ('error' in access) return access.error;

    const userId = access.sessionDoc.data()?.userId as string;
    const assets = await listSessionAssetDocs(userId, sessionId);
    return noStoreJson(assets);
  } catch (error) {
    console.error('GET session assets error:', error);
    return noStoreJson({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}
