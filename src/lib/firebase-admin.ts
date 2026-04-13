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

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    
    // Check if user has admin claim or is in admin list
    if (decodedToken.admin === true) {
      return true;
    }

    // Alternatively, check against admin emails list
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (decodedToken.email && adminEmails.includes(decodedToken.email)) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}
