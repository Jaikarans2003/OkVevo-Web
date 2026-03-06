import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { RAZORPAY_CONFIG } from '@/config/razorpay';
import { db } from '@/config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Verify Razorpay Payment Signature
 * POST /api/razorpay/verify-payment
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature,
            userId,
            planType,
        } = body;

        if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
            return NextResponse.json(
                { success: false, error: 'Missing payment verification data' },
                { status: 400 }
            );
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_CONFIG.keySecret)
            .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            console.error('❌ Payment signature verification failed');
            return NextResponse.json(
                { success: false, error: 'Invalid payment signature' },
                { status: 400 }
            );
        }

        console.log('✅ Payment signature verified');

        // Store subscription in Firestore
        if (userId) {
            await setDoc(doc(db, 'subscriptions', userId), {
                userId,
                planType,
                subscriptionId: razorpay_subscription_id,
                paymentId: razorpay_payment_id,
                status: 'active',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            console.log(`✅ Subscription stored for user: ${userId}`);
        }

        return NextResponse.json({
            success: true,
            message: 'Payment verified successfully',
            subscriptionId: razorpay_subscription_id,
        });

    } catch (error) {
        console.error('❌ Payment verification error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Payment verification failed',
            },
            { status: 500 }
        );
    }
}
