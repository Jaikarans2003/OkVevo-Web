/**
 * Billing timeline Layer 2 env (plan §14.3). Staging only, Razorpay test
 * keys only. Loaded by playwright.config.ts and every spec/helper in this
 * directory — never imported by app code.
 *
 * Mirrors the fail-closed guard in ../../scripts/cleanup-stale-test-subscriptions.ts.
 */

function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // optional — CI sets these as real env vars instead
    }
  }
}

loadDotEnv();

function required(name: string): string {
  const v = (process.env[name] ?? '').trim();
  if (!v) throw new Error(`billing-timeline-l2: missing required env var ${name}`);
  return v;
}

const razorpayKeyId = required('RAZORPAY_KEY_ID');
if (!razorpayKeyId.startsWith('rzp_test_')) {
  throw new Error(
    `billing-timeline-l2: refusing — RAZORPAY_KEY_ID is not rzp_test_* (got prefix "${razorpayKeyId.slice(0, 8)}"). Layer 2 only runs against Razorpay test mode.`
  );
}

export const L2_ENV = {
  /** Deployed staging origin, e.g. https://okvevo-web--okvevo-testing.us-central1.hosted.app */
  baseUrl: required('STAGING_BASE_URL').replace(/\/$/, ''),
  razorpayKeyId,
  razorpayKeySecret: required('RAZORPAY_KEY_SECRET'),
  /** Public Firebase Web API key — same one shipped to the browser, not a secret. */
  firebaseApiKey: required('NEXT_PUBLIC_FIREBASE_API_KEY'),
};
