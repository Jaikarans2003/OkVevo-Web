/**
 * Client plan-change: Razorpay update (card) or UPI replacement checkout.
 * Identity comes from the ID token on the server — never a client uid field.
 */

import type { BillingPeriod, SelfServePlanType } from '@/config/razorpay';

export type PlanChangeResult =
  | { ok: true; scheduleChangeAt: 'now' | 'cycle_end'; shortUrl?: string; message: string }
  | { ok: false; error: string };

async function postJson(
  path: string,
  idToken: string,
  body: Record<string, unknown>
): Promise<{ status: number; data: Record<string, unknown> }> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const parsed: unknown = await response.json();
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  return { status: response.status, data };
}

export async function changeSubscriptionPlan(
  idToken: string,
  newPlanType: SelfServePlanType,
  newBillingPeriod: BillingPeriod
): Promise<PlanChangeResult> {
  const payload = { newPlanType, newBillingPeriod };
  const updated = await postJson('/api/razorpay/update-subscription', idToken, payload);

  if (updated.status === 200 && updated.data.success === true) {
    return {
      ok: true,
      scheduleChangeAt: updated.data.scheduleChangeAt === 'cycle_end' ? 'cycle_end' : 'now',
      message:
        typeof updated.data.message === 'string'
          ? updated.data.message
          : 'Plan updated.',
    };
  }

  if (updated.data.flow === 'upi_upgrade_required') {
    const upi = await postJson('/api/razorpay/upgrade-upi', idToken, payload);
    if (upi.status === 200 && (upi.data.success === true || upi.data.requiresNewAuth === true)) {
      const shortUrl = typeof upi.data.shortUrl === 'string' ? upi.data.shortUrl : undefined;
      return {
        ok: true,
        scheduleChangeAt: 'now',
        shortUrl,
        message:
          typeof upi.data.message === 'string'
            ? upi.data.message
            : 'Complete UPI authorization to finish the upgrade.',
      };
    }
    return {
      ok: false,
      error: typeof upi.data.error === 'string' ? upi.data.error : 'Failed to start UPI upgrade',
    };
  }

  return {
    ok: false,
    error: typeof updated.data.error === 'string' ? updated.data.error : 'Failed to update subscription',
  };
}
