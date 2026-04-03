import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

interface CartItem {
    id: string;
    name: string;
    price: number;
    trendType: 'photo' | 'video';
    fullBodyImageUrl: string;
    faceImageUrl: string | null;
}

interface CreateOrderRequest {
    userId: string;
    customerName: string;
    whatsappNumber: string;
    email: string | null;
    items: CartItem[];
    totalAmount: number;
}

export async function POST(request: NextRequest) {
    try {
        console.log('📦 MASIV Order API called');
        
        const body: CreateOrderRequest = await request.json();
        const { userId, customerName, whatsappNumber, email, items, totalAmount } = body;

        console.log('📦 Request body:', { userId, customerName, whatsappNumber, itemCount: items?.length, totalAmount });

        // Validate required fields
        if (!userId || !customerName || !whatsappNumber || !items || items.length === 0 || !totalAmount) {
            console.error('❌ Missing required fields');
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check environment variables
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.error('❌ Missing Razorpay credentials in environment');
            return NextResponse.json(
                { error: 'Server configuration error: Missing payment credentials' },
                { status: 500 }
            );
        }

        // Create Razorpay order using SDK
        console.log('🔑 Initializing Razorpay SDK...');
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        console.log('✅ Razorpay SDK initialized');

        const amountInPaise = Math.round(totalAmount * 100);
        const receipt = `masiv_${Date.now()}_${userId.substring(0, 8)}`;

        console.log('💳 Creating Razorpay order...', { amountInPaise, receipt });
        const orderData = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt,
            notes: {
                userId,
                customerName,
                whatsappNumber,
                email: email || '',
                orderType: 'masiv',
            },
        });
        console.log('✅ Razorpay order created:', orderData.id);

        const orderId = orderData.id;

        // Create Firestore document immediately
        const orderDoc = {
            orderId,
            paymentId: null,
            userId,
            customerName,
            whatsappNumber,
            email: email || null,
            items: items.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                trendType: item.trendType,
                fullBodyImageUrl: item.fullBodyImageUrl,
                faceImageUrl: item.faceImageUrl,
            })),
            totalAmount,
            currency: 'INR',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            paidAt: null,
        };

        console.log('💾 Saving to Firestore...');
        await db.collection('masiv_orders').doc(orderId).set(orderDoc);
        console.log(`✅ Created MASIV order: ${orderId} with status=pending`);

        // Return order details to frontend
        return NextResponse.json({
            orderId,
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: amountInPaise,
            currency: 'INR',
        });

    } catch (error: any) {
        console.error('❌ Error creating MASIV order:', error);
        console.error('Error stack:', error.stack);
        
        // Return a proper JSON error response
        return NextResponse.json(
            { 
                error: error.message || 'Failed to create order',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
