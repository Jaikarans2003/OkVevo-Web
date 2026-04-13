import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { CouponValidationRequest, CouponValidationResponse } from '@/types/coupon';

export async function POST(request: NextRequest) {
    try {
        const body: CouponValidationRequest = await request.json();
        const { couponCode, phoneNumber, totalAmount } = body;

        if (!couponCode || !phoneNumber || !totalAmount) {
            return NextResponse.json(
                { valid: false, message: 'Missing required fields', discountAmount: 0, type: null },
                { status: 400 }
            );
        }

        // Fetch coupon from Firestore
        const couponsRef = collection(db, 'coupons');
        const couponQuery = query(couponsRef, where('code', '==', couponCode.toUpperCase()));
        const couponSnapshot = await getDocs(couponQuery);

        if (couponSnapshot.empty) {
            return NextResponse.json({
                valid: false,
                message: 'Invalid coupon code',
                discountAmount: 0,
                type: null,
            } as CouponValidationResponse);
        }

        const couponDoc = couponSnapshot.docs[0];
        const coupon = couponDoc.data();

        // Check if coupon is active
        if (!coupon.isActive) {
            return NextResponse.json({
                valid: false,
                message: 'This coupon is no longer active',
                discountAmount: 0,
                type: null,
            } as CouponValidationResponse);
        }

        // Check minimum order value
        if (totalAmount < coupon.minOrderValue) {
            return NextResponse.json({
                valid: false,
                message: `Minimum order value of ₹${coupon.minOrderValue} required`,
                discountAmount: 0,
                type: null,
            } as CouponValidationResponse);
        }

        // Check if coupon already used by this phone number
        const usageRef = collection(db, 'couponUsage');
        const usageQuery = query(
            usageRef,
            where('phoneNumber', '==', phoneNumber),
            where('couponCode', '==', couponCode.toUpperCase())
        );
        const usageSnapshot = await getDocs(usageQuery);

        if (!usageSnapshot.empty) {
            return NextResponse.json({
                valid: false,
                message: 'You have already used this coupon',
                discountAmount: 0,
                type: null,
            } as CouponValidationResponse);
        }

        // For flat discount coupon, check purchase history
        if (coupon.type === 'flat') {
            // Read single document from userPurchaseHistory
            const historyRef = doc(db, 'userPurchaseHistory', phoneNumber);
            const historyDoc = await getDoc(historyRef);

            let purchaseCount = 0;
            let usedCoupons: string[] = [];

            if (historyDoc.exists()) {
                const data = historyDoc.data();
                purchaseCount = data.purchaseCount || 0;
                usedCoupons = data.usedCoupons || [];
            }
            // If document doesn't exist, treat as first-time customer (0 purchases)

            // Check if user has already used this specific coupon code
            if (usedCoupons.includes(couponCode.toUpperCase())) {
                return NextResponse.json({
                    valid: false,
                    message: 'You have already used this coupon in a previous order',
                    discountAmount: 0,
                    type: null,
                } as CouponValidationResponse);
            }

            // Coupon valid only on 2nd or 3rd purchase
            if (purchaseCount === 0) {
                return NextResponse.json({
                    valid: false,
                    message: 'This coupon is only valid for returning customers (2nd or 3rd purchase)',
                    discountAmount: 0,
                    type: null,
                } as CouponValidationResponse);
            }

            if (purchaseCount > 2) {
                return NextResponse.json({
                    valid: false,
                    message: 'This coupon is only valid for 2nd or 3rd purchase',
                    discountAmount: 0,
                    type: null,
                } as CouponValidationResponse);
            }
        }

        // Calculate discount
        let discountAmount = 0;
        // For affiliate coupons, NO discount to customer - only commission tracking
        if (coupon.type === 'affiliate') {
            discountAmount = 0; // Customer pays full price
        } else if (coupon.discountType === 'fixed') {
            discountAmount = coupon.discountAmount;
        } else if (coupon.discountType === 'percentage') {
            discountAmount = Math.round((totalAmount * coupon.discountAmount) / 100);
        }

        // Ensure discount doesn't exceed total amount
        discountAmount = Math.min(discountAmount, totalAmount);

        const finalAmount = totalAmount - discountAmount;

        return NextResponse.json({
            valid: true,
            message: coupon.type === 'affiliate' 
                ? 'Affiliate code applied - Your purchase supports this partner!'
                : 'Coupon applied successfully',
            discountAmount,
            type: coupon.type,
            affiliateId: coupon.affiliateId || undefined,
            finalAmount,
        } as CouponValidationResponse);

    } catch (error) {
        console.error('Coupon validation error:', error);
        return NextResponse.json(
            { valid: false, message: 'Failed to validate coupon', discountAmount: 0, type: null },
            { status: 500 }
        );
    }
}
