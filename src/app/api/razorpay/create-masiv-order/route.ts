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
    couponCode?: string;
    discountAmount?: number;
    affiliateId?: string;
}

export async function POST(request: NextRequest) {
    try {
        console.log('📦 MASIV Order API called');
        
        const body: CreateOrderRequest = await request.json();
        const { userId, customerName, whatsappNumber, email, items, totalAmount, couponCode, discountAmount, affiliateId } = body;

        console.log('📦 Request body:', { userId, customerName, whatsappNumber, itemCount: items?.length, totalAmount, couponCode, discountAmount });

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

        // Calculate final amount after discount
        const finalAmount = discountAmount ? totalAmount - discountAmount : totalAmount;
        const amountInPaise = Math.round(finalAmount * 100);
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

        // Calculate affiliate commission if applicable (10% of total amount user pays)
        const affiliateCommission = affiliateId ? Math.round(finalAmount * 0.10) : 0;

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
            discountAmount: discountAmount || 0,
            finalAmount,
            couponCode: couponCode || null,
            affiliateId: affiliateId || null,
            affiliateCommission,
            currency: 'INR',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            paidAt: null,
        };

        console.log('💾 Saving to Firestore...');
        await db.collection('masiv_orders').doc(orderId).set(orderDoc);
        console.log(`✅ Created MASIV order: ${orderId} with status=pending`);

        // Create/update userPurchaseHistory immediately
        console.log('📊 Updating purchase history...');
        const historyRef = db.collection('userPurchaseHistory').doc(whatsappNumber);
        const historyDoc = await historyRef.get();

        if (historyDoc.exists) {
            // Existing user - increment count and add coupon
            const updates: any = {
                purchaseCount: FieldValue.increment(1),
                orders: FieldValue.arrayUnion(orderId),
                lastOrderDate: FieldValue.serverTimestamp(),
            };

            if (couponCode) {
                updates.usedCoupons = FieldValue.arrayUnion(couponCode.toUpperCase());
            }

            await historyRef.update(updates);
            console.log(`📊 Updated purchase history for: ${whatsappNumber}`);
        } else {
            // New user - create document
            await historyRef.set({
                phoneNumber: whatsappNumber,
                purchaseCount: 1,
                orders: [orderId],
                usedCoupons: couponCode ? [couponCode.toUpperCase()] : [],
                lastOrderDate: FieldValue.serverTimestamp(),
                createdAt: FieldValue.serverTimestamp(),
            });
            console.log(`📊 Created purchase history for new user: ${whatsappNumber}`);
        }

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
