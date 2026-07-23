import { NextRequest } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { ensureSession } from '@/lib/agent/session';
import { noStoreJson } from '@/lib/agent/noStoreJson';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (typeof token !== 'string') {
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
        imageUrl: (data.imageUrl as string | undefined) ?? undefined,
      };
    });

    return noStoreJson(messages);
  } catch (error) {
    console.error('GET /api/agent/sessions/[sessionId] error:', error);
    return noStoreJson({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (typeof token !== 'string') {
      return token;
    }

    const { sessionId } = await params;
    const decoded = await auth.verifyIdToken(token);
    await ensureSession(sessionId, decoded.uid);
    return noStoreJson({ ok: true });
  } catch (error) {
    console.error('POST /api/agent/sessions/[sessionId] error:', error);
    return noStoreJson({ error: 'Failed to ensure session' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (typeof token !== 'string') {
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
      return noStoreJson({ error: 'videoUrl is required' }, { status: 400 });
    }

    let videoUrl: URL;
    try {
      videoUrl = new URL(body.videoUrl);
    } catch {
      return noStoreJson({ error: 'videoUrl is invalid' }, { status: 400 });
    }
    if (videoUrl.protocol !== 'https:') {
      return noStoreJson({ error: 'videoUrl must use HTTPS' }, { status: 400 });
    }

    const userId = access.sessionDoc.data()?.userId as string;
    const [assetRef] = await Promise.all([
      db
        .collection('users')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId)
        .collection('assets')
        .add({
          kind: 'uploaded_video',
          url: body.videoUrl,
          label: body.videoName,
          status: 'ready',
          createdAt: FieldValue.serverTimestamp(),
        }),
      db.collection('sessions').doc(sessionId).set(
        { videoUrl: body.videoUrl, videoName: body.videoName },
        { merge: true }
      ),
    ]);

    return noStoreJson({ ok: true, assetId: assetRef.id });
  } catch (error) {
    console.error('PATCH /api/agent/sessions/[sessionId] error:', error);
    return noStoreJson({ error: 'Failed to update session' }, { status: 500 });
  }
}
