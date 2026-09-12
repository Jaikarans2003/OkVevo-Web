import { NextRequest } from 'next/server';
import { auth } from '@/lib/firebase-admin';

/** Bearer (chat) or Key (fal_client.SyncClient) Firebase ID token. */
export function gatewayIdToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || '';
  const m = /^(?:bearer|key)\s+(\S+)/i.exec(header.trim());
  return m?.[1] ?? null;
}

export type RequestUser = {
  uid: string;
  email: string;
  name: string;
};

/** Verify the Authorization token and return uid. Never trust a client-supplied userId. */
export async function uidFromIdToken(request: NextRequest): Promise<RequestUser | null> {
  const token = gatewayIdToken(request);
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || 'Nia user',
    };
  } catch {
    return null;
  }
}
