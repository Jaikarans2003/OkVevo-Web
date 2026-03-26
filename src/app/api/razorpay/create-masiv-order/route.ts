import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { RAZORPAY_CONFIG } from '@/config/razorpay';

/**
 * Create Razorpay One-Time Order for MASIV
 * POST /api/razorpay/create-masiv-order
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cartItems, totalAmount, userName, whatsappNumber, email, userId } = body;

        if (!cartItems || !totalAmount || !userName || !whatsappNumber || !userId) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Initialize Razorpay instance
        const razorpay = new Razorpay({
            key_id: RAZORPAY_CONFIG.keyId,
            key_secret: RAZORPAY_CONFIG.keySecret,
        });

        // Create one-time order (not subscription)
        const order = await razorpay.orders.create({
            amount: totalAmount * 100, // Convert to paise
            currency: 'INR',
            receipt: `M${Date.now().toString().slice(-10)}`, // Max 40 chars - M + last 10 digits of timestamp
            notes: {
                userId,
                userName,
                whatsappNumber,
                email: email || '',
                itemCount: cartItems.length,
            },
        });

        console.log('✅ Razorpay order created:', order.id);

        return NextResponse.json({
            success: true,
            orderId: order.id,
            amount: totalAmount,
            currency: 'INR',
            razorpayKeyId: RAZORPAY_CONFIG.keyId,
        });

    } catch (error) {
        console.error('❌ Razorpay order creation error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create order',
            },
            { status: 500 }
        );
    }
}
