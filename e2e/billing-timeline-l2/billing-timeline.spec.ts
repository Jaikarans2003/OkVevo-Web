/**
 * Billing timeline Layer 2 (plan §14.3). Staging only, Razorpay test mode
 * only (env.ts fails closed on RAZORPAY_KEY_ID). Six scenarios, each with
 * its own fresh subscription and dedicated test user.
 *
 * Plan change = new subscription for every payment method (no
 * subscriptions.update). Upgrade and downgrade both open a second Checkout.
 *
 * Renewals, failures, and halted stay in Layer 1 (fixture replay) — test
 * mode only triggers those from the Razorpay Dashboard.
 */
import { test, expect } from '@playwright/test';
import {
  createSubscription,
  changePlan,
  cancelSubscription,
  getBillingSummary,
  getBillingTransactions,
  pollBillingSummary,
  upgradeToOrg,
  applySuperOrg,
  approveSuperOrg,
  acceptParent,
  leaveSuperOrg,
} from './apiClient';
import { createTestUser, deleteTestUser, ensureServerUser, type TestUser } from './testUsers';
import { forceCancelSubscription } from './razorpayAdmin';
import { openSubscriptionCheckout, payWithUpiSuccess, payWithTestCard } from './razorpayCheckout';
import { L2_ENV } from './env';

/** Buys `planType` via Checkout and waits for the webhook to land as active. */
async function buyAndActivate(
  page: import('@playwright/test').Page,
  user: TestUser,
  planType: 'starter' | 'pro',
  payWith: 'upi' | 'card',
  opts: { orgPublicId?: string } = {}
): Promise<string> {
  await ensureServerUser(user.idToken);
  // Staging Razorpay test account rejects USD Checkout ("Currency is not
  // supported"). INR also surfaces UPI for the buy scenario.
  const { json } = await createSubscription(
    user.idToken,
    { planType, currency: 'INR' },
    { orgPublicId: opts.orgPublicId }
  );
  if (!json.success || !json.subscriptionId || !json.razorpayKeyId) {
    throw new Error(`create-subscription failed: ${JSON.stringify(json)}`);
  }
  await openSubscriptionCheckout(page, {
    razorpayKeyId: json.razorpayKeyId,
    subscriptionId: json.subscriptionId,
  });
  if (payWith === 'upi') await payWithUpiSuccess(page);
  else await payWithTestCard(page);

  await pollBillingSummary(
    user.idToken,
    (s) => s.status === 'active' && s.plan === planType,
    { orgPublicId: opts.orgPublicId }
  );
  return json.subscriptionId;
}

