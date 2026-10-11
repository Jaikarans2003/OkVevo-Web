/**
 * POST — finalize an upload after the client PUT the bytes. Auth required.
 * Body: { path } (must be this user's drama-inputs object).
 *
 * The server — never the client — verifies the bytes: size cap, magic-byte
 * sniff vs the declared kind, sha256, and for audio/video the duration
 * (music-metadata, pure JS — App Hosting buildpacks ship no ffprobe) and for
 * images the pixel size (image-size), enforcing the ≤2048px normalization
 * bound the rate card prices against. The measured record lands in
 * dramaUploads/{id} with the object's GCS generation so a later overwrite is
 * detected at submit time.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import { imageSize } from 'image-size';
import { parseBuffer } from 'music-metadata';

import { db, getAdminBucket } from '@/lib/firebase-admin';
import { uidFromIdToken } from '@/lib/gateway/auth';
import {
  UPLOAD_CAPS,
  UPLOAD_IMAGE_MAX_EDGE,
  sniffUploadKind,
  uploadIdFromPath,
  uploadKindOfPath,
  uploadPathOwnedBy,
} from '@/lib/fal/uploads';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await uidFromIdToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { path?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const path = typeof body.path === 'string' ? body.path : '';
  if (!uploadPathOwnedBy(path, user.uid)) {
    return NextResponse.json({ error: 'Unknown upload path' }, { status: 400 });
  }
  const kind = uploadKindOfPath(path);
  const id = uploadIdFromPath(path);
  if (!kind || !id) {
    return NextResponse.json({ error: 'Unknown upload path' }, { status: 400 });
  }

  const file = getAdminBucket().file(path);
  const [meta] = await file.getMetadata().catch(() => [null] as const);
  if (!meta) return NextResponse.json({ error: 'Upload not found — PUT the bytes first' }, { status: 404 });
  const size = Number(meta.size);
  if (!Number.isFinite(size) || size <= 0 || size > UPLOAD_CAPS[kind]) {
    return NextResponse.json({ error: 'Uploaded bytes violate the size cap' }, { status: 400 });
  }

  const chunks: Buffer[] = [];
  let total = 0;
  const hash = createHash('sha256');
  const stream = file.createReadStream();
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > UPLOAD_CAPS[kind]) {
      stream.destroy();
      return NextResponse.json({ error: 'Uploaded bytes violate the size cap' }, { status: 400 });
    }
    chunks.push(buf);
    hash.update(buf);
  }
  const bytes = Buffer.concat(chunks);

  if (sniffUploadKind(bytes) !== kind) {
    return NextResponse.json(
      { error: 'File bytes do not match the declared type' },
      { status: 400 }
    );
  }

  let durationSeconds: number | null = null;
  let width: number | null = null;
  let height: number | null = null;
  if (kind === 'image') {
    try {
      const dims = imageSize(new Uint8Array(bytes));
      width = dims.width ?? null;
      height = dims.height ?? null;
    } catch {
      return NextResponse.json({ error: 'Could not read image dimensions' }, { status: 400 });
    }
    if (!width || !height) {
      return NextResponse.json({ error: 'Could not read image dimensions' }, { status: 400 });
    }
    if (Math.max(width, height) > UPLOAD_IMAGE_MAX_EDGE) {
      return NextResponse.json(
        { error: `Reference images must be ${UPLOAD_IMAGE_MAX_EDGE}px or smaller on the long edge — downscale first` },
        { status: 400 }
      );
    }
  } else {
    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    const hint =
      {
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        webm: 'video/webm',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        m4a: 'audio/mp4',
      }[ext] ?? 'video/mp4';
    try {
      const parsed = await parseBuffer(new Uint8Array(bytes), { mimeType: hint }, { duration: true });
      durationSeconds = parsed.format.duration ?? null;
    } catch {
      durationSeconds = null;
    }
    if (!(durationSeconds != null && durationSeconds > 0)) {
      return NextResponse.json(
        { error: 'Could not measure the media duration — the file may be corrupt' },
        { status: 400 }
      );
    }
  }

  const record = {
    uid: user.uid,
    path,
    kind,
    mime: String(meta.contentType ?? ''),
    durationSeconds,
    width,
    height,
    bytes: total,
    sha256: hash.digest('hex'),
    generation: String(meta.generation ?? ''),
    createdAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  };
  await db.doc(`dramaUploads/${id}`).set(record);

  return NextResponse.json({
    id,
    ref: `drama-upload://${id}`,
    kind,
    durationSeconds,
    width,
    height,
    bytes: total,
  });
}
