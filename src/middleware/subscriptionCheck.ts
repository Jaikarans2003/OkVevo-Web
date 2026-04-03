import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


/**
 * Subscription Check Middleware
 * 
 * Enforces active subscription before allowing AI operations.
 * Checks:
 * 1. Subscription exists
 * 2. Status is 'active' OR within grace period
 * 3. Grace period hasn't expired
 * 
 * Returns 403 if subscription is invalid or expired.
 */
export async function checkSubscription(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    subscription?: any;
}> {
    if (!userId) {
        return { allowed: false, reason: 'User ID required' };
    }

    // Bypass check if env variable is set (for testing)
    if (process.env.NEXT_PUBLIC_BYPASS_SUBSCRIPTION === 'true') {
        return { allowed: true, reason: 'Bypass enabled' };
    }

    try {
        // Query user's active subscriptions
        const subscriptionsSnapshot = await db
            .collection('users')
            .doc(userId)
            .collection('subscriptions')
            .where('status', 'in', ['active', 'pending', 'authenticated'])
            .limit(1)
            .get();

        if (subscriptionsSnapshot.empty) {
            // Try to find any subscription (even halted/cancelled) to provide better error message
            const anySubSnapshot = await db
                .collection('users')
                .doc(userId)
                .collection('subscriptions')
                .limit(1)
                .get();

            if (anySubSnapshot.empty) {
                return { allowed: false, reason: 'No subscription found. Please subscribe to a plan.' };
            }

            const subData = anySubSnapshot.docs[0].data();
            return { 
                allowed: false, 
                reason: `Subscription is ${subData.status}. Please renew your subscription.` 
            };
        }

        const subscriptionData = subscriptionsSnapshot.docs[0].data();
        const status = subscriptionData.status;

        // Active subscription - allow
        if (status === 'active') {
            return { allowed: true, subscription: subscriptionData };
        }

        // Pending or authenticated - check grace period
        if (status === 'pending' || status === 'authenticated') {
            const gracePeriodEndsAt = subscriptionData.gracePeriodEndsAt;

            if (gracePeriodEndsAt) {
                const now = new Date();
                const gracePeriodEnd = gracePeriodEndsAt.toDate();

                if (now < gracePeriodEnd) {
                    // Within grace period - allow
                    return { 
                        allowed: true, 
                        subscription: subscriptionData,
                        reason: 'Grace period active'
                    };
                } else {
                    // Grace period expired
                    return { 
                        allowed: false, 
                        reason: 'Payment failed and grace period expired. Please update payment method.' 
                    };
                }
            }

            // No grace period set but status is pending/authenticated - allow for now
            return { allowed: true, subscription: subscriptionData };
        }

        // Any other status - deny
        return { 
            allowed: false, 
            reason: `Subscription is ${status}. Please contact support.` 
        };

    } catch (error) {
        console.error('Subscription check error:', error);
        return { 
            allowed: false, 
            reason: 'Error checking subscription. Please try again.' 
        };
    }
}

/**
 * Middleware wrapper for API routes
 * 
 * Usage in API route:
 * ```typescript
 * import { withSubscriptionCheck } from '@/middleware/subscriptionCheck';
 * 
 * export const POST = withSubscriptionCheck(async (request, { userId }) => {
 *   // Your handler code
 * });
 * ```
 */
export function withSubscriptionCheck(
    handler: (request: NextRequest, context: { userId: string }) => Promise<NextResponse>
) {
    return async (request: NextRequest): Promise<NextResponse> => {
        try {
            // Extract userId from request (adjust based on your auth implementation)
            const userId = request.headers.get('x-user-id') || 
                          request.headers.get('authorization')?.split(' ')[1]; // Adjust as needed

            if (!userId) {
                return NextResponse.json(
                    { error: 'Authentication required' },
                    { status: 401 }
                );
            }

            // Check subscription
            const { allowed, reason } = await checkSubscription(userId);

            if (!allowed) {
                return NextResponse.json(
                    { error: reason || 'Active subscription required' },
                    { status: 403 }
                );
            }

            // Subscription valid - proceed with handler
            return handler(request, { userId });

        } catch (error: any) {
            console.error('Middleware error:', error);
            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    };
}

/**
 * Check subscription from Firebase client SDK
 * (For use in client-side components)
 */
export async function checkSubscriptionClient(userId: string): Promise<boolean> {
    try {
        const response = await fetch('/api/subscription/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });

        const data = await response.json();
        return data.allowed || false;
    } catch (error) {
        console.error('Client subscription check error:', error);
        return false;
    }
}
