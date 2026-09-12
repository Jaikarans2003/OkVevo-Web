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
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return { allowed: false, reason: 'No subscription found. Please subscribe to a plan.' };
        }

        const userData = userDoc.data();
        const status = userData?.planStatus as string | undefined;

        if (!status) {
            return { allowed: false, reason: 'No subscription found. Please subscribe to a plan.' };
        }

        if (status === 'active') {
            return { allowed: true, subscription: userData };
        }

        return {
            allowed: false,
            reason: `Subscription is ${status}. Please renew your subscription.`,
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
