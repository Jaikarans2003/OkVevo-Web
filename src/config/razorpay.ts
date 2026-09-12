/**
 * Razorpay price book — keyed by tier + cycle + currency (Stripe Price shape).
 * USD: existing test plan IDs; annual = monthly × 12 × (1 − 15%).
 * INR: Karan-supplied test plan IDs and display prices — not live-converted.
 * Display math only; Razorpay Plans already hold the real charge. No tax.
 */

import { env } from '@/config/env';

export const RAZORPAY_CONFIG = {
    keyId: env.razorpay.keyId,
    keySecret: env.razorpay.keySecret,
};

/** Credits granted per USD on Add Credits and plan face rate. */
export const PLACEHOLDER_CREDITS_PER_USD = 1000;

export const ANNUAL_DISCOUNT_PCT = 0.15;

export type PlanType = 'starter' | 'pro' | 'max' | 'enterprise';

export type BillingPeriod = 'monthly' | 'annual';

export type SelfServePlanType = Exclude<PlanType, 'enterprise'>;

/** ISO 4217. Design for N; ship USD + INR. */
export type BillingCurrency = 'USD' | 'INR';

export const BILLING_CURRENCIES: readonly BillingCurrency[] = ['USD', 'INR'];

export function isBillingCurrency(v: unknown): v is BillingCurrency {
    return v === 'USD' || v === 'INR';
}

export function parseBillingCurrency(
    v: unknown,
    fallback: BillingCurrency = 'USD'
): BillingCurrency {
    return isBillingCurrency(v) ? v : fallback;
}

export function annualChargeUsd(monthlyUsd: number): number {
    return monthlyUsd * 12 * (1 - ANNUAL_DISCOUNT_PCT);
}

/** Shown on yearly toggle as "$X/mo". */
export function displayedYearlyMonthlyUsd(monthlyUsd: number): number {
    return annualChargeUsd(monthlyUsd) / 12;
}

/** INR book — frozen table. Do not derive from the USD 15% formula. */
const INR_DISPLAY = {
    starter: { monthly: 1999, annualCharge: 20388, displayedYearlyMonthly: 1699 },
    pro: { monthly: 5999, annualCharge: 61188, displayedYearlyMonthly: 5099 },
    max: { monthly: 9999, annualCharge: 101988, displayedYearlyMonthly: 8499 },
} as const;

export const RAZORPAY_PLAN_IDS: Record<
    SelfServePlanType,
    Record<BillingPeriod, Record<BillingCurrency, string>>
> = {
    starter: {
        monthly: {
            USD: env.razorpay.plans.starterMonthly || 'plan_TaipNKtfGxZyaz',
            INR: env.razorpay.plans.starterMonthlyInr || 'plan_TapXDOpk6VF1qo',
        },
        annual: {
            USD: env.razorpay.plans.starterAnnual || 'plan_TairsxzPq1SX8O',
            INR: env.razorpay.plans.starterAnnualInr || 'plan_TapYqxTWzFYaxl',
        },
    },
    pro: {
        monthly: {
            USD: env.razorpay.plans.proMonthly || 'plan_TaitO9Jvbh8hKW',
            INR: env.razorpay.plans.proMonthlyInr || 'plan_TapZn30VKBc68V',
        },
        annual: {
            USD: env.razorpay.plans.proAnnual || 'plan_TaiuIVserGuy8r',
            INR: env.razorpay.plans.proAnnualInr || 'plan_Tapas8COpIuqsJ',
        },
    },
    max: {
        monthly: {
            USD: env.razorpay.plans.maxMonthly || 'plan_TaivVyzrryqHze',
            INR: env.razorpay.plans.maxMonthlyInr || 'plan_TapbeJ6GchzbX5',
        },
        annual: {
            USD: env.razorpay.plans.maxAnnual || 'plan_TaiwVITElxquWo',
            INR: env.razorpay.plans.maxAnnualInr || 'plan_TapckEOs5LT87W',
        },
    },
};

type PlanDef = {
    name: string;
    monthlyPriceUsd: number;
    creditsIncluded: number;
};

export const SUBSCRIPTION_PLANS: Record<SelfServePlanType, PlanDef> & {
    enterprise: { name: string; monthlyPriceUsd: number; creditsIncluded: number };
} = {
    starter: {
        name: 'Starter',
        monthlyPriceUsd: 20,
        creditsIncluded: 20 * PLACEHOLDER_CREDITS_PER_USD,
    },
    pro: {
        name: 'Pro',
        monthlyPriceUsd: 60,
        creditsIncluded: 60 * PLACEHOLDER_CREDITS_PER_USD,
    },
    max: {
        name: 'Max',
        monthlyPriceUsd: 100,
        creditsIncluded: 100 * PLACEHOLDER_CREDITS_PER_USD,
    },
    enterprise: {
        name: 'Enterprise',
        monthlyPriceUsd: 0,
        creditsIncluded: 0,
    },
};

