import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { createAdminSessionCookie, readAdminSession } from '@/lib/firebase-admin';
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
  const sessionCookie = await createAdminSessionCookie(token);
  const store = await cookies();
  store.set('__session', sessionCookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/admin',
    maxAge: 3600,
  });
  return NextResponse.json({ ok: true });
}
