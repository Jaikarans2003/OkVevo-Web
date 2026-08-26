import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { isAdmin, getAllUsers, logAdminAction } from '@/services/AdminService';

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
            decodedToken = await auth.verifyIdToken(token);
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
