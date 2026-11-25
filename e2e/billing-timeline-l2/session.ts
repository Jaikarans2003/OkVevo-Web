/**
 * Signed-in dashboard session. storageState covers cookies and localStorage.
 * Firebase Auth lives in IndexedDB (`firebaseLocalStorageDb`), which
 * storageState does not keep, so each test primes a same-origin document,
 * writes the saved records, then navigates for real.
 */
import fs from 'node:fs'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

import { L2_ENV } from './env'

export const AUTH_DIR = path.resolve(process.cwd(), 'e2e/billing-timeline-l2/.auth')

export type RoleName = 'individual' | 'orgOwner' | 'superOwner' | 'childMember'

export type Manifest = {
  individual: { email: string }
  orgOwner: { email: string; orgPublicId: string }
  superOwner: {
    email: string
    orgPublicId: string
    childPublicId: string
    superName: string
    childName: string
  }
  childMember: { email: string; orgPublicId: string }
}

export type Secrets = { superJoinCode: string }

export const MANIFEST_PATH = path.join(AUTH_DIR, 'manifest.json')
export const SECRETS_PATH = path.join(AUTH_DIR, 'secrets.json')
export const COST_PATH = path.join(AUTH_DIR, 'vendor-cost.json')

export function storagePath(role: RoleName): string {
  return path.join(AUTH_DIR, `${role}.json`)
}

export function idbPath(role: RoleName): string {
  return path.join(AUTH_DIR, `${role}.idb.json`)
}

export function readManifest(): Manifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
}

export function readSecrets(): Secrets {
  return JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8')) as Secrets
}

export async function dumpFirebaseIdb(page: Page): Promise<unknown[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('firebaseLocalStorageDb')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
      db.close()
      return []
    }
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction('firebaseLocalStorage', 'readonly')
      const req = tx.objectStore('firebaseLocalStorage').getAll()
      req.onsuccess = () => resolve(req.result as unknown[])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return rows
  })
}

export function idbHasToken(rows: unknown[]): boolean {
  for (const row of rows) {
    try {
      const raw = (row as { value?: unknown }).value
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw
      const token = (value as { stsTokenManager?: { accessToken?: string } })?.stsTokenManager?.accessToken
      if (typeof token === 'string' && token.length > 0) return true
    } catch {
      /* keep looking */
    }
  }
  return false
}

export async function restoreFirebaseIdb(page: Page, role: RoleName): Promise<void> {
  const records = JSON.parse(fs.readFileSync(idbPath(role), 'utf8')) as unknown[]
  const origin = L2_ENV.baseUrl
  await page.route('**/*', async (route) => {
    const req = route.request()
    if (req.resourceType() === 'document' && req.url().startsWith(origin)) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>auth</title>',
      })
      return
    }
    await route.abort()
  })
  try {
    await page.goto(`${origin}/l2-auth-prime`, { waitUntil: 'commit' })
    await page.evaluate(async (recs) => {
      await new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('firebaseLocalStorageDb')
        del.onsuccess = () => resolve()
        del.onerror = () => reject(del.error)
        del.onblocked = () => resolve()
      })
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('firebaseLocalStorageDb', 1)
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains('firebaseLocalStorage')) {
            open.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' })
          }
        }
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('firebaseLocalStorage', 'readwrite')
        const store = tx.objectStore('firebaseLocalStorage')
        for (const rec of recs as { fbase_key: string }[]) store.put(rec)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    }, records)
  } finally {
    await page.unroute('**/*')
  }
}

export async function hideLoader(page: Page): Promise<void> {
  await page
    .locator('.ok-loader--full')
    .first()
    .waitFor({ state: 'hidden', timeout: 90_000 })
    .catch(() => {})
}

export type AxeHit = { id: string; impact: string; page: string; target: string }

const axeHits: AxeHit[] = []

export function collectedAxeHits(): AxeHit[] {
  return axeHits
}

/** Third-party iframes are excluded. Serious and critical are recorded and asserted once at the end. */
export async function runAxe(page: Page, where: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).exclude('iframe').analyze()
  for (const violation of results.violations) {
    if (violation.impact !== 'serious' && violation.impact !== 'critical') continue
    const target = (violation.nodes[0]?.target ?? []).join(' ').slice(0, 180)
    const hit: AxeHit = { id: violation.id, impact: violation.impact ?? '', page: where, target }
    axeHits.push(hit)
    console.log(`L2_AXE ${JSON.stringify(hit)}`)
  }
}

export async function visit(page: Page, urlPath: string, heading: string): Promise<void> {
  await page.goto(urlPath)
  await hideLoader(page)
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  await runAxe(page, urlPath)
  const refresh = page.getByRole('button', { name: `Refresh ${heading}`, exact: true })
  if ((await refresh.count()) > 0) {
    await refresh.first().click()
    await expect(page.locator('.ok-loader--full')).toBeHidden()
  }
}

type BrowserInit = { method?: string; body?: unknown; org?: string }

export async function browserJson(
  page: Page,
  urlPath: string,
  init: BrowserInit = {}
): Promise<{ status: number; json: unknown }> {
  return page.evaluate(async ({ urlPath, init }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('firebaseLocalStorageDb')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction('firebaseLocalStorage', 'readonly')
      const req = tx.objectStore('firebaseLocalStorage').getAll()
      req.onsuccess = () => resolve(req.result as unknown[])
      req.onerror = () => reject(req.error)
    })
    db.close()
    let token = ''
    for (const row of rows) {
      try {
        const raw = (row as { value?: unknown }).value
        const value = typeof raw === 'string' ? JSON.parse(raw) : raw
        const access = (value as { stsTokenManager?: { accessToken?: string } })?.stsTokenManager?.accessToken
        if (typeof access === 'string' && access) {
          token = access
          break
        }
      } catch {
        /* next row */
      }
    }
    if (!token) throw new Error('signed-in session has no access token')
    const headers: Record<string, string> = { authorization: `Bearer ${token}` }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (init.org) headers['x-okvevo-org'] = init.org
    const res = await fetch(urlPath, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    const json = (await res.json().catch(() => ({}))) as unknown
    return { status: res.status, json }
  }, { urlPath, init })
}
