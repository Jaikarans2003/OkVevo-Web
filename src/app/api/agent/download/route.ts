import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken } from '@/lib/agent/verifySessionAccess';
import { auth } from '@/lib/firebase-admin';
import { env } from '@/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Hard cap: App Hosting is 1GiB / concurrency 20 — keep well under OOM. */
const DOWNLOAD_MAX_BYTES = 200 * 1024 * 1024;

function isAllowedAssetUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    const bucket = env.firebase.storageBucket;
    if (parsed.hostname === 'storage.googleapis.com') {
      const path = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      return path.startsWith(`${bucket}/`);
    }
    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const match = /^\/v0\/b\/([^/]+)\/o\//.exec(parsed.pathname);
      return Boolean(match && match[1] === bucket);
    }
    return false;
  } catch {
    return false;
  }
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return cleaned || 'download';
}

export async function GET(request: NextRequest) {
  try {
    const token = await getBearerToken(request.headers.get('authorization'));
    if (typeof token !== 'string') return token;

    await auth.verifyIdToken(token);

    const url = request.nextUrl.searchParams.get('url');
    const name = request.nextUrl.searchParams.get('name') || 'download';
    if (!url || !isAllowedAssetUrl(url)) {
      return NextResponse.json({ error: 'Invalid asset URL' }, { status: 400 });
    }

    const upstream = await fetch(url, { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentLengthHeader = upstream.headers.get('content-length');
    const expected = contentLengthHeader != null ? Number(contentLengthHeader) : NaN;
    if (!Number.isFinite(expected) || expected < 0 || expected > DOWNLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          error:
            !Number.isFinite(expected) || expected < 0
              ? 'Upstream missing Content-Length'
              : 'File too large',
        },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength !== expected) {
      console.error('[download] size mismatch', {
        expected,
        actual: buffer.byteLength,
        url,
      });
      return NextResponse.json({ error: 'Incomplete download' }, { status: 502 });
    }

    const filename = safeFilename(name);
    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/agent/download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