test.describe('billing timeline Layer 2', () => {
  test('buy: UPI checkout activates the plan', async ({ page }) => {
    const user = await createTestUser('buy');
    let subscriptionId: string | undefined;
    try {
      subscriptionId = await buyAndActivate(page, user, 'starter', 'upi');
      const { json: summary } = await getBillingSummary(user.idToken);
      expect(summary.plan).toBe('starter');
      expect(summary.status).toBe('active');
      expect(summary.remainingPct).toBe(100);
      expect(summary.razorpaySubscriptionId).toBe(subscriptionId);
    } finally {
      if (subscriptionId) await forceCancelSubscription(subscriptionId);
      await deleteTestUser(user);
    }
  });

  test('upgrade: new subscription Checkout applies pro now', async ({ page }) => {
    const user = await createTestUser('upgrade');
    let oldSubId: string | undefined;
    let newSubId: string | undefined;
    try {
      oldSubId = await buyAndActivate(page, user, 'starter', 'card');

      const { status, json: change } = await changePlan(user.idToken, { newPlanType: 'pro' });
      expect(change, `upgrade HTTP ${status}`).toEqual(
        expect.objectContaining({
          success: true,
          scheduleChangeAt: 'now',
          requiresNewAuth: true,
        })
      );
      expect(change.newSubscriptionId).toBeTruthy();
      expect(change.razorpayKeyId).toBeTruthy();
      newSubId = change.newSubscriptionId;

      await openSubscriptionCheckout(page, {
        razorpayKeyId: change.razorpayKeyId!,
        subscriptionId: change.newSubscriptionId!,
      });
      await payWithTestCard(page);

      const summary = await pollBillingSummary(user.idToken, (s) => s.plan === 'pro');
      expect(summary.status).toBe('active');
      expect(summary.scheduledChange).toBeNull();
      expect(summary.razorpaySubscriptionId).toBe(newSubId);
    } finally {
      if (newSubId) await forceCancelSubscription(newSubId);
      if (oldSubId) await forceCancelSubscription(oldSubId);
      await deleteTestUser(user);
    }
  });

  test('downgrade abandoned Checkout: create alone leaves the plan unchanged', async ({ page }) => {
    const user = await createTestUser('dn-abandon');
    let oldSubId: string | undefined;
    let newSubId: string | undefined;
    try {
      oldSubId = await buyAndActivate(page, user, 'pro', 'card');
      const before = await getBillingSummary(user.idToken);

      const { status, json: change } = await changePlan(user.idToken, { newPlanType: 'starter' });
      expect(change, `downgrade create HTTP ${status}`).toEqual(
        expect.objectContaining({
          success: true,
          scheduleChangeAt: 'cycle_end',
          requiresNewAuth: true,
        })
      );
      newSubId = change.newSubscriptionId;

      // No Checkout — old plan must stay; cancel only happens after authenticated.
      const after = await getBillingSummary(user.idToken);
      expect(after.json.plan).toBe('pro');
      expect(after.json.status).toBe('active');
      expect(after.json.scheduledChange).toBeNull();
      expect(after.json.cancelAtPeriodEnd).toBe(false);
      expect(after.json.razorpaySubscriptionId).toBe(before.json.razorpaySubscriptionId);
    } finally {
      if (newSubId) await forceCancelSubscription(newSubId);
      if (oldSubId) await forceCancelSubscription(oldSubId);
      await deleteTestUser(user);
    }
  });

  test('downgrade: Checkout auth schedules starter at cycle end', async ({ page }) => {
    const user = await createTestUser('downgrade');
    let oldSubId: string | undefined;
    let newSubId: string | undefined;
    try {
      oldSubId = await buyAndActivate(page, user, 'pro', 'card');

      const { status, json: change } = await changePlan(user.idToken, { newPlanType: 'starter' });
      expect(change, `downgrade HTTP ${status}`).toEqual(
        expect.objectContaining({
          success: true,
          scheduleChangeAt: 'cycle_end',
          requiresNewAuth: true,
        })
      );
      expect(change.newSubscriptionId).toBeTruthy();
      newSubId = change.newSubscriptionId;

      await openSubscriptionCheckout(page, {
        razorpayKeyId: change.razorpayKeyId!,
        subscriptionId: change.newSubscriptionId!,
      });
      await payWithTestCard(page);

      const summary = await pollBillingSummary(
        user.idToken,
        (s) => s.scheduledChange?.planType === 'starter'
      );
      // Current plan + credits stay until period end — no downgrade yet.
      expect(summary.plan).toBe('pro');
      expect(summary.status).toBe('active');
    } finally {
      if (newSubId) await forceCancelSubscription(newSubId);
      if (oldSubId) await forceCancelSubscription(oldSubId);
      await deleteTestUser(user);
    }
  });

  test('cancel: cancel-subscription schedules cancellation at period end', async ({ page }) => {
    const user = await createTestUser('cancel');
    let subscriptionId: string | undefined;
    try {
      subscriptionId = await buyAndActivate(page, user, 'starter', 'card');

      const { json: cancel } = await cancelSubscription(user.idToken);
      expect(cancel.success).toBe(true);

      const summary = await pollBillingSummary(user.idToken, (s) => s.cancelAtPeriodEnd === true);
      // No grace period: credits stay usable until currentPeriodEnd, plan unchanged.
      expect(summary.plan).toBe('starter');
    } finally {
      if (subscriptionId) await forceCancelSubscription(subscriptionId);
      await deleteTestUser(user);
    }
  });

  test('org-wallet buy: upgrade then buy with X-OkVevo-Org lands on org wallet', async ({
    page,
  }) => {
    const user = await createTestUser('org-buy');
    let subscriptionId: string | undefined;
    try {
      await ensureServerUser(user.idToken);
      const { status, json: upgraded } = await upgradeToOrg(user.idToken, 'L2 Org Buy Co');
      expect(upgraded, `upgrade HTTP ${status}`).toEqual(
        expect.objectContaining({ success: true })
      );
      expect(upgraded.orgPublicId).toBeTruthy();
      const orgPublicId = upgraded.orgPublicId!;

      subscriptionId = await buyAndActivate(page, user, 'starter', 'card', { orgPublicId });

      const { json: summary } = await getBillingSummary(user.idToken, { orgPublicId });
      expect(summary.accountKind).toBe('org');
      expect(summary.status).toBe('active');
      expect(summary.plan).toBe('starter');
      expect(summary.razorpaySubscriptionId).toBe(subscriptionId);
      expect(summary.remainingPct).toBe(100);
    } finally {
      if (subscriptionId) await forceCancelSubscription(subscriptionId);
      await deleteTestUser(user);
    }
  });

  test('org-wallet buy without header: upgrade then buy lands on org wallet', async ({
    page,
  }) => {
    const user = await createTestUser('org-buy-nohdr');
    let subscriptionId: string | undefined;
    try {
      await ensureServerUser(user.idToken);
      const { status, json: upgraded } = await upgradeToOrg(user.idToken, 'L2 Org NoHdr Co');
      expect(upgraded, `upgrade HTTP ${status}`).toEqual(
        expect.objectContaining({ success: true })
      );
      const orgPublicId = upgraded.orgPublicId!;

      // No X-OkVevo-Org — resolvePayingWallet uses upgraded_org_id.
      subscriptionId = await buyAndActivate(page, user, 'starter', 'card');

      const { json: summary } = await getBillingSummary(user.idToken, { orgPublicId });
      expect(summary.accountKind).toBe('org');
      expect(summary.status).toBe('active');
      expect(summary.plan).toBe('starter');
      expect(summary.razorpaySubscriptionId).toBe(subscriptionId);
      expect(summary.remainingPct).toBe(100);

      const { json: txns } = await getBillingTransactions(user.idToken, { orgPublicId });
      expect((txns.items ?? []).some((t) => t.type === 'grant')).toBe(true);
    } finally {
      if (subscriptionId) await forceCancelSubscription(subscriptionId);
      await deleteTestUser(user);
    }
  });

  test('super-org wallet buy without header after approval', async ({ page }) => {
    const adminEmail = (process.env.L2_ADMIN_EMAIL ?? '').trim();
    const adminPassword = (process.env.L2_ADMIN_PASSWORD ?? '').trim();
    // Fail closed in CI — never skip. Secrets must be set on Environment staging.
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'billing-timeline-l2: missing L2_ADMIN_EMAIL / L2_ADMIN_PASSWORD (must match an email in staging ADMIN_EMAILS)'
      );
    }

    const user = await createTestUser('sorg-buy');
    let subscriptionId: string | undefined;
    try {
      await ensureServerUser(user.idToken);
      // Use a deliverable-looking email for the application validator.
      const { status: appStatus, json: app } = await applySuperOrg(
        user.idToken,
        'L2 super-org please',
        `${user.uid}@example.com`
      );
      expect(app, `contact HTTP ${appStatus}`).toEqual(expect.objectContaining({ ok: true }));
      expect(app.id).toBeTruthy();

      const adminTokenRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${L2_ENV.firebaseApiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
            returnSecureToken: true,
          }),
        }
      );
      const adminJson = (await adminTokenRes.json()) as { idToken?: string };
      expect(adminJson.idToken).toBeTruthy();

      const { status: apprStatus, json: approved } = await approveSuperOrg(
        adminJson.idToken!,
        app.id!
      );
      expect(approved, `approve HTTP ${apprStatus}`).toEqual(
        expect.objectContaining({ success: true })
      );
      const orgPublicId = approved.orgPublicId!;

      subscriptionId = await buyAndActivate(page, user, 'starter', 'card');

      const { json: summary } = await getBillingSummary(user.idToken, { orgPublicId });
      expect(summary.accountKind).toBe('super_org');
      expect(summary.status).toBe('active');
      expect(summary.plan).toBe('starter');
      expect(summary.razorpaySubscriptionId).toBe(subscriptionId);
      expect(summary.remainingPct).toBe(100);

      const { json: txns } = await getBillingTransactions(user.idToken, { orgPublicId });
      expect((txns.items ?? []).some((t) => t.type === 'grant')).toBe(true);
    } finally {
      if (subscriptionId) await forceCancelSubscription(subscriptionId);
      await deleteTestUser(user);
    }
  });

  test('2b-a: accept super-org then leave then buy again', async ({ page }) => {
    test.setTimeout(600_000);
    const adminEmail = (process.env.L2_ADMIN_EMAIL ?? '').trim();
    const adminPassword = (process.env.L2_ADMIN_PASSWORD ?? '').trim();
    if (!adminEmail || !adminPassword) {
      throw new Error(
        'billing-timeline-l2: missing L2_ADMIN_EMAIL / L2_ADMIN_PASSWORD (must match an email in staging ADMIN_EMAILS)'
      );
    }

    const orgUser = await createTestUser('2ba-org');
    const superUser = await createTestUser('2ba-super');
    let orgSubId: string | undefined;
    let newSubId: string | undefined;
    let superSubId: string | undefined;
    try {
      await ensureServerUser(orgUser.idToken);
      await ensureServerUser(superUser.idToken);

      const { json: upgraded } = await upgradeToOrg(orgUser.idToken, 'L2 2ba Org');
      expect(upgraded.success).toBe(true);
      const orgPublicId = upgraded.orgPublicId!;
      orgSubId = await buyAndActivate(page, orgUser, 'starter', 'card', { orgPublicId });

      const { json: app } = await applySuperOrg(
        superUser.idToken,
        'L2 2ba super',
        `${superUser.uid}@example.com`
      );
      expect(app.ok).toBe(true);

      const adminTokenRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${L2_ENV.firebaseApiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
            returnSecureToken: true,
          }),
        }
      );
      const adminJson = (await adminTokenRes.json()) as { idToken?: string };
      expect(adminJson.idToken).toBeTruthy();
      const { json: approved } = await approveSuperOrg(adminJson.idToken!, app.id!);
      expect(approved.success).toBe(true);
      const superOrgPublicId = approved.orgPublicId!;
      superSubId = await buyAndActivate(page, superUser, 'starter', 'card', {
        orgPublicId: superOrgPublicId,
      });

      // Until 2b-b invitations: accept-parent is platform-admin only (L2 admin).
      const { status: acceptStatus, json: accepted } = await acceptParent(
        adminJson.idToken!,
        orgPublicId,
        superOrgPublicId
      );
      expect(accepted, `accept-parent HTTP ${acceptStatus}`).toEqual(
        expect.objectContaining({ success: true })
      );

      const { json: prepaid } = await getBillingSummary(orgUser.idToken, { orgPublicId });
      expect(prepaid.canPurchase).toBe(false);
      expect(prepaid.fundedBy).toBeTruthy();
      expect(prepaid.cancelAtPeriodEnd).toBe(true);

      const { status: leaveStatus, json: left } = await leaveSuperOrg(
        orgUser.idToken,
        orgPublicId
      );
      expect(left, `leave HTTP ${leaveStatus}`).toEqual(expect.objectContaining({ success: true }));

      newSubId = await buyAndActivate(page, orgUser, 'starter', 'card', { orgPublicId });
      const { json: afterBuy } = await getBillingSummary(orgUser.idToken, { orgPublicId });
      expect(afterBuy.canPurchase).toBe(true);
      expect(afterBuy.plan).toBe('starter');
      expect(afterBuy.status).toBe('active');
      expect(afterBuy.razorpaySubscriptionId).toBe(newSubId);
    } finally {
      for (const id of [orgSubId, newSubId, superSubId]) {
        if (id) await forceCancelSubscription(id);
      }
      await deleteTestUser(orgUser);
      await deleteTestUser(superUser);
    }
  });
});
