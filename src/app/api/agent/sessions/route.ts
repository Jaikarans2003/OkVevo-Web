import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const snapshot = await db
      .collection('sessions')
      .where('userId', '==', userId)
      .get();

    const sessions = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const lastMessageAtRaw = data.lastMessageAt ?? data.createdAt;
        if (!lastMessageAtRaw) {
          return null;
        }

        const lastMessageAt =
          lastMessageAtRaw instanceof Timestamp
            ? lastMessageAtRaw.toDate()
            : new Date(lastMessageAtRaw);

        return {
          sessionId: doc.id,
          title: (data.title as string) || 'Untitled Chat',
          lastMessageAt: lastMessageAt.toISOString(),
          messageCount: (data.messageCount as number) ?? 0,
        };
      })
      .filter((session): session is NonNullable<typeof session> => session !== null)
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      )
      .slice(0, 20);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('GET /api/agent/sessions error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
