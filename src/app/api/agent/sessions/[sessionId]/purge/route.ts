import { NextRequest } from 'next/server';
import {
  deleteSessionPermanently,
  validatePurgeRequest,
} from '@/lib/agent/sessionBundle';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { noStoreJson } from '@/lib/agent/noStoreJson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (typeof token !== 'string') return token;

    const { sessionId } = await params;
    const access = await verifySessionAccess(token, sessionId);
    if ('error' in access) return access.error;

    const userId = access.sessionDoc.data()?.userId as string | undefined;
    if (!userId) {
      return noStoreJson({ error: 'Session missing userId' }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      confirm?: unknown;
      exportToken?: unknown;
    };
    const data = access.sessionDoc.data() ?? {};
    const invalid = validatePurgeRequest(body, {
      exportToken: data.exportToken,
      exportTokenAt: data.exportTokenAt,
    });
    if (invalid) {
      return noStoreJson({ error: invalid }, { status: 400 });
    }

    await deleteSessionPermanently(userId, sessionId);
    return noStoreJson({ ok: true, purged: sessionId });
  } catch (error) {
    console.error('DELETE /api/agent/sessions/[sessionId]/purge error:', error);
    return noStoreJson({ error: 'Failed to purge session' }, { status: 500 });
  }
}
