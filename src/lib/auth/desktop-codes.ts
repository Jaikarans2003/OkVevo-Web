import { randomBytes } from 'node:crypto';

import { env } from '@/config/env';
import { auth, db } from '@/lib/firebase-admin';

import {
  isAllowlistedDesktopRedirect,
  isUsableDesktopState,
} from './desktop-redirect';
import { tokensFromCustomTokenResponse } from './desktop-token-response';
import type { CustomTokenSignInBody } from './desktop-token-response';

export { tokensFromCustomTokenResponse } from './desktop-token-response';
export type { CustomTokenSignInBody } from './desktop-token-response';

const COLLECTION = 'desktopAuthCodes';
const TTL_MS = 60_000;

export class DesktopAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function newDesktopAuthCode(): string {
  return randomBytes(32).toString('base64url');
}

export async function mintDesktopAuthCode(
  idToken: string,
  redirect: string,
  state: string
): Promise<string> {
  if (!isAllowlistedDesktopRedirect(redirect)) {
    throw new DesktopAuthError(400, 'invalid_redirect');
  }
  if (!isUsableDesktopState(state)) {
    throw new DesktopAuthError(400, 'invalid_state');
  }

  let uid: string;
  try {
    uid = (await auth.verifyIdToken(idToken)).uid;
  } catch {
    throw new DesktopAuthError(401, 'invalid_token');
  }

  const code = newDesktopAuthCode();
  await db.collection(COLLECTION).doc(code).set({
    uid,
    state,
    exp: Date.now() + TTL_MS,
    used: false,
  });
  return code;
}

export type DesktopTokenBundle = {
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  uid: string;
  email: string | null;
  displayName: string | null;
};

async function profileForUid(uid: string): Promise<{ email: string | null; displayName: string | null }> {
  try {
    const user = await auth.getUser(uid);
    return {
      email: user.email ?? null,
      displayName: user.displayName?.trim() || null,
    };
  } catch {
    return { email: null, displayName: null };
  }
}

async function signInWithCustomToken(
  customToken: string,
  uid: string
): Promise<{
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  uid: string;
}> {
  const apiKey = env.firebase.apiKey;
  if (!apiKey) {
    throw new DesktopAuthError(500, 'missing_api_key');
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const body = (await res.json()) as CustomTokenSignInBody;
  const tokens = res.ok ? tokensFromCustomTokenResponse(body, uid) : null;
  if (!tokens) {
    console.error(
      'signInWithCustomToken failed',
      res.status,
      body.error?.message || 'missing_tokens'
    );
    throw new DesktopAuthError(502, 'token_exchange_failed');
  }
  return tokens;
}

export async function exchangeDesktopAuthCode(
  code: string,
  state: string
): Promise<DesktopTokenBundle> {
  if (!code || !isUsableDesktopState(state)) {
    throw new DesktopAuthError(400, 'invalid_grant');
  }

  const ref = db.collection(COLLECTION).doc(code);
  const uid = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new DesktopAuthError(400, 'invalid_grant');
    }
    const data = snap.data() as {
      uid?: string;
      state?: string;
      exp?: number;
      used?: boolean;
    };
    if (data.used) {
      throw new DesktopAuthError(400, 'invalid_grant');
    }
    if (data.state !== state) {
      throw new DesktopAuthError(400, 'invalid_grant');
    }
    if (typeof data.exp !== 'number' || Date.now() > data.exp) {
      throw new DesktopAuthError(400, 'invalid_grant');
    }
    if (!data.uid) {
      throw new DesktopAuthError(400, 'invalid_grant');
    }
    tx.update(ref, { used: true });
    return data.uid;
  });

  const customToken = await auth.createCustomToken(uid);
  const tokens = await signInWithCustomToken(customToken, uid);
  const profile = await profileForUid(uid);
  return { ...tokens, ...profile };
}

export async function mintDesktopCustomToken(
  refreshToken: string
): Promise<{ customToken: string; uid: string }> {
  const { uid } = await refreshDesktopAuthTokens(refreshToken);
  const customToken = await auth.createCustomToken(uid);
  return { customToken, uid };
}

export async function refreshDesktopAuthTokens(
  refreshToken: string
): Promise<DesktopTokenBundle> {
  if (!refreshToken) {
    throw new DesktopAuthError(400, 'invalid_grant');
  }
  const apiKey = env.firebase.apiKey;
  if (!apiKey) {
    throw new DesktopAuthError(500, 'missing_api_key');
  }

  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }
  );
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string;
    user_id?: string;
  };
  if (!res.ok || !body.access_token || !body.user_id) {
    throw new DesktopAuthError(400, 'invalid_grant');
  }

  const profile = await profileForUid(body.user_id);

  return {
    idToken: body.access_token,
    refreshToken: body.refresh_token || refreshToken,
    expiresIn: Number(body.expires_in) || 3600,
    uid: body.user_id,
    ...profile,
  };
}
