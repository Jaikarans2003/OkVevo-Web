import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type MessageRole = 'user' | 'assistant';

export async function ensureSession(sessionId: string, userId: string): Promise<void> {
  const ref = db.collection('sessions').doc(sessionId);
  const existing = await ref.get();

  const payload: Record<string, unknown> = {
    userId,
    status: 'active',
  };

  if (!existing.exists || !existing.data()?.createdAt) {
    payload.createdAt = FieldValue.serverTimestamp();
  }
  if (!existing.exists || !existing.data()?.lastMessageAt) {
    // Required for sidebar orderBy(lastMessageAt) before first message.
    payload.lastMessageAt = FieldValue.serverTimestamp();
  }

  await ref.set(payload, { merge: true });
}

export async function writeMessage(
  sessionId: string,
  role: MessageRole,
  content: string
): Promise<void> {
  await db.collection('sessions').doc(sessionId).collection('messages').add({
    role,
    content,
    createdAt: FieldValue.serverTimestamp(),
  });
}
