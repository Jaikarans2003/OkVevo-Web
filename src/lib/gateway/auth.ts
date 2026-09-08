import { NextRequest } from 'next/server';

/** Bearer (chat) or Key (fal_client.SyncClient) Firebase ID token. */
export function gatewayIdToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || '';
  const m = /^(?:bearer|key)\s+(\S+)/i.exec(header.trim());
  return m?.[1] ?? null;
}
