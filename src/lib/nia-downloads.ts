export const PRODUCTION_NIA_RELEASES_BASE = 'https://releases.okvevo.com'
export const STAGING_NIA_RELEASES_BASE = 'https://releases.okvevo.com/okvevo/staging'
export const NIA_MAC_ARTIFACT = 'Nia-mac-arm64.dmg'
export const NIA_WIN_ARTIFACT = 'Nia-win-x64.exe'
export const STAGING_MAC_ARTIFACT = 'OkVevo-mac-arm64.dmg'
export const STAGING_WIN_ARTIFACT = 'OkVevo-win-x64.exe'

const RELEASES_BASE_FROM_ENV = (process.env.NEXT_PUBLIC_NIA_RELEASES_BASE ?? '').trim()

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Static NEXT_PUBLIC_ read so the client bundle inlines the value. */
export function niaReleasesBase(): string {
  if (RELEASES_BASE_FROM_ENV) return stripSlash(RELEASES_BASE_FROM_ENV)
  return PRODUCTION_NIA_RELEASES_BASE
}

export function niaDownloadUrls(base = niaReleasesBase()): {
  mac: string
  win: string
} {
  const root = stripSlash(base)
  const staging = root === STAGING_NIA_RELEASES_BASE || root.endsWith('/okvevo/staging')
  return {
    mac: `${root}/${staging ? STAGING_MAC_ARTIFACT : NIA_MAC_ARTIFACT}`,
    win: `${root}/${staging ? STAGING_WIN_ARTIFACT : NIA_WIN_ARTIFACT}`,
  }
}
