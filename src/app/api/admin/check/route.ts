import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { isAdmin } from '@/services/AdminService';

export const runtime = 'nodejs';


export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ isAdmin: false }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        const email = decodedToken.email;

        if (isAdmin(email)) {
            return NextResponse.json({ isAdmin: true, email });
        } else {
            return NextResponse.json({ isAdmin: false }, { status: 403 });
        }
    } catch (error) {
        console.error('Admin Check Error:', error);
        return NextResponse.json({ isAdmin: false }, { status: 500 });
    }
}
