import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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
  });
}

const app = getAdminApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
