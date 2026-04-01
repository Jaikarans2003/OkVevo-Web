import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';

// Initialize Firebase Admin globally to avoid multiple reitialization errors
if (!admin.apps.length) {
    try {
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
        if (serviceAccountKey) {
            const serviceAccount = JSON.parse(
                Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
            );
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        }
    } catch (error) {
        console.error('Failed to initialize Firebase Admin in API Utils:', error);
    }
}

// --- Rate Limiting (In-Memory for MVP) ---
// Using Map for MVP as requested instead of external Redis for simplicity
const userRateLimits = new Map<string, { count: number; resetAt: number }>();

let globalRequestCount = 0;
let globalResetAt = Date.now() + 1000; // 1 second window

export const checkRateLimit = (key: string, limitPerMinute: number): boolean => {
    const now = Date.now();
    let currentLimit = userRateLimits.get(key);

    if (!currentLimit || currentLimit.resetAt < now) {
        currentLimit = { count: 1, resetAt: now + 60000 }; // 60s window
    } else {
        currentLimit.count++;
    }

    userRateLimits.set(key, currentLimit);
    return currentLimit.count <= limitPerMinute;
};

// Protect the server from burst overloads
export const checkGlobalRateLimit = (limitPerSec: number = 200): boolean => {
    const now = Date.now();
    if (globalResetAt < now) {
        globalRequestCount = 1;
        globalResetAt = now + 1000;
    } else {
        globalRequestCount++;
    }
    return globalRequestCount <= limitPerSec;
};

// --- Standardized Responses ---
export const apiError = (code: string, message: string, status: number = 400, retryAfter?: number) => {
    const responseData: any = { success: false, error: { code, message } };
    
    return NextResponse.json(responseData, {
        status,
        headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined
    });
};

export const apiSuccess = (data: any = {}) => NextResponse.json({ success: true, data });

// --- Wrapper Types ---
interface ApiContext {
    userId: string;
    decodedToken?: admin.auth.DecodedIdToken;
}

export type ProtectedHandler = (req: NextRequest, ctx: ApiContext) => Promise<NextResponse>;

/**
 * Route Wrapper: Standardizes Auth, Rate Limiting, Error Handling, and Logging.
 * Usage: export const POST = apiHandler(async (req, ctx) => { ... }, { limitPerMin: 10 });
 */
export const apiHandler = (
    handler: ProtectedHandler,
    options: { limitPerMin: number; allowAnonymous?: boolean } = { limitPerMin: 10, allowAnonymous: false }
) => {
    return async (req: NextRequest): Promise<NextResponse> => {
        try {
            // 1. Global Rate Limiter
            if (!checkGlobalRateLimit(200)) {
                return apiError('SYSTEM_OVERLOAD', 'Service is currently overloaded', 503, 5);
            }

            // 2. Authentication layer
            let userId = 'anonymous';
            let decodedToken: any = null;

            const authHeader = req.headers.get('authorization');
            if (!options.allowAnonymous) {
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return apiError('UNAUTHORIZED', 'Missing or invalid authentication token', 401);
                }

                const token = authHeader.split('Bearer ')[1];
                try {
                    decodedToken = await getAuth().verifyIdToken(token);
                    userId = decodedToken.uid;
                } catch (error) {
                    return apiError('UNAUTHORIZED', 'Invalid or expired token', 401);
                }
            } else {
                // Determine rough IP for anonymous rate limiting
                userId = req.headers.get('x-forwarded-for') || 'anonymous-ip';
            }

            // 3. User Rate Limiter
            const endpointPath = new URL(req.url).pathname;
            const rlKey = `${userId}:${endpointPath}`;

            if (!checkRateLimit(rlKey, options.limitPerMin)) {
                console.warn(`[RATE LIMIT HIT] User ${userId} exceeded limit on ${endpointPath}`);
                return apiError('RATE_LIMIT', 'Too many requests. Please try again later.', 429, 60);
            }

            // 4. Input Payload Limits (basic protection to avoid massive JSON parses)
            const contentLength = req.headers.get('content-length');
            if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) { // 2MB limit
                return apiError('PAYLOAD_TOO_LARGE', 'Payload size exceeds the 2MB limit', 413);
            }

            // 5. Run Handler
            return await handler(req, { userId, decodedToken });

        } catch (error: any) {
            console.error(`[API ERROR] ${req.url}:`, error);

            // Timeout or System errors from AI
            if (error.message?.includes('timeout')) {
                return apiError('TIMEOUT', 'The AI provider took too long to respond', 504);
            }
            if (error.message?.includes('rate limit') || error.message?.includes('429')) {
                return apiError('UPSTREAM_RATE_LIMIT', 'The underlying AI provider is currently at capacity. Retrying later.', 503, 30);
            }
            
            return apiError('INTERNAL_ERROR', error.message || 'An unexpected error occurred', 500);
        }
    };
};
