import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadServiceAccount(): Record<string, unknown> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return JSON.parse(json);
  }

  const b64 =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  }

  throw new Error(
    'Missing Firebase service account key (FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_KEY)'
  );
}

export function getStorageBucketName(): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.FB_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'text2video-16cbf.firebasestorage.app'
  );
}

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert(loadServiceAccount() as Parameters<typeof cert>[0]),
    storageBucket: getStorageBucketName(),
  });
}

const app = getAdminApp();

export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
