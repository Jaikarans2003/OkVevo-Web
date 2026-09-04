import { NextRequest, NextResponse } from 'next/server';

import {
  DesktopAuthError,
  mintDesktopAuthCode,
} from '@/lib/auth/desktop-codes';

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function POST(request: NextRequest) {
  try {
    const idToken = bearerToken(request);
    if (!idToken) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    const body = (await request.json()) as { redirect?: string; state?: string };
    const code = await mintDesktopAuthCode(
      idToken,
      String(body.redirect || ''),
      String(body.state || '')
    );
    return NextResponse.json({ code });
  } catch (err) {
    if (err instanceof DesktopAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('desktop mint failed', err);
    return NextResponse.json({ error: 'mint_failed' }, { status: 500 });
  }
}
