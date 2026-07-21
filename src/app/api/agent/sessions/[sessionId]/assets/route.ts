import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { assetLabel, assetType, isTaggableAsset } from '@/lib/agent/sessionAssets';
import { db } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (token instanceof NextResponse) return token;

    const { sessionId } = await params;
    const access = await verifySessionAccess(token, sessionId);
    if ('error' in access) return access.error;

    const userId = access.sessionDoc.data()?.userId as string;
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('sessions')
      .doc(sessionId)
      .get();
    const data = snapshot.data() ?? {};
    const assets = (data.assets ?? {}) as Record<string, unknown>;
    const metadata = (data.assetMetadata ?? {}) as Record<
      string,
      { label?: unknown; type?: unknown; createdAt?: unknown }
    >;

    return NextResponse.json(
      Object.entries(assets).flatMap(([id, value]) => {
        if (typeof value !== 'string' || !isTaggableAsset(id, value)) return [];
        const meta = metadata[id];
        const createdAt =
          meta?.createdAt instanceof Timestamp
            ? meta.createdAt.toDate().toISOString()
            : null;
        return [
          {
            id,
            label:
              typeof meta?.label === 'string' && meta.label
                ? meta.label
                : assetLabel(id),
            url: value,
            type:
              typeof meta?.type === 'string' && meta.type
                ? meta.type
                : assetType(id, value),
            createdAt,
          },
        ];
      })
    );
  } catch (error) {
    console.error('GET session assets error:', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}
