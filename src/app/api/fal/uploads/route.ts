/**
 * POST — create a drama reference upload. Auth required.
 * Body: { contentType, bytes, consentRights }.
 * Returns { path, uploadUrl, expiresAt } — a V4 signed PUT URL for one
 * object under drama-inputs/{uid}/. The client then PUTs the bytes and calls
 * /api/fal/uploads/complete, which measures the object server-side.
 *
 * consentRights must be true: the uploader affirms they have the right to
 * use the voice/likeness/material (legal page carries the same disclosure).
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { db, getAdminBucket } from '@/lib/firebase-admin';
import { uidFromIdToken } from '@/lib/gateway/auth';
import {
  SIGNED_PUT_TTL_MS,
  UPLOAD_CAPS,
  uploadExtForMime,
  uploadKindOfMime,
  uploadPath,
  uploadRateDecision,
  type UploadRateWindow,
} from '@/lib/fal/uploads';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await uidFromIdToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { contentType?: unknown; bytes?: unknown; consentRights?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  const bytes = typeof body.bytes === 'number' ? body.bytes : NaN;
  const kind = uploadKindOfMime(contentType);
  const ext = uploadExtForMime(contentType);
  if (!kind || !ext) {
    return NextResponse.json(
      { error: 'contentType must be mp4/mov/webm video, mp3/wav/m4a audio, or png/jpg/webp image' },
      { status: 400 }
    );
  }
  if (body.consentRights !== true) {
    return NextResponse.json(
      { error: 'consentRights must be true — only upload voices, faces or likenesses you have the right to use' },
      { status: 400 }
    );
  }
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > UPLOAD_CAPS[kind]) {
    return NextResponse.json(
      { error: `${kind} uploads are limited to ${Math.floor(UPLOAD_CAPS[kind] / 1024 / 1024)}MB` },
      { status: 400 }
    );
  }

  const nowMs = Date.now();
  const rateRef = db.doc(`dramaUploadRates/${user.uid}`);
  const decision = await db.runTransaction(async (txn) => {
    const snap = await txn.get(rateRef);
    const prior = snap.exists ? (snap.data() as UploadRateWindow) : null;
    const d = uploadRateDecision(prior, nowMs);
    txn.set(rateRef, d.window);
    return d;
  });
  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'Upload rate limit reached (30 per hour)' },
      { status: 429 }
    );
  }

  const path = uploadPath(user.uid, randomUUID(), ext);
  const [uploadUrl] = await getAdminBucket().file(path).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: nowMs + SIGNED_PUT_TTL_MS,
    contentType,
  });

  return NextResponse.json({ path, uploadUrl, expiresAt: new Date(nowMs + SIGNED_PUT_TTL_MS).toISOString() });
}
