import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  paginateSessionsPage,
  parseSessionsLimit,
  sliceSessionsAfterCursor,
  type SessionListItem,
} from '@/lib/agent/sessionsPage';

export const runtime = 'nodejs';

function toSessionItem(
  docId: string,
  data: Record<string, unknown>
): SessionListItem {
  const lastMessageAtRaw = data.lastMessageAt ?? data.createdAt;
  const lastMessageAt =
    lastMessageAtRaw instanceof Timestamp
      ? lastMessageAtRaw.toDate()
      : lastMessageAtRaw
        ? new Date(lastMessageAtRaw as string | number | Date)
        : new Date(0);

  return {
    sessionId: docId,
    title: (data.title as string) || 'Untitled Chat',
    lastMessageAt: lastMessageAt.toISOString(),
    messageCount: (data.messageCount as number) ?? 0,
  };
}

function isMissingOrBuildingIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: number | string; message?: string; details?: string };
  const msg = [err.message, err.details].filter(Boolean).join(' ');
  return (
    err.code === 9 ||
    err.code === 'failed-precondition' ||
    msg.includes('requires an index') ||
    msg.includes('currently building')
  );
}

/** Indexed query — requires composite index userId + lastMessageAt. */
async function fetchViaIndex(
  userId: string,
  limit: number,
  before: string | null
): Promise<SessionListItem[]> {
  let query = db
    .collection('sessions')
    .where('userId', '==', userId)
    .orderBy('lastMessageAt', 'desc');

  if (before) {
    const beforeDate = new Date(before);
    if (Number.isNaN(beforeDate.getTime())) {
      throw Object.assign(new Error('Invalid before cursor'), { status: 400 });
    }
    query = query.startAfter(Timestamp.fromDate(beforeDate));
  }

  const snapshot = await query.limit(limit + 1).get();
  return snapshot.docs.map((doc) =>
    toSessionItem(doc.id, doc.data() as Record<string, unknown>)
  );
}

/**
 * ponytail: full scan + in-memory page while composite index builds / is missing.
 * Ceiling: O(n) per request; drop once index is Enabled and indexed path succeeds.
 */
async function fetchViaScan(
  userId: string,
  limit: number,
  before: string | null
): Promise<SessionListItem[]> {
  const snapshot = await db
    .collection('sessions')
    .where('userId', '==', userId)
    .get();

  const sorted = snapshot.docs
    .map((doc) => toSessionItem(doc.id, doc.data() as Record<string, unknown>))
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

  return sliceSessionsAfterCursor(sorted, before, limit);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = request.nextUrl;
    const limit = parseSessionsLimit(searchParams.get('limit'));
    const before = searchParams.get('before');

    let rows: SessionListItem[];
    try {
      rows = await fetchViaIndex(userId, limit, before);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status: unknown }).status === 400
      ) {
        return NextResponse.json(
          { error: 'Invalid before cursor' },
          { status: 400 }
        );
      }
      if (!isMissingOrBuildingIndexError(error)) throw error;
      console.warn(
        'GET /api/agent/sessions: index missing/building, using scan fallback'
      );
      rows = await fetchViaScan(userId, limit, before);
    }

    const { sessions, nextCursor } = paginateSessionsPage(rows, limit);

    return NextResponse.json({ sessions, nextCursor });
  } catch (error) {
    console.error('GET /api/agent/sessions error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
