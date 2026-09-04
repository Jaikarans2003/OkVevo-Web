/** Desktop round-trip redirect allowlist. One-time code is the security boundary. */

const ALLOWED_HOST = 'auth-callback';
const ALLOWED_PROTOCOLS = new Set(['hermes:', 'hermes-dev:']);

export function isAllowlistedDesktopRedirect(
  redirect: string | null | undefined
): boolean {
  if (!redirect) return false;
  try {
    const u = new URL(redirect);
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) return false;
    if (u.hostname !== ALLOWED_HOST) return false;
    if (u.username || u.password) return false;
    const path = u.pathname.replace(/\/+$/, '');
    if (path !== '') return false;
    return true;
  } catch {
    return false;
  }
}

export function desktopCallbackUrl(
  redirect: string,
  code: string,
  state: string
): string {
  const u = new URL(redirect);
  u.search = '';
  u.hash = '';
  u.searchParams.set('code', code);
  u.searchParams.set('state', state);
  return u.toString();
}

export function isUsableDesktopState(state: string | null | undefined): boolean {
  if (!state) return false;
  return state.length >= 8 && state.length <= 256;
}
