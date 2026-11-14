import assert from 'node:assert/strict'
import {
  OKVEVO_MAC_ARTIFACT,
  OKVEVO_WIN_ARTIFACT,
  PRODUCTION_NIA_RELEASES_BASE,
  STAGING_NIA_RELEASES_BASE,
  niaDownloadUrls,
} from './nia-downloads.ts'

const prod = niaDownloadUrls(PRODUCTION_NIA_RELEASES_BASE)
assert.equal(prod.mac, 'https://releases.okvevo.com/OkVevo-mac-arm64.dmg')
assert.equal(prod.win, 'https://releases.okvevo.com/OkVevo-win-x64.exe')
assert.equal(prod.mac.endsWith(OKVEVO_MAC_ARTIFACT), true)
assert.equal(prod.win.endsWith(OKVEVO_WIN_ARTIFACT), true)

const staging = niaDownloadUrls(STAGING_NIA_RELEASES_BASE)
assert.equal(staging.mac, 'https://releases.okvevo.com/okvevo/staging/OkVevo-mac-arm64.dmg')
assert.equal(staging.win, 'https://releases.okvevo.com/okvevo/staging/OkVevo-win-x64.exe')

assert.equal(
  niaDownloadUrls('https://releases.okvevo.com/').mac,
  'https://releases.okvevo.com/OkVevo-mac-arm64.dmg'
)

console.log('nia-downloads.selfcheck: ok')
