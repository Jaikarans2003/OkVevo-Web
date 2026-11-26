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
  'app/dashboard/billing/[[...slug]]/page.tsx',
  'components/billing/AccountBillingActions.tsx',
  'components/portal/dashboard/personal/BillingBody.tsx',
  'components/portal/dashboard/org/BillingModule.tsx',
  'lib/billing/userSoT.ts',
  'services/CreditsService.ts',
];
for (const rel of clientFiles) {
  const text = src(rel);
  for (const needle of LEGACY_READ) {
    assert.ok(!text.includes(needle), `${rel} still reads legacy collection: ${needle}`);
  }
}

const redirect = src('app/dashboard/billing/[[...slug]]/page.tsx');
assert.match(redirect, /router\.replace/, 'old billing URL redirects into the dashboard');
const billingPage = src('components/billing/AccountBillingActions.tsx');
assert.match(src('components/portal/dashboard/personal/BillingBody.tsx'), /AccountBillingActions/);
assert.match(src('components/portal/dashboard/org/BillingModule.tsx'), /AccountBillingActions/);
assert.match(billingPage, /Current Plan/, 'billing shows current plan');
assert.match(billingPage, /Upgrade available/, 'billing shows upgrade');
assert.match(billingPage, /Your credits · plan/, 'billing shows plan credits');
assert.match(billingPage, /Your credits · additional/, 'billing shows additional credits');
assert.match(billingPage, /Change Plan/, 'billing can change plan');
assert.match(billingPage, /Cancel Subscription/, 'billing can cancel');
assert.match(billingPage, /Add Credits/, 'billing can add credits');
assert.match(billingPage, /Recent Transactions/, 'billing shows recent transactions');
assert.match(billingPage, /changeSubscriptionPlan/, 'plan change uses changeSubscriptionPlan');
assert.doesNotMatch(billingPage, /getUserSubscription/, 'billing reads users\/{uid} snapshot only');
assert.doesNotMatch(billingPage, /Recent Payment/, 'legacy Recent Payment card removed');
assert.doesNotMatch(billingPage, /\bGST\b|\btax\b|\bTax\b/, 'no tax line on billing');
assert.doesNotMatch(
  billingPage,
  /Math\.round\(\(billing\?\.remainingPct/,
  'billing must floor remaining %, not round'
);
assert.doesNotMatch(billingPage, /Number\.isInteger\(pct\)/, 'UsageBar must accept two-decimal pct');
const usageBar = src('components/billing/UsageBar.tsx');
assert.match(billingPage, /UsageBar/, 'billing renders UsageBar');
assert.match(usageBar, /formatPctLabel/, 'UsageBar labels with formatPctLabel');
assert.doesNotMatch(usageBar, /Number\.isInteger\(pct\)/, 'UsageBar must accept two-decimal pct');
assert.match(billingPage, /\/api\/razorpay\/cancel-subscription/, 'cancel posts to cancel-subscription');
assert.match(billingPage, /showCancelModal && canPurchase/, 'prepaid wallets do not get the cancel dialog');
assert.match(billingPage, /showChangeModal && canPurchase/, 'prepaid wallets do not get the change dialog');
assert.match(
  billingPage,
  /authedFetch|Authorization: `Bearer \$\{idToken\}`/,
  'billing calls use the ID token'
);
assert.match(
  src('lib/api/browser.ts'),
  /Authorization.*Bearer \$\{idToken\}/,
  'authedFetch attaches Bearer ID token'
);
assert.doesNotMatch(
  billingPage,
  /cancel-subscription[\s\S]{0,400}userId: userProfile\.uid/,
  'billing cancel must not send client userId'
);

const changeClient = src('lib/billing/changeSubscription.ts');
assert.match(changeClient, /\/api\/razorpay\/upgrade-upi/, 'plan change uses new-subscription route');
assert.doesNotMatch(changeClient, /upi_upgrade_required/, 'no card→UPI fallback');
assert.match(changeClient, /authedFetch/, 'plan change uses authedFetch (org header)');
assert.match(changeClient, /content-type|contentType/, 'plan change parses JSON only when the body is JSON');
assert.doesNotMatch(changeClient, /userId/, 'plan change client must not send userId');

const updateRoute = src('app/api/razorpay/update-subscription/route.ts');
assert.match(updateRoute, /export \{ POST \} from '\.\.\/upgrade-upi\/route'/);
assert.doesNotMatch(updateRoute, /subscriptions\.update/);

const upgradeUpi = src('app/api/razorpay/upgrade-upi/route.ts');
assert.match(upgradeUpi, /scheduleChangeAt\(/);
assert.match(upgradeUpi, /cycle_end/);
assert.match(upgradeUpi, /upgrade_flow: 'true'/);
assert.match(upgradeUpi, /start_at/);
assert.doesNotMatch(upgradeUpi, /subscriptions\.update/);
assert.doesNotMatch(
  upgradeUpi,
  /subscriptions\.cancel/,
  'downgrade must not cancel the old sub at create — only after authenticated'
);

const webhookRoute = src('app/api/razorpay/webhook/route.ts');
assert.match(webhookRoute, /schedule_change_at === 'cycle_end'/);
assert.match(webhookRoute, /cancelReplacedSubscriptionAtCycleEnd/);

const payLink = src('app/api/razorpay/create-payment-link/route.ts');
assert.match(payLink, /topUpAmountMinorUnits/);
assert.match(payLink, /razorpayErrorDescription/);
assert.match(payLink, /parseBillingCurrency/);

const creditsService = src('services/CreditsService.ts');
assert.match(creditsService, /paymentMethod: data\.paymentMethod/);
assert.match(creditsService, /\/api\/billing\/summary/);
assert.doesNotMatch(creditsService, /data\.payment_method/);
assert.doesNotMatch(creditsService, /firebase\/firestore/);


const checkout = src('components/shared/payment/RazorpayCheckout.tsx');
assert.match(
  checkout,
  /authedFetch\(user,\s*'\/api\/razorpay\/create-subscription'/,
  'checkout must send the ID token via authedFetch'
);
assert.doesNotMatch(
  checkout,
  /create-subscription[\s\S]{0,500}userId: user\.uid/,
  'checkout must not send client userId'
);

console.log('billing sot.selfcheck: ok');
