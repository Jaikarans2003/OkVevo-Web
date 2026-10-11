import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { env } from '@/config/env';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const key =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FB_SERVICE_ACCOUNT_KEY;

  if (!key) {
    throw new Error('Missing Firebase service account key');
  }

  const serviceAccount = JSON.parse(
    Buffer.from(key, 'base64').toString('utf-8')
  );

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: env.firebase.storageBucket,
  });
}

const app = getAdminApp();

export const db = getFirestore(app);
export const auth = getAuth(app);

export function getAdminBucket() {
  return getStorage(app).bucket(env.firebase.storageBucket);
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  return (await readAdminSession(token)) === 'admin';
}

/** Admin custom claim only. Email lists are not admin. Expired tokens are invalid. */
export async function readAdminSession(
  token: string
): Promise<'admin' | 'user' | 'invalid'> {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.admin === true ? 'admin' : 'user';
  } catch (error) {
    console.error('Token verification error:', error);
    return 'invalid';
  }
}

const ADMIN_SESSION_MS = 60 * 60 * 1000;

export async function createAdminSessionCookie(idToken: string): Promise<string> {
  return auth.createSessionCookie(idToken, { expiresIn: ADMIN_SESSION_MS });
}

/** Session cookie with revocation check. Admin custom claim only. */
export async function readAdminSessionCookie(
  cookie: string
): Promise<'admin' | 'user' | 'invalid'> {
  if (!cookie) return 'invalid';
  try {
    const decoded = await auth.verifySessionCookie(cookie, true);
    return decoded.admin === true ? 'admin' : 'user';
  } catch (error) {
    console.error('Session cookie verification error:', error);
    return 'invalid';
  }
}
