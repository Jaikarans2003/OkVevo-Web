import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { isAdmin, updateUserCredits } from '@/services/AdminService';
import type { CreditUpdateRequest } from '@/types/admin';

export const runtime = 'nodejs';


/**
 * POST /api/admin/update-credits
 * Update user credits (add/deduct/set)
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

        // Get request body
        const body: CreditUpdateRequest = await request.json();
        const { userId, operation, amount, reason } = body;

        // Validate request
        if (!userId || !operation || amount === undefined || !reason) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, operation, amount, reason' },
                { status: 400 }
            );
        }

        if (!['add', 'deduct', 'set'].includes(operation)) {
            return NextResponse.json(
                { error: 'Invalid operation. Must be: add, deduct, or set' },
                { status: 400 }
            );
        }

        if (amount < 0) {
            return NextResponse.json(
                { error: 'Amount must be positive' },
                { status: 400 }
            );
        }

        // Update credits
        await updateUserCredits(body, userEmail!);

        return NextResponse.json({
            success: true,
            message: `Credits ${operation}ed successfully`,
        });
    } catch (error: any) {
        console.error('Admin update credits API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
