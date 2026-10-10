/**
 * Voice ownership gate + expire window. No Firestore.
 * Run: npx tsx src/lib/fal/voiceOwnership.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  cloneRegisterDenied,
  countVoiceStats,
  expiresWithin1Day,
  extractCustomVoiceId,
  isPresetVoice,
  isVoiceTombstoned,
  speechVoiceOwnershipDenied,
  voiceDocId,
  VOICE_RETAIN_MS,
} from './voiceOwnership.ts';

assert.equal(isPresetVoice('Wise_Woman'), true);
assert.equal(isPresetVoice('cloned-hero-1'), false);

assert.equal(
  speechVoiceOwnershipDenied({ voiceId: 'Wise_Woman', uid: 'a', record: null }),
  false,
  'preset must pass without a Firestore row'
);
assert.equal(
  speechVoiceOwnershipDenied({ voiceId: '', uid: 'a', record: null }),
  false,
  'missing voice_id uses the Fal default preset'
);
assert.equal(
  speechVoiceOwnershipDenied({ voiceId: 'cloned-hero-1', uid: 'a', record: null }),
  true,
  'unknown custom voice_id is 403 before hold'
);
assert.equal(
  speechVoiceOwnershipDenied({
    voiceId: 'cloned-hero-1',
    uid: 'a',
    record: { uid: 'b' },
  }),
  true,
  'another uid must not spend with this custom voice_id'
);
assert.equal(
  speechVoiceOwnershipDenied({
    voiceId: 'cloned-hero-1',
    uid: 'a',
    record: { uid: 'a' },
  }),
  false
);
assert.equal(
  speechVoiceOwnershipDenied({
    voiceId: 'cloned-hero-1',
    uid: 'a',
    record: { uid: 'a', status: 'deleted' },
  }),
  true,
  'owner cannot use a tombstoned voice_id'
);
assert.equal(
  speechVoiceOwnershipDenied({
    voiceId: 'cloned-hero-1',
    uid: 'b',
    record: { uid: 'a', status: 'deleted' },
  }),
  true,
  'no other uid can use a tombstoned voice_id'
);
assert.equal(isVoiceTombstoned({ status: 'deleted' }), true);
assert.equal(isVoiceTombstoned({ status: 'active' }), false);
assert.equal(cloneRegisterDenied(null), false);
assert.equal(cloneRegisterDenied({ status: 'active' }), true);
assert.equal(cloneRegisterDenied({ status: 'deleted' }), true, 'tombstone blocks re-register');

const now = Date.parse('2026-10-10T12:00:00Z');
const unused = (ageMs: number) => ({
  cloned_at: new Date(now - ageMs).toISOString(),
  used_in_tts_at: null as string | null,
});
assert.equal(expiresWithin1Day(unused(6.5 * 86400000), now), true);
assert.equal(expiresWithin1Day(unused(5 * 86400000), now), false);
assert.equal(expiresWithin1Day(unused(VOICE_RETAIN_MS + 1000), now), false);
assert.equal(
  expiresWithin1Day({ cloned_at: unused(6.5 * 86400000).cloned_at, used_in_tts_at: '2026-10-09T00:00:00Z' }, now),
  false
);

const stats = countVoiceStats(
  [
    unused(6.5 * 86400000),
    unused(2 * 86400000),
    { cloned_at: unused(6.5 * 86400000).cloned_at, used_in_tts_at: 'x' },
    { ...unused(6.5 * 86400000), status: 'deleted' },
  ],
  now
);
assert.equal(stats.cloned, 3);
assert.equal(stats.expiringWithin1Day, 1);
assert.equal(expiresWithin1Day({ ...unused(6.5 * 86400000), status: 'deleted' }, now), false);

assert.equal(extractCustomVoiceId({ custom_voice_id: 'abc' }), 'abc');
assert.equal(extractCustomVoiceId({ data: { voice_id: 'nested-clone' } }), 'nested-clone');
assert.equal(extractCustomVoiceId({ voice_id: 'Wise_Woman' }), null);

assert.equal(voiceDocId('cloned-hero-1'), Buffer.from('cloned-hero-1', 'utf8').toString('base64url'));
assert.notEqual(voiceDocId('a'), voiceDocId('b'));

console.log('voiceOwnership.selfcheck: ok');
