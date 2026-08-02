import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
import {
  exportSessionBundle,
  mintExportToken,
  persistExportToken,
} from '@/lib/agent/sessionBundle';
import { getBearerToken, verifySessionAccess } from '@/lib/agent/verifySessionAccess';
import { noStoreJson } from '@/lib/agent/noStoreJson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Large session zips (videos + hf-project) can take several minutes. */
export const maxDuration = 800;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  let cleanup: (() => void) | undefined;
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

    const bundle = await exportSessionBundle(userId, sessionId);
    cleanup = bundle.cleanup;

    const exportToken = mintExportToken();
    await persistExportToken(sessionId, exportToken);

    const nodeStream = createReadStream(bundle.zipPath);
    nodeStream.on('close', () => {
      cleanup?.();
      cleanup = undefined;
    });
    nodeStream.on('error', () => {
      cleanup?.();
      cleanup = undefined;
    });

    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const filename = `session-${sessionId}.zip`;

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'x-okvevo-export-token': exportToken,
      },
    });
  } catch (error) {
    cleanup?.();
    console.error('GET /api/agent/sessions/[sessionId]/export error:', error);
    return noStoreJson({ error: 'Failed to export session' }, { status: 500 });
  }
}
