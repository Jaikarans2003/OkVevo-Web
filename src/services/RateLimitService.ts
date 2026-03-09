/**
 * Rate Limiting Service
 * 
 * Tracks user generations per hour using Firestore to prevent abuse.
 * Each feature has its own rate limit based on computational cost.
 */

import { db } from '../config/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

const COLLECTION = 'rateLimits';

// Rate limits per feature (generations per hour)
export const RATE_LIMITS = {
    PRODUCT_SHOOTS: 10,      // 10 shoots per hour (4 images each = 40 images/hr)
    PRODUCT_PLACEMENT: 15,   // 15 placements per hour
    AI_INFLUENCER: 5,        // 5 videos per hour (most expensive)
    TREND_GENERATION: 8,     // 8 trend videos per hour
    DIRECTOR_PHOTOS: 20,     // 20 director photos per hour
} as const;

export type FeatureType = keyof typeof RATE_LIMITS;

interface RateLimitRecord {
    userId: string;
    feature: FeatureType;
    count: number;
    windowStart: Timestamp;
    lastUpdated: Timestamp;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    error?: string;
}

/**
 * Check if user can perform an action and increment counter if allowed
 */
export async function checkRateLimit(
    userId: string,
    feature: FeatureType
): Promise<RateLimitResult> {
    const limit = RATE_LIMITS[feature];
    const now = new Date();
    const docId = `${userId}_${feature}`;

    try {
        const docRef = doc(db, COLLECTION, docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // First request - create new record
            const newRecord: RateLimitRecord = {
                userId,
                feature,
                count: 1,
                windowStart: Timestamp.now(),
                lastUpdated: Timestamp.now(),
            };
            await setDoc(docRef, newRecord);

            return {
                allowed: true,
                remaining: limit - 1,
                resetAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
            };
        }

        const data = docSnap.data() as RateLimitRecord;
        const windowStart = data.windowStart.toDate();
        const hoursSinceStart = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60);

        // Reset window if more than 1 hour has passed
        if (hoursSinceStart >= 1) {
            const newRecord: RateLimitRecord = {
                userId,
                feature,
                count: 1,
                windowStart: Timestamp.now(),
                lastUpdated: Timestamp.now(),
            };
            await setDoc(docRef, newRecord);

            return {
                allowed: true,
                remaining: limit - 1,
                resetAt: new Date(now.getTime() + 60 * 60 * 1000),
            };
        }

        // Check if limit exceeded
        if (data.count >= limit) {
            const resetAt = new Date(windowStart.getTime() + 60 * 60 * 1000);
            const minutesUntilReset = Math.ceil((resetAt.getTime() - now.getTime()) / (1000 * 60));

            return {
                allowed: false,
                remaining: 0,
                resetAt,
                error: `Rate limit exceeded. You can generate ${limit} ${feature.toLowerCase().replace('_', ' ')}s per hour. Try again in ${minutesUntilReset} minutes.`,
            };
        }

        // Increment counter
        const updatedRecord: RateLimitRecord = {
            ...data,
            count: data.count + 1,
            lastUpdated: Timestamp.now(),
        };
        await setDoc(docRef, updatedRecord);

        const resetAt = new Date(windowStart.getTime() + 60 * 60 * 1000);

        return {
            allowed: true,
            remaining: limit - updatedRecord.count,
            resetAt,
        };

    } catch (error) {
        console.error('Rate limit check failed:', error);
        // Fail open - allow the request if rate limiting fails
        return {
            allowed: true,
            remaining: limit,
            resetAt: new Date(now.getTime() + 60 * 60 * 1000),
        };
    }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
    userId: string,
    feature: FeatureType
): Promise<RateLimitResult> {
    const limit = RATE_LIMITS[feature];
    const now = new Date();
    const docId = `${userId}_${feature}`;

    try {
        const docRef = doc(db, COLLECTION, docId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return {
                allowed: true,
                remaining: limit,
                resetAt: new Date(now.getTime() + 60 * 60 * 1000),
            };
        }

        const data = docSnap.data() as RateLimitRecord;
        const windowStart = data.windowStart.toDate();
        const hoursSinceStart = (now.getTime() - windowStart.getTime()) / (1000 * 60 * 60);

        // Window has reset
        if (hoursSinceStart >= 1) {
            return {
                allowed: true,
                remaining: limit,
                resetAt: new Date(now.getTime() + 60 * 60 * 1000),
            };
        }

        const resetAt = new Date(windowStart.getTime() + 60 * 60 * 1000);
        const remaining = Math.max(0, limit - data.count);

        return {
            allowed: remaining > 0,
            remaining,
            resetAt,
            error: remaining === 0 ? `Rate limit exceeded. Try again in ${Math.ceil((resetAt.getTime() - now.getTime()) / (1000 * 60))} minutes.` : undefined,
        };

    } catch (error) {
        console.error('Rate limit status check failed:', error);
        return {
            allowed: true,
            remaining: limit,
            resetAt: new Date(now.getTime() + 60 * 60 * 1000),
        };
    }
}

/**
 * Reset rate limit for a user (admin function)
 */
export async function resetRateLimit(
    userId: string,
    feature: FeatureType
): Promise<void> {
    const docId = `${userId}_${feature}`;
    const docRef = doc(db, COLLECTION, docId);
    
    await setDoc(docRef, {
        userId,
        feature,
        count: 0,
        windowStart: Timestamp.now(),
        lastUpdated: Timestamp.now(),
    });
}
