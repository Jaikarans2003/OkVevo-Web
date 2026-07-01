import { NextResponse } from 'next/server';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { auth, db } from '@/lib/firebase-admin';

export async function verifySessionAccess(
  token: string,
  sessionId: string
): Promise<
  | { sessionDoc: DocumentSnapshot }
  | { error: NextResponse }
> {
  const decodedToken = await auth.verifyIdToken(token);
  const userId = decodedToken.uid;

  const sessionRef = db.collection('sessions').doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    return { error: NextResponse.json({ error: 'Session not found' }, { status: 404 }) };
  }

  const sessionUserId = sessionDoc.data()?.userId as string | undefined;

  if (sessionUserId && sessionUserId !== userId) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  // Pipeline-only writes may create session docs before userId is set
  if (!sessionUserId) {
    await sessionRef.set({ userId }, { merge: true });
  }

  const updated = await sessionRef.get();
  return { sessionDoc: updated };
}

export async function getBearerToken(
  authHeader: string | null
): Promise<string | NextResponse> {
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return authHeader.split('Bearer ')[1];
}
