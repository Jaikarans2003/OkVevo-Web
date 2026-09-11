/**
 * Single read path for environment-dependent application values.
 * Fallbacks are localhost / empty only — never *.web.app, *.run.app, okvevo.com, or account IDs.
 * Outside local, missing required vars throw (loud deploy failure).
 *
 * Next.js client bundles only inline *static* process.env.NEXT_PUBLIC_* / NODE_ENV
 * accesses. Dynamic process.env[name] is empty in the browser — never use it for
 * values that client components read.
 */

const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

function missingEnv(name: string, local: boolean): never {
  throw new Error(
    `Missing required env ${name}` +
      (local
        ? ' (required even in local)'
        : ' (not local — refusing silent fallback)')
  );
}

/** Prefer OKVEVO_ENV when set; else NODE_ENV === 'development'. */
export function isLocalMode(
  processEnv?: NodeJS.ProcessEnv
): boolean {
  // Injectable env for selfcheck only — runtime path must use static access (Next client).
  if (processEnv) {
    const okvevo = processEnv.OKVEVO_ENV?.trim().toLowerCase();
    if (okvevo === 'local') return true;
    if (okvevo === 'production' || okvevo === 'staging') return false;
    return processEnv.NODE_ENV === 'development';
  }
  const okvevo = process.env.OKVEVO_ENV?.trim().toLowerCase();
  if (okvevo === 'local') return true;
  if (okvevo === 'production' || okvevo === 'staging') return false;
  return process.env.NODE_ENV === 'development';
}

export function required(
  name: string,
  processEnv: NodeJS.ProcessEnv
): string {
  const v = processEnv[name]?.trim();
  if (v) return v;
  missingEnv(name, isLocalMode(processEnv));
}

export function localDefault(
  name: string,
  localhostValue: string,
  processEnv: NodeJS.ProcessEnv
): string {
  const v = processEnv[name]?.trim();
  if (v) return v;
  if (isLocalMode(processEnv)) return localhostValue;
  throw new Error(`Missing required env ${name}`);
}

export function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigins(
  processEnv?: NodeJS.ProcessEnv
): string[] {
  if (processEnv) {
    const raw = processEnv.ALLOWED_ORIGINS?.trim();
    if (raw) return parseOrigins(raw);
    if (isLocalMode(processEnv)) return [...LOCAL_ORIGINS];
    throw new Error('Missing required env ALLOWED_ORIGINS');
  }
  // Static access — server route only (ALLOWED_ORIGINS is not NEXT_PUBLIC_).
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (raw) return parseOrigins(raw);
  if (isLocalMode()) return [...LOCAL_ORIGINS];
  throw new Error('Missing required env ALLOWED_ORIGINS');
}

function requirePublic(
  value: string | undefined,
  name: string
): string {
  const v = value?.trim();
  if (v) return v;
  missingEnv(name, isLocalMode());
}

function publicOrLocal(
  value: string | undefined,
  name: string,
  localhostValue: string
): string {
  const v = value?.trim();
  if (v) return v;
  if (isLocalMode()) return localhostValue;
  throw new Error(`Missing required env ${name}`);
}

export const env = {
  get isLocal() {
    return isLocalMode();
  },
  get siteUrl() {
    return publicOrLocal(
      process.env.NEXT_PUBLIC_SITE_URL,
      'NEXT_PUBLIC_SITE_URL',
      'http://localhost:3000'
    ).replace(/\/$/, '');
  },
  get agentUrl() {
    // Server-only. Static access still works under Node.
    return publicOrLocal(
      process.env.AGENT_URL,
      'AGENT_URL',
      'http://localhost:3001'
    ).replace(/\/$/, '');
  },
  /** Empty = same-origin; never default to a .run.app */
  get agentApiOrigin() {
    return (process.env.NEXT_PUBLIC_AGENT_API_ORIGIN ?? '').trim().replace(/\/$/, '');
  },
  get allowedOrigins() {
    return resolveAllowedOrigins();
  },
  get awsRegion() {
    const fromEnv =
      process.env.AWS_REGION?.trim() ||
      process.env.AWS_DEFAULT_REGION?.trim();
    if (fromEnv) return fromEnv;
    if (isLocalMode()) return 'us-east-1';
    throw new Error('Missing required env AWS_REGION');
  },
  get agentBackend() {
    return (process.env.AGENT_BACKEND ?? '').trim();
  },
  get agentcoreRuntimeArn() {
    return requirePublic(process.env.AGENTCORE_RUNTIME_ARN, 'AGENTCORE_RUNTIME_ARN');
  },
  firebase: {
    get apiKey() {
      return (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '').trim();
    },
    get authDomain() {
      return (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '').trim();
    },
    get projectId() {
      return (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '').trim();
    },
    get storageBucket() {
      return requirePublic(
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
      );
    },
    get messagingSenderId() {
      return (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '').trim();
    },
    get appId() {
      return (process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '').trim();
    },
    get databaseURL() {
      const explicit = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '').trim();
      if (explicit) return explicit;
      const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '').trim();
      if (projectId) {
        return `https://${projectId}-default-rtdb.firebaseio.com`;
      }
      return '';
    },
  },
  /** Marketing hero video — empty in local is fine; never hardcode a Storage URL */
  get marketingVideoUrl() {
    return (process.env.NEXT_PUBLIC_MARKETING_VIDEO_URL ?? '').trim();
  },
  get demoVideoUrl() {
    return (process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? '').trim();
  },
  razorpay: {
    get keyId() {
      return (process.env.RAZORPAY_KEY_ID ?? '').trim();
    },
    get keySecret() {
      return (process.env.RAZORPAY_KEY_SECRET ?? '').trim();
    },
    get publicKeyId() {
      return (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '').trim();
    },
    plans: {
      get starterMonthly() {
        return (process.env.RAZORPAY_STARTER_PLAN_ID ?? '').trim();
      },
      get starterAnnual() {
        return (process.env.RAZORPAY_STARTER_ANNUAL_PLAN_ID ?? '').trim();
      },
      get proMonthly() {
        return (process.env.RAZORPAY_PRO_PLAN_ID ?? '').trim();
      },
      get proAnnual() {
        return (process.env.RAZORPAY_PRO_ANNUAL_PLAN_ID ?? '').trim();
      },
      get maxMonthly() {
        return (process.env.RAZORPAY_MAX_PLAN_ID ?? process.env.RAZORPAY_HOBBY_PLAN_ID ?? '').trim();
      },
      get maxAnnual() {
        return (
          process.env.RAZORPAY_MAX_ANNUAL_PLAN_ID ??
          process.env.RAZORPAY_HOBBY_ANNUAL_PLAN_ID ??
          ''
        ).trim();
      },
    },
  },
  get cronSecret() {
    return (process.env.CRON_SECRET ?? '').trim();
  },
};
