import { NextRequest } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { Timestamp } from 'firebase-admin/firestore';
import { env } from '@/config/env';
import { noStoreJson } from '@/lib/agent/noStoreJson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGENT_URL = env.agentUrl;

async function verifySessionAccessFromRequest(request: NextRequest, sessionId: string) {
  const token = await getBearerToken(request.headers.get('authorization'));
  if (typeof token !== 'string') {
    return { error: token };
  }
  return verifySessionAccess(token, sessionId);
}

function mapPipelineState(data: Record<string, unknown>) {
  const pipelineUpdatedAtRaw = data.pipelineUpdatedAt;
  const pipelineUpdatedAt =
    pipelineUpdatedAtRaw instanceof Timestamp
      ? pipelineUpdatedAtRaw.toDate().toISOString()
      : pipelineUpdatedAtRaw
        ? new Date(Number(pipelineUpdatedAtRaw)).toISOString()
        : undefined;

  return {
    pipelinePhase: data.pipelinePhase ?? 0,
    pipelineStatus: data.pipelineStatus ?? '',
    pipelineMode: data.pipelineMode ?? 'ask',
    pendingCheckpointId:
      typeof data.pendingCheckpointId === 'string' ? data.pendingCheckpointId : null,
    skillId: typeof data.skillId === 'string' ? data.skillId : null,
    videoUrl: data.videoUrl as string | undefined,
    draftVideoUrl: data.draftVideoUrl as string | undefined,
    renderStatus: data.renderStatus as string | undefined,
    renderError: data.renderError as string | undefined,
    pipelineUpdatedAt,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const access = await verifySessionAccessFromRequest(request, sessionId);
    if ('error' in access) return access.error;

    return noStoreJson(mapPipelineState(access.sessionDoc.data()!));
  } catch (error) {
    console.error('GET /api/agent/sessions/[sessionId]/pipeline error:', error);
    return noStoreJson({ error: 'Failed to fetch pipeline state' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const access = await verifySessionAccessFromRequest(request, sessionId);
    if ('error' in access) return access.error;

    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action === 'check_now') {
      const response = await fetch(`${AGENT_URL}/renders/${sessionId}/check`, {
        method: 'POST',
        headers: {
          Authorization: request.headers.get('authorization') ?? '',
        },
      });
      return noStoreJson(await response.json(), { status: response.status });
    }

    await db.collection('sessions').doc(sessionId).set(
      { pipelineApproved: true, pipelineStatus: 'running' },
      { merge: true }
    );

    const updated = await db.collection('sessions').doc(sessionId).get();
    return noStoreJson(mapPipelineState(updated.data()!));
  } catch (error) {
    console.error('POST /api/agent/sessions/[sessionId]/pipeline error:', error);
    return noStoreJson({ error: 'Failed to approve pipeline' }, { status: 500 });
  }
}
