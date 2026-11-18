/**
 * Client plan-change: always a new Razorpay subscription (every payment method).
 * Identity comes from the ID token on the server — never a client uid field.
 */

import type { BillingPeriod, SelfServePlanType } from '@/config/razorpay';

export type PlanChangeResult =
  | {
      ok: true;
      scheduleChangeAt: 'now' | 'cycle_end';
      shortUrl?: string;
      newSubscriptionId?: string;
      razorpayKeyId?: string;
      message: string;
    }
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
  const res = await postJson('/api/razorpay/upgrade-upi', idToken, payload);

  if (res.status === 200 && (res.data.success === true || res.data.requiresNewAuth === true)) {
    return {
      ok: true,
      scheduleChangeAt: res.data.scheduleChangeAt === 'cycle_end' ? 'cycle_end' : 'now',
      shortUrl: typeof res.data.shortUrl === 'string' ? res.data.shortUrl : undefined,
      newSubscriptionId:
        typeof res.data.newSubscriptionId === 'string' ? res.data.newSubscriptionId : undefined,
      razorpayKeyId:
        typeof res.data.razorpayKeyId === 'string' ? res.data.razorpayKeyId : undefined,
      message:
        typeof res.data.message === 'string'
          ? res.data.message
          : 'Complete payment authorization to finish the plan change.',
    };
  }

  return {
    ok: false,
    error:
      typeof res.data.error === 'string' ? res.data.error : 'Failed to start plan change',
  };
}
