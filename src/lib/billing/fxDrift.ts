/**
 * Weekly FX monitor for the INR price book.
 * Compares live USD/INR to the ~₹95–100/$ the book assumes.
 * Never mutates Razorpay plans or user subscriptions.
 */

import {
    FX_BOOK_BAND_HIGH,
    FX_BOOK_BAND_LOW,
    FX_DRIFT_ALERT_RATIO,
    fxDriftVsBook,
    shouldAlertFxDrift,
} from './currency';

export type FxRateQuote = {
    rate: number;
    source: string;
};

type FetchLike = typeof fetch;

export async function fetchUsdInrRate(
    fetchFn: FetchLike = fetch
): Promise<FxRateQuote> {
    try {
        const res = await fetchFn('https://open.er-api.com/v6/latest/USD', {
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const body = (await res.json()) as { rates?: { INR?: unknown } };
            const rate = body.rates?.INR;
            if (typeof rate === 'number' && rate > 0 && Number.isFinite(rate)) {
                return { rate, source: 'open.er-api.com' };
            }
        }
    } catch {
        /* fallback */
    }

    const res = await fetchFn(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
        { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) {
        throw new Error('FX rate unavailable');
    }
    const body = (await res.json()) as { usd?: { inr?: unknown } };
    const rate = body.usd?.inr;
    if (typeof rate === 'number' && rate > 0 && Number.isFinite(rate)) {
        return { rate, source: 'fawazahmed0/currency-api' };
    }
    throw new Error('FX rate unavailable');
}

export function evaluateFxDrift(rate: number) {
    const driftRatio = fxDriftVsBook(rate);
    return {
        rate,
        bandLow: FX_BOOK_BAND_LOW,
        bandHigh: FX_BOOK_BAND_HIGH,
        driftRatio,
        alert: shouldAlertFxDrift(rate, FX_DRIFT_ALERT_RATIO),
        threshold: FX_DRIFT_ALERT_RATIO,
    };
}
