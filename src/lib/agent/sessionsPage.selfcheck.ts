/**
 * Assert sessions list pagination cursor helper.
 * Run: npx tsx src/lib/agent/sessionsPage.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  SESSIONS_PAGE_SIZE,
  SESSIONS_PAGE_SIZE_MAX,
  paginateSessionsPage,
  parseSessionsLimit,
  sliceSessionsAfterCursor,
} from './sessionsPage.ts';

const rows = Array.from({ length: 16 }, (_, i) => ({
  sessionId: `s${i}`,
  lastMessageAt: `2026-01-${String(16 - i).padStart(2, '0')}T00:00:00.000Z`,
}));

{
  const { sessions, nextCursor } = paginateSessionsPage(rows, 15);
  assert.equal(sessions.length, 15);
  assert.equal(nextCursor, sessions[14].lastMessageAt);
  assert.equal(nextCursor, '2026-01-02T00:00:00.000Z');
}

{
  const exact = rows.slice(0, 15);
  const { sessions, nextCursor } = paginateSessionsPage(exact, 15);
  assert.equal(sessions.length, 15);
  assert.equal(nextCursor, null);
}

{
  const short = rows.slice(0, 3);
  const { sessions, nextCursor } = paginateSessionsPage(short, 15);
  assert.equal(sessions.length, 3);
  assert.equal(nextCursor, null);
}

{
  const empty = paginateSessionsPage([], 15);
  assert.equal(empty.sessions.length, 0);
  assert.equal(empty.nextCursor, null);
}

assert.equal(parseSessionsLimit(null), SESSIONS_PAGE_SIZE);
assert.equal(parseSessionsLimit(''), SESSIONS_PAGE_SIZE);
assert.equal(parseSessionsLimit('0'), SESSIONS_PAGE_SIZE);
assert.equal(parseSessionsLimit('-1'), SESSIONS_PAGE_SIZE);
assert.equal(parseSessionsLimit('abc'), SESSIONS_PAGE_SIZE);
assert.equal(parseSessionsLimit('10'), 10);
assert.equal(parseSessionsLimit('999'), SESSIONS_PAGE_SIZE_MAX);

{
  const sorted = [
    { lastMessageAt: '2026-03-01T00:00:00.000Z' },
    { lastMessageAt: '2026-02-01T00:00:00.000Z' },
    { lastMessageAt: '2026-01-01T00:00:00.000Z' },
  ];
  const page = sliceSessionsAfterCursor(sorted, '2026-03-01T00:00:00.000Z', 2);
  assert.equal(page.length, 2);
  assert.equal(page[0].lastMessageAt, '2026-02-01T00:00:00.000Z');
  assert.equal(
    sliceSessionsAfterCursor(sorted, null, 2).length,
    3,
    'limit+1 window'
  );
}

console.log('sessionsPage.selfcheck: ok');
