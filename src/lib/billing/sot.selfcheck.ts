/**
 * P0 billing SoT: mutating Razorpay routes must verify an ID token, derive uid
 * from that token, and read users/{uid} — never users/{uid}/subscriptions or
 * razorpaySubscriptions, never a client-supplied userId.
 *
 * Run: npx tsx src/lib/billing/sot.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '../..');

function src(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

const ROUTES = [
  'app/api/razorpay/cancel-subscription/route.ts',
  'app/api/razorpay/create-payment-link/route.ts',
  'app/api/razorpay/update-subscription/route.ts',
  'app/api/razorpay/cancel-scheduled-change/route.ts',
  'app/api/razorpay/create-subscription/route.ts',
  'app/api/razorpay/upgrade-upi/route.ts',
] as const;

const LEGACY_READ = [
  "collection('razorpaySubscriptions')",
  'collection("razorpaySubscriptions")',
  ".collection('subscriptions')",
  '.collection("subscriptions")',
  "collection(db, 'users', userId, 'subscriptions')",
  'collection(db, "users", userId, "subscriptions")',
  "collection(db, 'users', user.uid, 'subscriptions')",
];

for (const rel of ROUTES) {
  const text = src(rel);
  assert.match(text, /uidFromIdToken/, `${rel} must verify ID token via uidFromIdToken`);
  for (const needle of LEGACY_READ) {
    assert.ok(!text.includes(needle), `${rel} still reads legacy collection: ${needle}`);
  }
  assert.doesNotMatch(
    text,
    /const \{[^}]*userId[^}]*\} = body/,
    `${rel} must not take userId from the JSON body`
  );
}

const clientFiles = [
  'services/SubscriptionService.ts',
  'app/billing/[[...slug]]/page.tsx',
  'middleware/subscriptionCheck.ts',
  'lib/billing/userSoT.ts',
];
for (const rel of clientFiles) {
  const text = src(rel);
  for (const needle of LEGACY_READ) {
    assert.ok(!text.includes(needle), `${rel} still reads legacy collection: ${needle}`);
  }
}

const billingPage = src('app/billing/[[...slug]]/page.tsx');
assert.match(billingPage, /Current Plan/, 'billing shows Current Plan card');
assert.match(billingPage, /Upgrade available/, 'billing shows Upgrade available card');
assert.match(billingPage, /Plan remaining/, 'billing shows Plan remaining bar');
assert.match(billingPage, /Additional remaining/, 'billing shows Additional remaining bar');
assert.match(billingPage, /Change Plan/, 'billing has Change Plan');
assert.match(billingPage, /Cancel Subscription/, 'billing has Cancel Subscription');
assert.match(billingPage, /Add Credits/, 'billing keeps Add Credits');
assert.match(billingPage, /Recent Transactions/, 'billing keeps Recent Transactions');
assert.match(billingPage, /changeSubscriptionPlan/, 'Change Plan uses Phase 2 update route');
assert.doesNotMatch(billingPage, /getUserSubscription/, 'billing reads users\/{uid} snapshot only');
assert.doesNotMatch(billingPage, /Recent Payment/, 'legacy Recent Payment card removed');
assert.doesNotMatch(billingPage, /\bGST\b|\btax\b|\bTax\b/, 'no tax line on billing');
assert.doesNotMatch(
  billingPage,
  /Math\.round\(\(billing\?\.remainingPct/,
  'billing must floor remaining %, not round'
);
assert.doesNotMatch(billingPage, /Number\.isInteger\(pct\)/, 'UsageBar must accept two-decimal pct');
assert.match(billingPage, /formatPctLabel/, 'UsageBar labels with formatPctLabel');
assert.match(
  billingPage,
  /\/api\/razorpay\/cancel-subscription/,
  'billing cancel posts to cancel-subscription'
);
assert.match(
  billingPage,
  /Authorization: `Bearer \$\{idToken\}`/,
  'billing mutations send the ID token'
);
assert.doesNotMatch(
  billingPage,
  /cancel-subscription[\s\S]{0,400}userId: userProfile\.uid/,
  'billing cancel must not send client userId'
);

const changeClient = src('lib/billing/changeSubscription.ts');
assert.match(changeClient, /\/api\/razorpay\/update-subscription/, 'plan change hits update-subscription');
assert.match(changeClient, /\/api\/razorpay\/upgrade-upi/, 'UPI falls back to upgrade-upi');
assert.match(changeClient, /content-type/, 'plan change parses JSON only when the body is JSON');
assert.doesNotMatch(changeClient, /userId/, 'plan change client must not send userId');

const updateRoute = src('app/api/razorpay/update-subscription/route.ts');
assert.match(updateRoute, /upi_upgrade_required/);
assert.match(updateRoute, /subscriptions\.fetch/);
assert.doesNotMatch(updateRoute, /payment mode is upi/);

const upgradeUpi = src('app/api/razorpay/upgrade-upi/route.ts');
assert.match(upgradeUpi, /scheduleChangeAt\(/);
assert.match(upgradeUpi, /cycle_end/);
assert.match(upgradeUpi, /upgrade_flow: 'true'/);

const payLink = src('app/api/razorpay/create-payment-link/route.ts');
assert.match(payLink, /topUpAmountMinorUnits/);
assert.match(payLink, /razorpayErrorDescription/);
assert.match(payLink, /parseBillingCurrency/);

const creditsService = src('services/CreditsService.ts');
assert.match(creditsService, /paymentMethod: typeof data\.paymentMethod === 'string'/);
assert.doesNotMatch(creditsService, /data\.payment_method/);


const checkout = src('components/shared/payment/RazorpayCheckout.tsx');
assert.match(
  checkout,
  /create-subscription[\s\S]*Authorization: `Bearer \$\{idToken\}`/,
  'checkout must send the ID token'
);
assert.doesNotMatch(
  checkout,
  /create-subscription[\s\S]{0,500}userId: user\.uid/,
  'checkout must not send client userId'
);

console.log('billing sot.selfcheck: ok');
