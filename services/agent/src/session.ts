import { FieldValue } from 'firebase-admin/firestore';
import {
  convertToModelMessages,
  type ModelMessage,
  type UIMessage,
} from 'ai';
import { db } from './firebase';
import { parseTaggedAssets, type TaggedAsset } from './taggedAssets';

export type StoredMessagePart = Record<string, unknown>;

function textParts(content: string): UIMessage['parts'] {
  return content ? [{ type: 'text', text: content }] : [];
}

function withVideoUrlInContent(content: string, videoUrl?: string): string {
  if (!videoUrl || content.includes(videoUrl)) return content;
  return `${content}\n\nVideo URL for processing: ${videoUrl}`;
}

export type SaveMessageExtras = {
  videoUrl?: string;
  videoName?: string;
  imageUrl?: string;
  taggedAssets?: TaggedAsset[];
};

export async function ensureSession(
  sessionId: string,
  userId: string,
  title: string,
  extras?: { videoUrl?: string; videoName?: string }
): Promise<void> {
  const ref = db.collection('sessions').doc(sessionId);
  const existing = await ref.get();

  const payload: Record<string, unknown> = {
    userId,
    status: 'active',
  };

  if (!existing.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }
  if (!existing.exists || !existing.data()?.title) {
    payload.title = title.slice(0, 80) || 'Untitled Chat';
  }
  if (extras?.videoUrl) payload.videoUrl = extras.videoUrl;
  if (extras?.videoName) payload.videoName = extras.videoName;

  await ref.set(payload, { merge: true });
}

export async function loadMessages(
  sessionId: string,
  _userId: string
): Promise<ModelMessage[]> {
  try {
    const snapshot = await db
      .collection('sessions')
      .doc(sessionId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    if (snapshot.empty) {
      return [];
    }

    const uiMessages: Array<Omit<UIMessage, 'id'>> = snapshot.docs.map((doc) => {
      const data = doc.data();
      const role = data.role as 'user' | 'assistant';
      const videoUrl =
        typeof data.videoUrl === 'string' ? data.videoUrl : undefined;
      const content = withVideoUrlInContent(
        typeof data.content === 'string' ? data.content : '',
        videoUrl
      );
      const storedParts = Array.isArray(data.parts)
        ? (data.parts as UIMessage['parts'])
        : null;
      const parts =
        storedParts && storedParts.length > 0
          ? storedParts
          : textParts(content);

      return { role, parts };
    });

    try {
      return await convertToModelMessages(uiMessages, {
        ignoreIncompleteToolCalls: true,
      });
    } catch (err) {
      console.error(
        '[session] convertToModelMessages failed, falling back to text:',
        err
      );
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        const videoUrl =
          typeof data.videoUrl === 'string' ? data.videoUrl : undefined;
        return {
          role: data.role as 'user' | 'assistant',
          content: withVideoUrlInContent(
            typeof data.content === 'string' ? data.content : '',
            videoUrl
          ),
        };
      });
    }
  } catch {
    return [];
  }
}

export async function saveMessage(
  sessionId: string,
  _userId: string,
  role: 'user' | 'assistant',
  content: string,
  parts?: StoredMessagePart[],
  extras?: SaveMessageExtras
): Promise<void> {
  const taggedAssets = extras?.taggedAssets?.length
    ? parseTaggedAssets(extras.taggedAssets)
    : [];
  await db
    .collection('sessions')
    .doc(sessionId)
    .collection('messages')
    .add({
      role,
      content,
      ...(parts && parts.length > 0 ? { parts } : {}),
      ...(extras?.videoUrl ? { videoUrl: extras.videoUrl } : {}),
      ...(extras?.videoName ? { videoName: extras.videoName } : {}),
      ...(extras?.imageUrl ? { imageUrl: extras.imageUrl } : {}),
      ...(taggedAssets.length > 0 ? { taggedAssets } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });

  await db.collection('sessions').doc(sessionId).set(
    {
      lastMessageAt: FieldValue.serverTimestamp(),
      messageCount: FieldValue.increment(1),
      ...(extras?.videoUrl ? { videoUrl: extras.videoUrl } : {}),
      ...(extras?.videoName ? { videoName: extras.videoName } : {}),
      ...(extras?.imageUrl ? { imageUrl: extras.imageUrl } : {}),
    },
    { merge: true }
  );
}
