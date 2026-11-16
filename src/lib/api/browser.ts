/**
 * Browser helpers for OkVevo HTTP APIs (Bearer Firebase ID token).
 */
import type { User } from 'firebase/auth'

export async function authedFetch(
  user: User,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const idToken = await user.getIdToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${idToken}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(path, { ...init, headers })
}

export async function authedJson<T>(
  user: User,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await authedFetch(user, path, init)
  let data: unknown = null
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    try {
      data = await res.json()
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    const err =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `request_failed_${res.status}`
    throw new Error(err)
  }
  return data as T
}
