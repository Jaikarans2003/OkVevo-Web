/**
 * Razorpay plan map — Starter / Pro / Max USD (test plan IDs).
 * Display math only; Razorpay Plans already hold the real charge.
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

export function annualChargeUsd(monthlyUsd: number): number {
    return monthlyUsd * 12 * (1 - ANNUAL_DISCOUNT_PCT);
}

/** Shown on yearly toggle as "$X/mo". */
export function displayedYearlyMonthlyUsd(monthlyUsd: number): number {
    return annualChargeUsd(monthlyUsd) / 12;
}

export const RAZORPAY_PLAN_IDS = {
    starter: {
        monthly: env.razorpay.plans.starterMonthly || 'plan_TaipNKtfGxZyaz',
        annual: env.razorpay.plans.starterAnnual || 'plan_TairsxzPq1SX8O',
    },
    pro: {
        monthly: env.razorpay.plans.proMonthly || 'plan_TaitO9Jvbh8hKW',
        annual: env.razorpay.plans.proAnnual || 'plan_TaiuIVserGuy8r',
    },
    max: {
        monthly: env.razorpay.plans.maxMonthly || 'plan_TaivVyzrryqHze',
        annual: env.razorpay.plans.maxAnnual || 'plan_TaiwVITElxquWo',
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
};

function buildPlanIdLookup(): Map<string, PlanIdMeta> {
    const map = new Map<string, PlanIdMeta>();
    for (const name of ['starter', 'pro', 'max'] as SelfServePlanType[]) {
        const def = SUBSCRIPTION_PLANS[name];
        const ids = RAZORPAY_PLAN_IDS[name];
        map.set(ids.monthly, {
            name,
            planName: def.name,
            creditsIncluded: def.creditsIncluded,
            billingCycle: 'monthly',
            monthlyPriceUsd: def.monthlyPriceUsd,
        });
        map.set(ids.annual, {
            name,
            planName: def.name,
            creditsIncluded: def.creditsIncluded,
            billingCycle: 'yearly',
            monthlyPriceUsd: def.monthlyPriceUsd,
        });
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
    billingPeriod: BillingPeriod = 'monthly'
): string {
    return RAZORPAY_PLAN_IDS[planType][billingPeriod];
}

export function getPlanDetailsByPeriod(
    planType: PlanType,
    billingPeriod: BillingPeriod = 'monthly'
) {
    const plan = SUBSCRIPTION_PLANS[planType];
    if (planType === 'enterprise') {
        return {
            name: plan.name,
            priceUsd: 0,
            currency: 'USD',
            period: 'custom' as const,
            credits: plan.creditsIncluded,
            creditsIncluded: plan.creditsIncluded,
        };
    }
    const monthly = plan.monthlyPriceUsd;
    if (billingPeriod === 'annual') {
        return {
            name: plan.name,
            priceUsd: annualChargeUsd(monthly),
            displayedMonthlyUsd: displayedYearlyMonthlyUsd(monthly),
            currency: 'USD',
            period: 'annual' as const,
            credits: plan.creditsIncluded,
            creditsIncluded: plan.creditsIncluded,
        };
    }
    return {
        name: plan.name,
        priceUsd: monthly,
        displayedMonthlyUsd: monthly,
        currency: 'USD',
        period: 'monthly' as const,
        credits: plan.creditsIncluded,
        creditsIncluded: plan.creditsIncluded,
    };
}

export function isSelfServePlanType(v: string): v is SelfServePlanType {
    return v === 'starter' || v === 'pro' || v === 'max';
}
