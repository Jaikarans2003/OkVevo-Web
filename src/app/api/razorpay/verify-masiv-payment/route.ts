import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { RAZORPAY_CONFIG } from '@/config/razorpay';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Verify Razorpay Payment and Create Order in Firestore
 * POST /api/razorpay/verify-masiv-payment
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            cartItems,
            userName,
            whatsappNumber,
            email,
            userId,
            userEmail,
            totalAmount,
        } = body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return NextResponse.json(
                { success: false, error: 'Missing payment verification data' },
                { status: 400 }
            );
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', RAZORPAY_CONFIG.keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            console.error('❌ Payment signature verification failed');
            return NextResponse.json(
                { success: false, error: 'Invalid payment signature' },
                { status: 400 }
            );
        }

        console.log('✅ Payment signature verified');

        // Create single order document in Firestore with all cart items
        const orderDoc = await addDoc(collection(db, 'masiv_orders'), {
            orderId: razorpay_order_id,
            userId,
            userEmail: userEmail || 'anonymous',
            userName,
            whatsappNumber,
            email: email || null,
            
            items: cartItems.map((item: any) => ({
                trendId: item.id,
                trendName: item.name,
                trendType: item.trendType,
                price: item.price,
                fullBodyImageUrl: item.fullBodyImageUrl,
                faceImageUrl: item.faceImageUrl,
            })),
            
            totalAmount,
            paymentStatus: 'paid',
            isVerified: false,  // Frontend verification - webhook will set to true
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            
            status: 'pending',  // Will move to 'processing' after webhook verification
            createdAt: serverTimestamp(),
            paidAt: serverTimestamp(),
        });

        console.log(`✅ Order created in Firestore: ${orderDoc.id}`);

        return NextResponse.json({
            success: true,
            message: 'Payment verified and order created successfully',
            orderId: razorpay_order_id,
            firestoreDocId: orderDoc.id,
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
