import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { uploadedVideoAssetKey } from '@/lib/agent/sessionAssets';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (token instanceof NextResponse) {
      return token;
    }

    const { sessionId } = await params;
    const access = await verifySessionAccess(token, sessionId);
    if ('error' in access) {
      return access.error;
    }

    const sessionRef = db.collection('sessions').doc(sessionId);
    const snapshot = await sessionRef
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(50)
      .get();

    const messages = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAtRaw = data.createdAt;
      const createdAt =
        createdAtRaw instanceof Timestamp
          ? createdAtRaw.toDate().toISOString()
          : createdAtRaw
            ? new Date(createdAtRaw).toISOString()
            : null;

      return {
        role: data.role as string,
        content: data.content as string,
        parts: Array.isArray(data.parts) ? data.parts : undefined,
        createdAt,
        videoUrl: (data.videoUrl as string | undefined) ?? undefined,
        videoName: (data.videoName as string | undefined) ?? undefined,
      };
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('GET /api/agent/sessions/[sessionId] error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (token instanceof NextResponse) {
      return token;
    }

    const { sessionId } = await params;
    const access = await verifySessionAccess(token, sessionId, {
      createIfMissing: true,
    });
    if ('error' in access) {
      return access.error;
    }

    const body = (await request.json()) as {
      videoUrl?: string;
      videoName?: string;
    };

    if (!body.videoUrl || !body.videoName) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
    }

    let videoUrl: URL;
    try {
      videoUrl = new URL(body.videoUrl);
    } catch {
      return NextResponse.json({ error: 'videoUrl is invalid' }, { status: 400 });
    }
    if (videoUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'videoUrl must use HTTPS' }, { status: 400 });
    }

    const userId = access.sessionDoc.data()?.userId as string;
    const assetKey = uploadedVideoAssetKey(body.videoName);
    await Promise.all([
      db.collection('sessions').doc(sessionId).set(
        { videoUrl: body.videoUrl, videoName: body.videoName },
        { merge: true }
      ),
      db
        .collection('users')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId)
        .set(
          {
            assets: { [assetKey]: body.videoUrl },
            assetMetadata: {
              [assetKey]: {
                label: body.videoName,
                type: 'video',
                createdAt: FieldValue.serverTimestamp(),
              },
            },
          },
          { merge: true }
        ),
    ]);

    return NextResponse.json({ ok: true, assetId: assetKey });
  } catch (error) {
    console.error('PATCH /api/agent/sessions/[sessionId] error:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
