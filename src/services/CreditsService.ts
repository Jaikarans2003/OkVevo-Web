/**
 * Credits Service
 *
 * Client reads only. SoT is users/{uid} two buckets.
 * Ledger is top-level creditTransactions (Admin-written).
 */

import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    type Unsubscribe,
} from 'firebase/firestore';
import {
    remainingPct,
    type CreditTransaction,
    type UserCredits,
} from '../types/credits';

export type { CreditTransaction, UserCredits };

export type BillingSnapshot = {
    plan: string | null;
    planName: string | null;
    planStatus: string | null;
    billingCycle: string | null;
    creditsIncluded: number;
    allocationBalance: number;
    topUpBalance: number;
    /** Period remaining as 0..1 — never show raw allocation. */
    remainingPct: number;
    /** Additional = current purchased wallet. */
    additional: number;
    currentPeriodEnd: Date | null;
    nextAllocationDate: Date | null;
    cancelAtPeriodEnd: boolean;
    razorpaySubscriptionId: string | null;
};

function readInt(n: unknown): number {
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
}

function toDate(v: unknown): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
        return (v as { toDate: () => Date }).toDate();
    }
    return null;
}

export function billingSnapshotFromUserData(data: Record<string, unknown> | undefined): BillingSnapshot {
    if (!data) {
        return {
            plan: null,
            planName: null,
            planStatus: null,
            billingCycle: null,
            creditsIncluded: 0,
            allocationBalance: 0,
            topUpBalance: 0,
            remainingPct: 0,
            additional: 0,
            currentPeriodEnd: null,
            nextAllocationDate: null,
            cancelAtPeriodEnd: false,
            razorpaySubscriptionId: null,
        };
    }
    const allocationBalance = readInt(data.allocationBalance);
    let topUpBalance = readInt(data.topUpBalance);
    const legacy = readInt(data.creditBalance);
    if (allocationBalance === 0 && topUpBalance === 0 && legacy > 0 && data.topUpBalance === undefined) {
        topUpBalance = legacy;
    }
    const creditsIncluded = readInt(data.creditsIncluded);
    return {
        plan: typeof data.plan === 'string' ? data.plan : null,
        planName: typeof data.planName === 'string' ? data.planName : null,
        planStatus: typeof data.planStatus === 'string' ? data.planStatus : null,
        billingCycle: typeof data.billingCycle === 'string' ? data.billingCycle : null,
        creditsIncluded,
        allocationBalance,
        topUpBalance,
        remainingPct: remainingPct(creditsIncluded, allocationBalance),
        additional: topUpBalance,
        currentPeriodEnd: toDate(data.currentPeriodEnd),
        nextAllocationDate: toDate(data.nextAllocationDate),
        cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
        razorpaySubscriptionId:
            typeof data.razorpaySubscriptionId === 'string' ? data.razorpaySubscriptionId : null,
    };
}

/** @deprecated Prefer getBillingSnapshot / subscribeUserBilling — raw sum is not the period figure. */
export async function getUserCredits(userId: string): Promise<number> {
    const snap = await getBillingSnapshot(userId);
    return snap.allocationBalance + snap.topUpBalance;
}

export async function getBillingSnapshot(userId: string): Promise<BillingSnapshot> {
    if (!userId) return billingSnapshotFromUserData(undefined);
    try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (!snap.exists()) return billingSnapshotFromUserData(undefined);
        return billingSnapshotFromUserData(snap.data() as Record<string, unknown>);
    } catch (error) {
        console.error('Failed to get billing snapshot:', error);
        return billingSnapshotFromUserData(undefined);
    }
}

export function subscribeUserBilling(
    userId: string,
    onData: (snap: BillingSnapshot) => void,
    onError?: (err: Error) => void
): Unsubscribe {
    if (!userId) {
        onData(billingSnapshotFromUserData(undefined));
        return () => {};
    }
    return onSnapshot(
        doc(db, 'users', userId),
        (snap) => {
            onData(billingSnapshotFromUserData(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined));
        },
        (err) => {
            console.error('subscribeUserBilling:', err);
            onError?.(err);
        }
    );
}

export async function getCreditHistory(
    userId: string,
    limitCount: number = 50
): Promise<CreditTransaction[]> {
    if (!userId) return [];

    try {
        const q = query(
            collection(db, 'creditTransactions'),
            where('uid', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as CreditTransaction));
    } catch (error) {
        console.error('Failed to get credit history:', error);
        return [];
    }
}
