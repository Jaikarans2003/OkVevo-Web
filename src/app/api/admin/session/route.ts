import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { readAdminSession } from '@/lib/firebase-admin';
import { gatewayIdToken } from '@/lib/gateway/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const token = gatewayIdToken(request);
  if (!token) return notFound();
  if ((await readAdminSession(token)) !== 'admin') return notFound();
  const store = await cookies();
  store.set('__session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });
  return NextResponse.json({ ok: true });
}
