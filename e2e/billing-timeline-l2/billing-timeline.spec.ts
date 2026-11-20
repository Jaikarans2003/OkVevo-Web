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
  pollBillingSummary,
  upgradeToOrg,
} from './apiClient';
import { createTestUser, deleteTestUser, ensureServerUser, type TestUser } from './testUsers';
import { forceCancelSubscription } from './razorpayAdmin';
import { openSubscriptionCheckout, payWithUpiSuccess, payWithTestCard } from './razorpayCheckout';

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
});
