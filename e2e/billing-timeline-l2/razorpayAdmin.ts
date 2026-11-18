/**
 * Direct Razorpay admin calls for Layer 2 cleanup only (plan §14.3: "cancel
 * Razorpay test subs at end"). Never used by the scenarios themselves — those
 * go through the real app API routes. Test mode only (env.ts fails closed).
 */
import Razorpay from 'razorpay';
import { L2_ENV } from './env';

const razorpay = new Razorpay({
  key_id: L2_ENV.razorpayKeyId,
  key_secret: L2_ENV.razorpayKeySecret,
});

/** Cancel immediately (not at cycle end) so no test subscription keeps renewing. */
export async function forceCancelSubscription(subscriptionId: string): Promise<void> {
  try {
    await razorpay.subscriptions.cancel(subscriptionId, false);
  } catch (err) {
    // Already cancelled/completed is fine; anything else is worth seeing in CI logs.
    console.warn(`forceCancelSubscription(${subscriptionId}) failed`, err);
  }
}
