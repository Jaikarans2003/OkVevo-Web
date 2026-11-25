/**
 * Browser helpers for OkVevo HTTP APIs (Bearer Firebase ID token).
 * Org header: pass `org` explicitly (string = X-OkVevo-Org, null = no header).
 * When `org` is omitted, fall back to the localStorage choice — only for
 * pages outside the dashboard (e.g. pricing checkout). Dashboard code always
 * passes org explicitly from the URL account.
 */
import type { User } from 'firebase/auth'

import { readActiveOrgPublicId } from '@/lib/orgs/activeOrg'

export type AuthedRequestInit = RequestInit & {
  /** Explicit org header choice. null = no header. Omitted = localStorage fallback. */
  org?: string | null
}

export async function authedFetch(
  user: User,
  path: string,
  init: AuthedRequestInit = {}
): Promise<Response> {
  const { org, ...rest } = init
  const idToken = await user.getIdToken()
  const headers = new Headers(rest.headers)
  headers.set('Authorization', `Bearer ${idToken}`)
  if (rest.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (org !== undefined) {
    if (org) headers.set('X-OkVevo-Org', org)
  } else if (!headers.has('X-OkVevo-Org')) {
    const stored = readActiveOrgPublicId()
    if (stored) headers.set('X-OkVevo-Org', stored)
  }
  return fetch(path, { ...rest, headers })
}

export async function authedJson<T>(
  user: User,
  path: string,
  init: AuthedRequestInit = {}
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