/** plan_id → tier metadata (creditsIncluded is always the monthly grant). */
export type PlanIdMeta = {
    name: SelfServePlanType;
    planName: string;
    creditsIncluded: number;
    billingCycle: 'monthly' | 'yearly';
    monthlyPriceUsd: number;
    currency: BillingCurrency;
};

function buildPlanIdLookup(): Map<string, PlanIdMeta> {
    const map = new Map<string, PlanIdMeta>();
    for (const name of ['starter', 'pro', 'max'] as SelfServePlanType[]) {
        const def = SUBSCRIPTION_PLANS[name];
        const ids = RAZORPAY_PLAN_IDS[name];
        for (const currency of BILLING_CURRENCIES) {
            map.set(ids.monthly[currency], {
                name,
                planName: def.name,
                creditsIncluded: def.creditsIncluded,
                billingCycle: 'monthly',
                monthlyPriceUsd: def.monthlyPriceUsd,
                currency,
            });
            map.set(ids.annual[currency], {
                name,
                planName: def.name,
                creditsIncluded: def.creditsIncluded,
                billingCycle: 'yearly',
                monthlyPriceUsd: def.monthlyPriceUsd,
                currency,
            });
        }
    }
    return map;
}

const PLAN_ID_LOOKUP = buildPlanIdLookup();

export function lookupPlanById(planId: string): PlanIdMeta | null {
    if (!planId) return null;
    return PLAN_ID_LOOKUP.get(planId) ?? null;
}

export function getPlanDetails(planType: PlanType) {
    return SUBSCRIPTION_PLANS[planType];
}

export function getRazorpayPlanId(
    planType: SelfServePlanType,
    billingPeriod: BillingPeriod = 'monthly',
    currency: BillingCurrency = 'USD'
): string {
    return RAZORPAY_PLAN_IDS[planType][billingPeriod][currency];
}

export type PlanPeriodDetails = {
    name: string;
    /** Charge in major units of `currency` (USD dollars or INR rupees). */
    price: number;
    displayedMonthly: number;
    currency: BillingCurrency;
    period: 'monthly' | 'annual' | 'custom';
    credits: number;
    creditsIncluded: number;
};

export function getPlanDetailsByPeriod(
    planType: PlanType,
    billingPeriod: BillingPeriod = 'monthly',
    currency: BillingCurrency = 'USD'
): PlanPeriodDetails {
    const plan = SUBSCRIPTION_PLANS[planType];
    if (planType === 'enterprise') {
        return {
            name: plan.name,
            price: 0,
            displayedMonthly: 0,
            currency: 'USD',
            period: 'custom',
            credits: plan.creditsIncluded,
            creditsIncluded: plan.creditsIncluded,
        };
    }
    if (currency === 'INR') {
        const inr = INR_DISPLAY[planType];
        if (billingPeriod === 'annual') {
            return {
                name: plan.name,
                price: inr.annualCharge,
                displayedMonthly: inr.displayedYearlyMonthly,
                currency: 'INR',
                period: 'annual',
                credits: plan.creditsIncluded,
                creditsIncluded: plan.creditsIncluded,
            };
        }
        return {
            name: plan.name,
            price: inr.monthly,
            displayedMonthly: inr.monthly,
            currency: 'INR',
            period: 'monthly',
            credits: plan.creditsIncluded,
            creditsIncluded: plan.creditsIncluded,
        };
    }
    const monthly = plan.monthlyPriceUsd;
    if (billingPeriod === 'annual') {
        return {
            name: plan.name,
            price: annualChargeUsd(monthly),
            displayedMonthly: displayedYearlyMonthlyUsd(monthly),
            currency: 'USD',
            period: 'annual',
            credits: plan.creditsIncluded,
            creditsIncluded: plan.creditsIncluded,
        };
    }
    return {
        name: plan.name,
        price: monthly,
        displayedMonthly: monthly,
        currency: 'USD',
        period: 'monthly',
        credits: plan.creditsIncluded,
        creditsIncluded: plan.creditsIncluded,
    };
}

export function formatPlanPrice(amount: number, currency: BillingCurrency): string {
    if (currency === 'INR') {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    }
    return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function isSelfServePlanType(v: string): v is SelfServePlanType {
    return v === 'starter' || v === 'pro' || v === 'max';
}
