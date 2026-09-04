import { NextRequest, NextResponse } from 'next/server';

import {
  DesktopAuthError,
  refreshDesktopAuthTokens,
} from '@/lib/auth/desktop-codes';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { refreshToken?: string };
    const tokens = await refreshDesktopAuthTokens(String(body.refreshToken || ''));
    return NextResponse.json(tokens);
  } catch (err) {
    if (err instanceof DesktopAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('desktop refresh failed', err);
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }
}
