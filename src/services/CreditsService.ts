/**
 * Credits Service
 *
 * Client reads only. Balance is users/{uid}.creditBalance.
 * Ledger is top-level creditTransactions (Admin-written).
 */

import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
} from 'firebase/firestore';
import type { CreditTransaction } from '../types/credits';

export type { CreditTransaction };

export async function getUserCredits(userId: string): Promise<number> {
    if (!userId) return 0;

    try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (!snap.exists()) return 0;
        const n = snap.data().creditBalance;
        return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0;
    } catch (error) {
        console.error('Failed to get user credits:', error);
        return 0;
    }
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
