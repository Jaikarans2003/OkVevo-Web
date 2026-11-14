export const PRODUCTION_NIA_RELEASES_BASE = 'https://releases.okvevo.com'
export const STAGING_NIA_RELEASES_BASE = 'https://releases.okvevo.com/okvevo/staging'
/** Stable installer names written by OkVevo-Nia Publish (prod root) and Desktop staging pack. */
export const OKVEVO_MAC_ARTIFACT = 'OkVevo-mac-arm64.dmg'
export const OKVEVO_WIN_ARTIFACT = 'OkVevo-win-x64.exe'
/** Legacy filenames — use only for Cloudflare redirects / old bookmarks. */
export const NIA_MAC_ARTIFACT = 'Nia-mac-arm64.dmg'
export const NIA_WIN_ARTIFACT = 'Nia-win-x64.exe'

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
  return {
    mac: `${root}/${OKVEVO_MAC_ARTIFACT}`,
    win: `${root}/${OKVEVO_WIN_ARTIFACT}`,
  }
}
