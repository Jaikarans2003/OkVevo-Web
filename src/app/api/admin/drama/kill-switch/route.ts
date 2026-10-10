/**
 * POST — the dashboard's ONE write control: the drama kill switch.
 * Server-verified admin claim; every toggle writes an opsAdminAudit entry
 * (who, when, old → new). Non-admins get 404.
 */

import { NextRequest, NextResponse } from 'next/server';

import { FieldValue } from 'firebase-admin/firestore';

import { auth, db, verifyAdminToken } from '@/lib/firebase-admin';
import { gatewayIdToken } from '@/lib/gateway/auth';

export const runtime = 'nodejs';

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const token = gatewayIdToken(request);
  if (!token || !(await verifyAdminToken(token))) return notFound();

  let body: { disabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (typeof body.disabled !== 'boolean') {
    return NextResponse.json({ error: 'disabled must be boolean' }, { status: 400 });
  }

  let uid = '';
  let email = '';
  try {
    const decoded = await auth.verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email ?? '';
  } catch {
    return notFound();
  }

  const ref = db.doc('opsConfig/drama');
  const before = (await ref.get()).data()?.disabled === true;
  const after = body.disabled;
  await ref.set(
    { disabled: after, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await db.collection('opsAdminAudit').add({
    action: 'drama-kill-switch',
    actorUid: uid,
    actorEmail: email,
    old: before,
    new: after,
    at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, disabled: after });
}
