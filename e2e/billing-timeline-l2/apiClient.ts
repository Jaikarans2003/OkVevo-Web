/**
 * Thin fetch wrappers over the REAL deployed billing API routes (plan
 * §14.3 — "through real API routes"). No mocking, no in-process imports;
 * every call is a plain HTTP request against L2_ENV.baseUrl.
 */
import { L2_ENV } from './env';

export type ApiResult<T = Record<string, unknown>> = { status: number; json: T };

async function authedFetch<T>(
  path: string,
  idToken: string,
  init: { method?: 'GET' | 'POST'; body?: Record<string, unknown> } = {}
): Promise<ApiResult<T>> {
  const res = await fetch(`${L2_ENV.baseUrl}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      authorization: `Bearer ${idToken}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, json };
}

export type CreateSubscriptionResponse = {
  success?: boolean;
  subscriptionId?: string;
  razorpayKeyId?: string;
  shortUrl?: string;
  error?: string;
};

export function createSubscription(
  idToken: string,
  body: { planType: 'starter' | 'pro' | 'max'; billingPeriod?: 'monthly' | 'annual'; currency?: 'USD' | 'INR' }
) {
  return authedFetch<CreateSubscriptionResponse>('/api/razorpay/create-subscription', idToken, { body });
}

export type ChangePlanResponse = {
  success?: boolean;
  flow?: string;
  scheduleChangeAt?: string;
  requiresNewAuth?: boolean;
  newSubscriptionId?: string;
  razorpayKeyId?: string;
  shortUrl?: string;
  error?: string;
};

/** Plan change = new subscription (every payment method). */
export function changePlan(
  idToken: string,
  body: { newPlanType: 'starter' | 'pro' | 'max'; newBillingPeriod?: 'monthly' | 'annual' }
) {
  return authedFetch<ChangePlanResponse>('/api/razorpay/upgrade-upi', idToken, { body });
}

export function cancelSubscription(idToken: string) {
  return authedFetch<{ success?: boolean; error?: string }>('/api/razorpay/cancel-subscription', idToken, {
    body: {},
  });
}

export type BillingSummaryResponse = {
  plan: string | null;
  status: string | null;
  remainingPct: number;
  cancelAtPeriodEnd: boolean;
  scheduledChange: { planType: string | null; planId: string | null; changeAt: string | null } | null;
  paymentMethod: string | null;
  razorpaySubscriptionId: string | null;
};

export function getBillingSummary(idToken: string) {
  return authedFetch<BillingSummaryResponse>('/api/billing/summary', idToken, { method: 'GET' });
}

/** Poll until `predicate` is true or timeout — webhooks land asynchronously. */
export async function pollBillingSummary(
  idToken: string,
  predicate: (s: BillingSummaryResponse) => boolean,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<BillingSummaryResponse> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;
  let last: BillingSummaryResponse | undefined;
  while (Date.now() < deadline) {
    const { json } = await getBillingSummary(idToken);
    last = json;
    if (predicate(json)) return json;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`pollBillingSummary timed out after ${timeoutMs}ms. Last summary: ${JSON.stringify(last)}`);
}
