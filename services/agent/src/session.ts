import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase';

export type StoredMessagePart = Record<string, unknown>;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function ensureSession(
  sessionId: string,
  userId: string,
  title: string
): Promise<void> {
  const ref = db.collection('sessions').doc(sessionId);
  const existing = await ref.get();

  const payload: Record<string, unknown> = {
    userId,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
  };

  if (!existing.exists || !existing.data()?.title) {
    payload.title = title.slice(0, 80) || 'Untitled Chat';
  }

  await ref.set(payload, { merge: true });
}

export async function loadMessages(
  sessionId: string,
  _userId: string
): Promise<ChatMessage[]> {
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

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        role: data.role as 'user' | 'assistant',
        content: data.content as string,
      };
    });
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
  extras?: { videoUrl?: string; videoName?: string }
): Promise<void> {
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
      createdAt: FieldValue.serverTimestamp(),
    });

  await db.collection('sessions').doc(sessionId).set(
    {
      lastMessageAt: FieldValue.serverTimestamp(),
      messageCount: FieldValue.increment(1),
    },
    { merge: true }
  );
}
