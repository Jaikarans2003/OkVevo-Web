import assert from 'node:assert/strict'
import {
  NIA_MAC_ARTIFACT,
  NIA_WIN_ARTIFACT,
  PRODUCTION_NIA_RELEASES_BASE,
  STAGING_NIA_RELEASES_BASE,
  niaDownloadUrls,
} from './nia-downloads.ts'

const prod = niaDownloadUrls(PRODUCTION_NIA_RELEASES_BASE)
assert.equal(prod.mac, 'https://releases.okvevo.com/Nia-mac-arm64.dmg')
assert.equal(prod.win, 'https://releases.okvevo.com/Nia-win-x64.exe')
assert.equal(prod.mac.endsWith(NIA_MAC_ARTIFACT), true)
assert.equal(prod.win.endsWith(NIA_WIN_ARTIFACT), true)

const staging = niaDownloadUrls(STAGING_NIA_RELEASES_BASE)
assert.equal(staging.mac, 'https://releases.okvevo.com/staging/Nia-mac-arm64.dmg')
assert.equal(staging.win, 'https://releases.okvevo.com/staging/Nia-win-x64.exe')

assert.equal(
  niaDownloadUrls('https://releases.okvevo.com/').mac,
  'https://releases.okvevo.com/Nia-mac-arm64.dmg'
)

console.log('nia-downloads.selfcheck: ok')
