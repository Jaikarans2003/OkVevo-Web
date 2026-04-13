import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdminToken } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * Manual sync tool to update affiliate stats from existing orders
 * Use this if webhook failed to process affiliate commissions
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

        const body = await request.json();
        const { affiliateId } = body;

        if (!affiliateId) {
            return NextResponse.json({ error: 'affiliateId is required' }, { status: 400 });
        }

        // Get all paid orders for this affiliate
        const ordersSnapshot = await db.collection('masiv_orders')
            .where('affiliateId', '==', affiliateId)
            .where('status', '==', 'paid')
            .get();

        let totalSales = 0;
        let totalEarnings = 0;

        // Group orders by customer phone number
        const customerSales: { [phone: string]: any } = {};

        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const customerPhone = order.whatsappNumber;
            
            totalSales++;
            totalEarnings += order.affiliateCommission || 0;

            // Group by customer
            if (!customerSales[customerPhone]) {
                customerSales[customerPhone] = {
                    customerPhone,
                    totalPurchases: 0,
                    totalAmountPaid: 0,
                    totalCommissionEarned: 0,
                    orders: [],
                    firstPurchaseDate: order.paidAt,
                    lastPurchaseDate: order.paidAt,
                };
            }

            customerSales[customerPhone].totalPurchases++;
            customerSales[customerPhone].totalAmountPaid += order.finalAmount || 0;
            customerSales[customerPhone].totalCommissionEarned += order.affiliateCommission || 0;
            customerSales[customerPhone].orders.push(doc.id);
            customerSales[customerPhone].lastPurchaseDate = order.paidAt;
            customerSales[customerPhone].lastOrderId = doc.id;
            customerSales[customerPhone].lastAmountPaid = order.finalAmount || 0;
            customerSales[customerPhone].lastCommission = order.affiliateCommission || 0;
        });

        // Update affiliate stats
        const affiliateRef = db.collection('affiliates').doc(affiliateId);
        await affiliateRef.update({
            totalSales,
            totalEarnings,
            updatedAt: FieldValue.serverTimestamp(),
        });

        // Create/update sales sub-collection for each customer
        const salesPromises = Object.keys(customerSales).map(async (customerPhone) => {
            const saleData = customerSales[customerPhone];
            const saleRef = affiliateRef.collection('sales').doc(customerPhone);
            
            await saleRef.set({
                ...saleData,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        });

        await Promise.all(salesPromises);

        console.log(`✅ Synced affiliate stats: ${affiliateId} - Sales: ${totalSales}, Earnings: ₹${totalEarnings}, Customers: ${Object.keys(customerSales).length}`);

        return NextResponse.json({
            success: true,
            affiliateId,
            totalSales,
            totalEarnings,
            totalCustomers: Object.keys(customerSales).length,
            message: `Updated ${totalSales} sales from ${Object.keys(customerSales).length} customers with total earnings of ₹${totalEarnings}`,
        });

    } catch (error: any) {
        console.error('Sync affiliate stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
