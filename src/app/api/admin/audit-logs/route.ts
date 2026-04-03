import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { isAdmin, getAuditLogs, logAdminAction } from '@/services/AdminService';

export const runtime = 'nodejs';


/**
 * GET /api/admin/audit-logs
 * Fetch recent audit logs
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

        // Get limit from query params
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 100;

        // Fetch audit logs
        const logs = await getAuditLogs(limit);

        // Log this action
        await logAdminAction({
            adminEmail: userEmail!,
            action: 'view_audit_logs',
            details: {
                limit,
                timestamp: new Date().toISOString(),
            },
        });

        return NextResponse.json({
            success: true,
            logs,
            count: logs.length,
        });
    } catch (error: any) {
        console.error('Admin audit logs API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
