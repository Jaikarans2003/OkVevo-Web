import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';
import { isAdmin, deleteUser } from '@/services/AdminService';

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
 * POST /api/admin/delete-user
 * Delete a user and all associated data
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
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

        // Get request body
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            );
        }

        // Delete user and all data
        await deleteUser(userId, userEmail!);

        return NextResponse.json({
            success: true,
            message: `User ${userId} deleted successfully`,
        });
    } catch (error: any) {
        console.error('Admin delete user API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
