/**
 * Checkout currency preference (cookie) + INR book FX peg.
 * Currency is chosen on the pricing page before Razorpay Checkout — never inside it.
 */

import type { BillingCurrency } from '@/config/razorpay';
import { isBillingCurrency } from '@/config/razorpay';

export const CURRENCY_COOKIE = 'okvevo_currency';

/** Mid of the ₹95–100/$ band the INR price book assumes. */
export const FX_BOOK_BAND_LOW = 95;
export const FX_BOOK_BAND_HIGH = 100;
export const FX_DRIFT_ALERT_RATIO = 0.07;

/** Frozen top-up FX: $10 → ₹1,000 → 100000 paise. Credits still amountUsd × 1000. */
export const TOPUP_INR_PER_USD = FX_BOOK_BAND_HIGH;

export function topUpAmountMinorUnits(
    amountUsd: number,
    currency: BillingCurrency
): number {
    if (currency === 'INR') return Math.round(amountUsd * TOPUP_INR_PER_USD * 100);
    return Math.round(amountUsd * 100);
}

export function readCurrencyCookie(
    cookieHeader?: string | null
): BillingCurrency | null {
    const raw =
        cookieHeader ??
        (typeof document !== 'undefined' ? document.cookie : '');
    const m = raw.match(/(?:^|;\s*)okvevo_currency=(INR|USD)\b/);
    return m && isBillingCurrency(m[1]) ? m[1] : null;
}

export function writeCurrencyCookie(currency: BillingCurrency): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${CURRENCY_COOKIE}=${currency}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Drift vs the assumed ₹95–100 band (not vs a single peg).
 * 0 inside the band; fractional distance from the nearer edge outside it.
 */
export function fxDriftVsBook(
    rate: number,
    bandLow = FX_BOOK_BAND_LOW,
    bandHigh = FX_BOOK_BAND_HIGH
): number {
    if (!(rate > 0) || !Number.isFinite(rate)) return Number.POSITIVE_INFINITY;
    if (rate >= bandLow && rate <= bandHigh) return 0;
    if (rate < bandLow) return (bandLow - rate) / bandLow;
    return (rate - bandHigh) / bandHigh;
}

export function shouldAlertFxDrift(
    rate: number,
    threshold = FX_DRIFT_ALERT_RATIO
): boolean {
    return fxDriftVsBook(rate) > threshold;
}
