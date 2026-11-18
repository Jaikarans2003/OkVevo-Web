/**
 * Dedicated staging test users for billing timeline Layer 2 (plan §14.3).
 * Uses the Firebase Identity Toolkit REST API directly with the public Web
 * API key — no firebase-admin credentials needed in CI for this.
 */
import { L2_ENV } from './env';

const IDENTITY_BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';

export type TestUser = {
  uid: string;
  email: string;
  idToken: string;
};

/** Unique per-scenario email so runs never collide; invalid TLD keeps these out of real inboxes. */
export function scenarioEmail(scenario: string): string {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return `billing-l2-${scenario}-${stamp}@okvevo-l2-test.invalid`;
}

export async function createTestUser(scenario: string): Promise<TestUser> {
  const email = scenarioEmail(scenario);
  const password = `L2-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const res = await fetch(`${IDENTITY_BASE}:signUp?key=${L2_ENV.firebaseApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = (await res.json()) as { idToken?: string; localId?: string; error?: { message?: string } };
  if (!res.ok || !json.idToken || !json.localId) {
    throw new Error(`createTestUser(${scenario}) failed: ${json.error?.message ?? res.status}`);
  }
  return { uid: json.localId, email, idToken: json.idToken };
}

/** Self-delete via the user's own idToken. No admin credentials required. */
export async function deleteTestUser(user: TestUser): Promise<void> {
  const res = await fetch(`${IDENTITY_BASE}:delete?key=${L2_ENV.firebaseApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken: user.idToken }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn(`deleteTestUser(${user.email}) failed: ${res.status} ${text}`);
  }
}

/** Lazy-creates the wallet row server-side (same call AuthForm makes after sign-in). */
export async function ensureServerUser(idToken: string): Promise<void> {
  const res = await fetch(`${L2_ENV.baseUrl}/api/me`, {
    headers: { authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    throw new Error(`ensureServerUser failed: ${res.status}`);
  }
}
