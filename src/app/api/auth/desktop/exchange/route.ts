import { NextRequest, NextResponse } from 'next/server';

import {
  DesktopAuthError,
  exchangeDesktopAuthCode,
} from '@/lib/auth/desktop-codes';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { code?: string; state?: string };
    const tokens = await exchangeDesktopAuthCode(
      String(body.code || ''),
      String(body.state || '')
    );
    return NextResponse.json(tokens);
  } catch (err) {
    if (err instanceof DesktopAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('desktop exchange failed', err);
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }
}
