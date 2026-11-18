/**
 * Legacy URL: plan change is always a new subscription (Razorpay India).
 * The Razorpay update API is not used — every method goes through upgrade-upi.
 */
export { POST } from '../upgrade-upi/route';
