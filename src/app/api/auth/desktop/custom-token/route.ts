import { NextRequest, NextResponse } from 'next/server';

import {
  DesktopAuthError,
  mintDesktopCustomToken,
} from '@/lib/auth/desktop-codes';

/**
 * Mint a short-lived Firebase custom token for the desktop renderer.
 * Main process holds the refresh token; renderer uses customToken + signInWithCustomToken
 * for Firestore onSnapshot only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { refreshToken?: string };
    const tokens = await mintDesktopCustomToken(String(body.refreshToken || ''));
    return NextResponse.json(tokens);
  } catch (err) {
    if (err instanceof DesktopAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('desktop custom-token failed', err);
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }
}
