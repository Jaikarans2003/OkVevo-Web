import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken } from '@/lib/agent/verifySessionAccess';
import { auth } from '@/lib/firebase-admin';
import { env } from '@/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstream.status}` },
        { status: 502 }
      );
    }

    const filename = safeFilename(name);
    const contentType =
      upstream.headers.get('content-type') || 'application/octet-stream';

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/agent/download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
