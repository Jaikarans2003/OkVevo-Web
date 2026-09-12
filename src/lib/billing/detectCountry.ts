/**
 * Server-side country → checkout currency.
 * 1. CF-IPCountry (Cloudflare-proxied custom domain)
 * 2. Geo-IP on x-forwarded-for (hosted.app / Cloud Run)
 * 3. Default USD
 * Manual INR/USD switch is a cookie on the pricing page — not this helper.
 */

import {
    type BillingCurrency,
    parseBillingCurrency,
} from '@/config/razorpay';

export type DetectCountrySource = 'cf-ipcountry' | 'geo-ip' | 'default';

export type DetectCountryResult = {
    country: string | null;
    currency: BillingCurrency;
    source: DetectCountrySource;
};

export function currencyFromCountry(country: string | null): BillingCurrency {
    return country === 'IN' ? 'INR' : 'USD';
}

/** Cloudflare XX = unknown, T1 = Tor. Require ISO 3166-1 alpha-2. */
export function countryFromCfIpCountry(
    value: string | null | undefined
): string | null {
    if (!value) return null;
    const c = value.trim().toUpperCase();
    if (c.length !== 2) return null;
    if (c === 'XX' || c === 'T1') return null;
    if (!/^[A-Z]{2}$/.test(c)) return null;
    return c;
}

export function clientIpFromForwardedFor(
    xff: string | null | undefined
): string | null {
    if (!xff) return null;
    const first = xff.split(',')[0]?.trim();
    if (!first) return null;
    return first.replace(/^\[/, '').replace(/\](?::\d+)?$/, '');
}

export function isPublicIp(ip: string): boolean {
    if (ip === '::1' || ip === '127.0.0.1' || ip === '0.0.0.0') return false;
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.')) {
        return false;
    }
    const m = /^172\.(\d+)\./.exec(ip);
    if (m) {
        const n = Number(m[1]);
        if (n >= 16 && n <= 31) return false;
    }
    if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) {
        return false;
    }
    return true;
}

type FetchLike = typeof fetch;

async function lookupCountryByIp(
    ip: string,
    fetchFn: FetchLike
): Promise<string | null> {
    const signal = AbortSignal.timeout(1500);
    try {
        const res = await fetchFn(`https://api.country.is/${encodeURIComponent(ip)}`, {
            signal,
        });
        if (res.ok) {
            const body = (await res.json()) as { country?: unknown };
            const c = countryFromCfIpCountry(
                typeof body.country === 'string' ? body.country : null
            );
            if (c) return c;
        }
    } catch {
        /* fall through */
    }
    try {
        const res = await fetchFn(
            `https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code,success`,
            { signal: AbortSignal.timeout(1500) }
        );
        if (!res.ok) return null;
        const body = (await res.json()) as {
            success?: unknown;
            country_code?: unknown;
        };
        if (body.success === false) return null;
        return countryFromCfIpCountry(
            typeof body.country_code === 'string' ? body.country_code : null
        );
    } catch {
        return null;
    }
}

export async function detectCountry(
    headers: Headers,
    fetchFn: FetchLike = fetch
): Promise<DetectCountryResult> {
    const cf = countryFromCfIpCountry(headers.get('cf-ipcountry'));
    if (cf) {
        return {
            country: cf,
            currency: currencyFromCountry(cf),
            source: 'cf-ipcountry',
        };
    }

    const ip = clientIpFromForwardedFor(
        headers.get('x-forwarded-for') || headers.get('x-real-ip')
    );
    if (ip && isPublicIp(ip)) {
        const geo = await lookupCountryByIp(ip, fetchFn);
        if (geo) {
            return {
                country: geo,
                currency: currencyFromCountry(geo),
                source: 'geo-ip',
            };
        }
    }

    return {
        country: null,
        currency: parseBillingCurrency(null, 'USD'),
        source: 'default',
    };
}
