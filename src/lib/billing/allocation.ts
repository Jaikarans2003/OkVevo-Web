/**
 * Per-user anchored monthly allocation helpers.
 * Stripe-style month clamp: Jan 31 + 1 month → Feb 28/29.
 */

import { Timestamp } from 'firebase-admin/firestore';

/** Last-day clamp (Stripe billing-anchor convention). */
export function addOneMonthClamped(date: Date): Date {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();
    const h = date.getUTCHours();
    const min = date.getUTCMinutes();
    const s = date.getUTCSeconds();
    const ms = date.getUTCMilliseconds();

    const targetMonth = m + 1;
    // Day 0 of month after target = last day of target month
    const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return new Date(Date.UTC(y, targetMonth, day, h, min, s, ms));
}

export type AllocationUserSlice = {
    planStatus?: string | null;
    creditsIncluded?: number;
    allocationBalance?: number;
    nextAllocationDate?: Timestamp | Date | null;
};

export type AllocationRefreshPatch = {
    allocationBalance: number;
    nextAllocationDate: Timestamp;
};

/**
 * If plan is active and nextAllocationDate <= now, SET allocationBalance
 * and advance nextAllocationDate by one clamped month. Loop while overdue.
 * Never touches topUpBalance.
 */
export function refreshAllocationIfDue(
    user: AllocationUserSlice,
    now: Date = new Date()
): AllocationRefreshPatch | null {
    if (user.planStatus !== 'active') return null;
    const included = user.creditsIncluded;
    if (typeof included !== 'number' || !Number.isInteger(included) || included < 0) {
        return null;
    }

    let next = toDate(user.nextAllocationDate);
    if (!next || next.getTime() > now.getTime()) return null;

    // Loop while still overdue (skipped periods)
    while (next.getTime() <= now.getTime()) {
        next = addOneMonthClamped(next);
    }

    return {
        allocationBalance: included,
        nextAllocationDate: Timestamp.fromDate(next),
    };
}

/** First period: SET allocation immediately; next = current_start + 1 month. */
export function initialAllocationGrant(
    creditsIncluded: number,
    currentStart: Date
): AllocationRefreshPatch {
    return {
        allocationBalance: creditsIncluded,
        nextAllocationDate: Timestamp.fromDate(addOneMonthClamped(currentStart)),
    };
}

function toDate(v: Timestamp | Date | null | undefined): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate();
    return null;
}
