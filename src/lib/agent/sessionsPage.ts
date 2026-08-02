/** Page size for AI Studio sidebar project list. */
export const SESSIONS_PAGE_SIZE = 15;
export const SESSIONS_PAGE_SIZE_MAX = 50;

export type SessionListItem = {
  sessionId: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
};

/**
 * Slice a limit+1 fetch into a page and optional nextCursor.
 * nextCursor is the last returned item's lastMessageAt when more exist.
 */
export function paginateSessionsPage<T extends { lastMessageAt: string }>(
  rows: T[],
  limit: number
): { sessions: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const sessions = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && sessions.length > 0
      ? sessions[sessions.length - 1].lastMessageAt
      : null;
  return { sessions, nextCursor };
}

/** Apply `before` cursor on a desc-sorted list, then take limit+1 for paginateSessionsPage. */
export function sliceSessionsAfterCursor<T extends { lastMessageAt: string }>(
  sortedDesc: T[],
  before: string | null,
  limit: number
): T[] {
  let start = 0;
  if (before) {
    const beforeMs = new Date(before).getTime();
    if (!Number.isNaN(beforeMs)) {
      start = sortedDesc.findIndex(
        (s) => new Date(s.lastMessageAt).getTime() < beforeMs
      );
      if (start < 0) return [];
    }
  }
  return sortedDesc.slice(start, start + limit + 1);
}

export function parseSessionsLimit(raw: string | null): number {
  if (raw == null || raw === '') return SESSIONS_PAGE_SIZE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return SESSIONS_PAGE_SIZE;
  return Math.min(n, SESSIONS_PAGE_SIZE_MAX);
}
