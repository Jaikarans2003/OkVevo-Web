import { NextRequest } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { ensureSession } from '@/lib/agent/session';
import { noStoreJson } from '@/lib/agent/noStoreJson';
import {
  UPLOADED_PHOTO_PREFIX,
  UPLOADED_VIDEO_PREFIX,
  nextUploadLabel,
} from '@/lib/agent/uploadAssetLabel';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { sanitizeTaggedAssets } from '@/lib/agent/taggedAssets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UploadInput = {
  url: string;
  mediaKind: 'video' | 'image';
  originalName?: string;
};

function parseHttpsUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function registerUpload(
  userId: string,
  sessionId: string,
  upload: UploadInput
): Promise<{ assetId: string; label: string; kind: string }> {
  const kind = upload.mediaKind === 'video' ? 'uploaded_video' : 'uploaded_image';
  const prefix =
    upload.mediaKind === 'video' ? UPLOADED_VIDEO_PREFIX : UPLOADED_PHOTO_PREFIX;
  const assetsCol = db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets');

  const result = await db.runTransaction(async (tx) => {
    const existingSnap = await tx.get(
      assetsCol.where('url', '==', upload.url).limit(1)
    );
    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0]!;
      const data = doc.data();
      return {
        assetId: doc.id,
        label:
          typeof data.label === 'string' && data.label
            ? data.label
            : nextUploadLabel([], prefix),
        kind: typeof data.kind === 'string' ? data.kind : kind,
        created: false,
      };
    }

    const kindSnap = await tx.get(assetsCol.where('kind', '==', kind));
    const labels = kindSnap.docs.map((doc) => {
      const label = doc.data().label;
      return typeof label === 'string' ? label : '';
    });
    const label = nextUploadLabel(labels, prefix);
    const assetRef = assetsCol.doc();
    tx.set(assetRef, {
      kind,
      url: upload.url,
      label,
      status: 'ready',
      createdAt: FieldValue.serverTimestamp(),
      ...(upload.originalName
        ? { metadata: { originalName: upload.originalName } }
        : {}),
    });
    return { assetId: assetRef.id, label, kind, created: true };
  });

  if (upload.mediaKind === 'video') {
    await db.collection('sessions').doc(sessionId).set(
      {
        videoUrl: upload.url,
        videoName: result.label,
      },
      { merge: true }
    );
  }

  return result;
}

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
        taggedAssets: sanitizeTaggedAssets(data.taggedAssets),
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
      uploads?: UploadInput[];
    };

    const uploads: UploadInput[] = [
      ...(Array.isArray(body.uploads) ? body.uploads : []),
    ];

    // Legacy single-video body still accepted.
    if (uploads.length === 0 && body.videoUrl) {
      uploads.push({
        url: body.videoUrl,
        mediaKind: 'video',
        originalName: body.videoName,
      });
    }

    if (uploads.length === 0) {
      return noStoreJson({ error: 'uploads or videoUrl is required' }, { status: 400 });
    }

    for (const upload of uploads) {
      if (upload.mediaKind !== 'video' && upload.mediaKind !== 'image') {
        return noStoreJson({ error: 'mediaKind must be video or image' }, { status: 400 });
      }
      if (!upload.url || !parseHttpsUrl(upload.url)) {
        return noStoreJson({ error: 'each upload url must be HTTPS' }, { status: 400 });
      }
    }

    const userId = access.sessionDoc.data()?.userId as string;
    const registered = [];
    for (const upload of uploads) {
      registered.push(await registerUpload(userId, sessionId, upload));
    }

    return noStoreJson({ ok: true, assets: registered });
  } catch (error) {
    console.error('PATCH /api/agent/sessions/[sessionId] error:', error);
    return noStoreJson({ error: 'Failed to update session' }, { status: 500 });
  }
}
