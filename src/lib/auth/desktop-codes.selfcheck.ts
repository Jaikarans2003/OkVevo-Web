/**
 * Desktop code exchange: Identity Toolkit custom-token responses omit localId.
 * Run: npx tsx src/lib/auth/desktop-codes.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { tokensFromCustomTokenResponse } from './desktop-token-response.ts';

const uid = 'uid-from-code-doc';
const ok = tokensFromCustomTokenResponse(
  {
    idToken: 'id',
    refreshToken: 'refresh',
    expiresIn: '3600',
  },
  uid
);
assert.deepEqual(ok, {
  idToken: 'id',
  refreshToken: 'refresh',
  expiresIn: 3600,
  uid,
});

assert.equal(
  tokensFromCustomTokenResponse(
    { idToken: 'id', refreshToken: 'refresh' },
    uid
  )?.expiresIn,
  3600,
  'missing expiresIn defaults to 3600'
);

assert.equal(
  tokensFromCustomTokenResponse({ idToken: 'id' }, uid),
  null,
  'refreshToken required'
);
assert.equal(
  tokensFromCustomTokenResponse({ refreshToken: 'r' }, uid),
  null,
  'idToken required'
);
assert.equal(
  tokensFromCustomTokenResponse({ idToken: 'id', refreshToken: 'r' }, ''),
  null,
  'uid from code doc is required; do not rely on localId'
);

console.log('desktop-codes.selfcheck: ok');
