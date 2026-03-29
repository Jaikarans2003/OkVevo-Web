import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(
            process.env.FB_SERVICE_ACCOUNT_KEY || '{}'
        );
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FB_STORAGE_BUCKET,
        });
    } catch (error) {
        console.error('Firebase admin initialization error:', error);
    }
}

const db = admin.firestore();

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
        const body: CreateOrderRequest = await request.json();
        const { userId, customerName, whatsappNumber, email, items, totalAmount } = body;

        // Validate required fields
        if (!userId || !customerName || !whatsappNumber || !items || items.length === 0 || !totalAmount) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Create Razorpay order using SDK
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const amountInPaise = Math.round(totalAmount * 100);
        const receipt = `masiv_${Date.now()}_${userId.substring(0, 8)}`;

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
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            paidAt: null,
        };

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
        console.error('Error creating MASIV order:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create order' },
            { status: 500 }
        );
    }
}
