import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdminToken } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * Migration script to populate userPurchaseHistory from existing masiv_orders
 * This is a one-time operation to backfill purchase history for existing users
 */
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

        console.log('🔄 Starting purchase history migration...');

        // Get all paid orders from masiv_orders
        const ordersSnapshot = await db.collection('masiv_orders')
            .where('status', '==', 'paid')
            .get();

        console.log(`📊 Found ${ordersSnapshot.size} paid orders`);

        // Group orders by phone number
        const userOrders: { [phoneNumber: string]: any[] } = {};

        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const phoneNumber = order.whatsappNumber;

            if (phoneNumber) {
                if (!userOrders[phoneNumber]) {
                    userOrders[phoneNumber] = [];
                }
                userOrders[phoneNumber].push({
                    orderId: doc.id,
                    couponCode: order.couponCode,
                    paidAt: order.paidAt,
                });
            }
        });

        const phoneNumbers = Object.keys(userOrders);
        console.log(`👥 Found ${phoneNumbers.length} unique users`);

        let created = 0;
        let updated = 0;
        let errors = 0;

        // Create/update userPurchaseHistory for each user
        for (const phoneNumber of phoneNumbers) {
            try {
                const orders = userOrders[phoneNumber];
                const purchaseCount = orders.length;

                // Extract unique coupon codes (filter out null/undefined)
                const usedCoupons = [...new Set(
                    orders
                        .map(o => o.couponCode)
                        .filter(c => c != null)
                        .map(c => c.toUpperCase())
                )];

                // Get order IDs
                const orderIds = orders.map(o => o.orderId);

                // Find the latest purchase date
                const latestOrder = orders.reduce((latest, current) => {
                    if (!latest.paidAt) return current;
                    if (!current.paidAt) return latest;
                    return current.paidAt > latest.paidAt ? current : latest;
                }, orders[0]);

                const historyRef = db.collection('userPurchaseHistory').doc(phoneNumber);
                const historyDoc = await historyRef.get();

                if (historyDoc.exists) {
                    // Update existing document
                    await historyRef.update({
                        purchaseCount,
                        orders: orderIds,
                        usedCoupons,
                        lastOrderDate: latestOrder.paidAt || FieldValue.serverTimestamp(),
                        migratedAt: FieldValue.serverTimestamp(),
                    });
                    updated++;
                    console.log(`✅ Updated: ${phoneNumber} (${purchaseCount} purchases, ${usedCoupons.length} coupons)`);
                } else {
                    // Create new document
                    await historyRef.set({
                        phoneNumber,
                        purchaseCount,
                        orders: orderIds,
                        usedCoupons,
                        lastOrderDate: latestOrder.paidAt || FieldValue.serverTimestamp(),
                        createdAt: FieldValue.serverTimestamp(),
                        migratedAt: FieldValue.serverTimestamp(),
                    });
                    created++;
                    console.log(`✅ Created: ${phoneNumber} (${purchaseCount} purchases, ${usedCoupons.length} coupons)`);
                }
            } catch (error: any) {
                console.error(`❌ Error processing ${phoneNumber}:`, error.message);
                errors++;
            }
        }

        const summary = {
            success: true,
            totalOrders: ordersSnapshot.size,
            totalUsers: phoneNumbers.length,
            created,
            updated,
            errors,
            message: `Migration complete: ${created} created, ${updated} updated, ${errors} errors`,
        };

        console.log('✅ Migration complete:', summary);

        return NextResponse.json(summary);

    } catch (error: any) {
        console.error('❌ Migration error:', error);
        return NextResponse.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
}
