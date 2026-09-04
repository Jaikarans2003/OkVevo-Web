/**
 * Desktop redirect allowlist: hermes://auth-callback and hermes-dev:// only.
 * Run: npx tsx src/lib/auth/desktop-redirect.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  desktopCallbackUrl,
  isAllowlistedDesktopRedirect,
  isUsableDesktopState,
} from './desktop-redirect.ts';

assert.equal(isAllowlistedDesktopRedirect('hermes://auth-callback'), true);
assert.equal(isAllowlistedDesktopRedirect('hermes-dev://auth-callback'), true);
assert.equal(isAllowlistedDesktopRedirect('hermes://auth-callback/'), true);
assert.equal(
  isAllowlistedDesktopRedirect('hermes://auth-callback?unused=1'),
  true,
  'query on an allowlisted host is still the auth-callback kind'
);

assert.equal(isAllowlistedDesktopRedirect('https://evil'), false);
assert.equal(isAllowlistedDesktopRedirect('https://evil.example/login'), false);
assert.equal(isAllowlistedDesktopRedirect('hermes://mcp/install'), false);
assert.equal(isAllowlistedDesktopRedirect('hermes://plugin/install'), false);
assert.equal(isAllowlistedDesktopRedirect('hermes://auth-callback/extra'), false);
assert.equal(isAllowlistedDesktopRedirect('hermes://auth-callback@evil'), false);
assert.equal(isAllowlistedDesktopRedirect('nia://auth-callback'), false);
assert.equal(isAllowlistedDesktopRedirect(''), false);
assert.equal(isAllowlistedDesktopRedirect(null), false);

assert.equal(isUsableDesktopState('abcdefgh'), true);
assert.equal(isUsableDesktopState('short'), false);
assert.equal(isUsableDesktopState(''), false);

const bounced = desktopCallbackUrl('hermes-dev://auth-callback', 'code-1', 'state-1');
assert.equal(bounced.startsWith('hermes-dev://auth-callback'), true);
assert.match(bounced, /[?&]code=code-1/);
assert.match(bounced, /[?&]state=state-1/);

console.log('desktop-redirect.selfcheck: ok');
