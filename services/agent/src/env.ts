/**
 * Agent-side env helpers. Localhost-only defaults; no testing/prod project hardcodes.
 */

export function isLocalMode(
  processEnv: NodeJS.ProcessEnv = process.env
): boolean {
  const okvevo = processEnv.OKVEVO_ENV?.trim().toLowerCase();
  if (okvevo === 'local') return true;
  if (okvevo === 'production' || okvevo === 'staging') return false;
  return processEnv.NODE_ENV !== 'production';
}

export function required(
  name: string,
  processEnv: NodeJS.ProcessEnv = process.env
): string {
  const v = processEnv[name]?.trim();
  if (v) return v;
  throw new Error(
    `Missing required env ${name}` +
      (isLocalMode(processEnv)
        ? ' (required even in local)'
        : ' (not local — refusing silent fallback)')
  );
}

export function localDefault(
  name: string,
  localhostValue: string,
  processEnv: NodeJS.ProcessEnv = process.env
): string {
  const v = processEnv[name]?.trim();
  if (v) return v;
  if (isLocalMode(processEnv)) return localhostValue;
  throw new Error(`Missing required env ${name}`);
}

/** Storage bucket — never fall back to okvevo-testing. */
export function getStorageBucketName(
  processEnv: NodeJS.ProcessEnv = process.env
): string {
  const v =
    processEnv.FIREBASE_STORAGE_BUCKET?.trim() ||
    processEnv.FB_STORAGE_BUCKET?.trim() ||
    processEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (v) return v;
  throw new Error(
    'Missing required env FIREBASE_STORAGE_BUCKET (or FB_STORAGE_BUCKET / NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)'
  );
}

export const env = {
  get isLocal() {
    return isLocalMode();
  },
  get port() {
    return Number(localDefault('PORT', '3001'));
  },
  get storageBucket() {
    return getStorageBucketName();
  },
};
