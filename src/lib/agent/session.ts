import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

type MessageRole = 'user' | 'assistant';

export async function ensureSession(sessionId: string, userId: string): Promise<void> {
  await db.collection('sessions').doc(sessionId).set(
    {
      userId,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
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
