import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';
import { isAdmin, getAllUsers, logAdminAction } from '@/services/AdminService';

// Initialize Firebase Admin if not already initialized
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
        console.error('Failed to initialize Firebase Admin:', error);
    }
}

/**
 * GET /api/admin/users
 * Fetch all users with aggregated stats
 * Requires admin authentication
 */
export async function GET(request: NextRequest) {
    try {
        // Get auth token from header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized - No token provided' },
                { status: 401 }
            );
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify Firebase token
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(token);
        } catch (error) {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid token' },
                { status: 401 }
            );
        }

        const userEmail = decodedToken.email;

        // Check if user is admin (server-side only)
        if (!isAdmin(userEmail)) {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            );
        }

        // Fetch all users
        const users = await getAllUsers();

        // Log admin action
        await logAdminAction({
            adminEmail: userEmail!,
            action: 'view_users',
            details: {
                userCount: users.length,
                timestamp: new Date().toISOString(),
            },
        });

        return NextResponse.json({
            success: true,
            users,
            count: users.length,
        });
    } catch (error: any) {
        console.error('Admin users API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
