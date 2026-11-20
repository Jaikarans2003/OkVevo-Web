/**
 * Client plan-change: always a new Razorpay subscription (every payment method).
 * Identity comes from the ID token on the server — never a client uid field.
 * Sends X-OkVevo-Org via authedFetch when an org account is selected.
 */

import type { User } from 'firebase/auth';

import type { BillingPeriod, SelfServePlanType } from '@/config/razorpay';
import { authedFetch } from '@/lib/api/browser';

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

export async function changeSubscriptionPlan(
  user: User,
  newPlanType: SelfServePlanType,
  newBillingPeriod: BillingPeriod
): Promise<PlanChangeResult> {
  const response = await authedFetch(user, '/api/razorpay/upgrade-upi', {
    method: 'POST',
    body: JSON.stringify({ newPlanType, newBillingPeriod }),
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

  if (response.status === 200 && (data.success === true || data.requiresNewAuth === true)) {
    return {
      ok: true,
      scheduleChangeAt: data.scheduleChangeAt === 'cycle_end' ? 'cycle_end' : 'now',
      shortUrl: typeof data.shortUrl === 'string' ? data.shortUrl : undefined,
      newSubscriptionId:
        typeof data.newSubscriptionId === 'string' ? data.newSubscriptionId : undefined,
      razorpayKeyId:
        typeof data.razorpayKeyId === 'string' ? data.razorpayKeyId : undefined,
      message:
        typeof data.message === 'string'
          ? data.message
          : 'Complete payment authorization to finish the plan change.',
    };
  }

  return {
    ok: false,
    error:
      typeof data.error === 'string' ? data.error : 'Failed to start plan change',
  };
}
