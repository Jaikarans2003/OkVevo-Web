/**
 * DELETE — tombstone our clonedVoices row (`status: deleted`). The doc
 * stays forever so the voice_id cannot be registered or used again.
 * Fal/MiniMax has no delete-voice API (llms.txt 2026-10-10), so
 * provider_deleted is always false.
 */

import { NextRequest, NextResponse } from 'next/server';

import { uidFromIdToken } from '@/lib/gateway/auth';
import { deleteClonedVoiceRecord } from '@/lib/fal/voiceOwnership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await uidFromIdToken(request);
  if (!user) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  const { id } = await context.params;
  const customVoiceId = decodeURIComponent(id || '').trim();
  if (!customVoiceId) {
    return NextResponse.json({ error: { message: 'missing custom_voice_id' } }, { status: 400 });
  }
  const result = await deleteClonedVoiceRecord(user.uid, customVoiceId);
  if (result === 'forbidden') {
    return NextResponse.json({ error: { message: 'custom voice_id is not owned by this account' } }, { status: 403 });
  }
  if (result === 'missing') {
    return NextResponse.json({ error: { message: 'voice not found' } }, { status: 404 });
  }
  return NextResponse.json({
    deleted: true,
    tombstoned: true,
    provider_deleted: false,
    custom_voice_id: customVoiceId,
    note:
      'Voice ID is kept as deleted on your OkVevo account and cannot be registered or used again. Fal/MiniMax has no delete-voice API. Unused provider clones auto-delete after 7 days.',
  });
}
