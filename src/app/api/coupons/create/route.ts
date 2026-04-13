import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { verifyAdminToken } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        // Verify admin authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const isAdmin = await verifyAdminToken(token);

        if (!isAdmin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { code, type, discountAmount, discountType, affiliateId, minOrderValue } = body;

        if (!code || !type || discountAmount === undefined || !discountType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if coupon code already exists
        const couponsRef = collection(db, 'coupons');
        const existingQuery = query(couponsRef, where('code', '==', code.toUpperCase()));
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
            return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 });
        }

        // Create coupon
        const couponData = {
            code: code.toUpperCase(),
            type,
            discountAmount,
            discountType,
            affiliateId: affiliateId || null,
            isActive: true,
            minOrderValue: minOrderValue || 199,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(couponsRef, couponData);

        return NextResponse.json({
            success: true,
            couponId: docRef.id,
            code: code.toUpperCase(),
        });

    } catch (error) {
        console.error('Create coupon error:', error);
        return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
    }
}
