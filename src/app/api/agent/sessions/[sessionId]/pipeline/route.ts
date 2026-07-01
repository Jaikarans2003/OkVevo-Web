import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

async function verifySessionAccessFromRequest(request: NextRequest, sessionId: string) {
  const token = await getBearerToken(request.headers.get('authorization'));
  if (token instanceof NextResponse) {
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
    pipelineMode: data.pipelineMode ?? 'auto',
    videoUrl: data.videoUrl as string | undefined,
    draftVideoUrl: data.draftVideoUrl as string | undefined,
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

    return NextResponse.json(mapPipelineState(access.sessionDoc.data()!));
  } catch (error) {
    console.error('GET /api/agent/sessions/[sessionId]/pipeline error:', error);
    return NextResponse.json({ error: 'Failed to fetch pipeline state' }, { status: 500 });
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

    await db.collection('sessions').doc(sessionId).set(
      { pipelineApproved: true, pipelineStatus: 'running' },
      { merge: true }
    );

    const updated = await db.collection('sessions').doc(sessionId).get();
    return NextResponse.json(mapPipelineState(updated.data()!));
  } catch (error) {
    console.error('POST /api/agent/sessions/[sessionId]/pipeline error:', error);
    return NextResponse.json({ error: 'Failed to approve pipeline' }, { status: 500 });
  }
}
