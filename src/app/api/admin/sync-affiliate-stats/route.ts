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

        const affiliateRef = db.collection('affiliates').doc(affiliateId);

        // ========== 1. SYNC MASIV ORDERS ==========
        // Query for both 'paid' (new webhook) and 'completed' (old webhook) statuses
        const ordersSnapshot = await db.collection('masiv_orders')
            .where('affiliateId', '==', affiliateId)
            .where('status', 'in', ['paid', 'completed'])
            .get();

        const customerSales: { [phone: string]: any } = {};

        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const customerPhone = order.whatsappNumber;

            if (!customerSales[customerPhone]) {
                customerSales[customerPhone] = {
                    customerPhone,
                    totalPurchases: 0,
                    totalAmountPaid: 0,
                    totalCommissionEarned: 0,
                    orderIds: [], // Collect order IDs to append
                    firstPurchaseDate: order.paidAt,
                    lastPurchaseDate: order.paidAt,
                };
            }

            customerSales[customerPhone].totalPurchases++;
            customerSales[customerPhone].totalAmountPaid += order.finalAmount || 0;
            customerSales[customerPhone].totalCommissionEarned += order.affiliateCommission || 0;
            customerSales[customerPhone].orderIds.push(doc.id);
            customerSales[customerPhone].lastPurchaseDate = order.paidAt;
            customerSales[customerPhone].lastOrderId = doc.id;
            customerSales[customerPhone].lastAmountPaid = order.finalAmount || 0;
            customerSales[customerPhone].lastCommission = order.affiliateCommission || 0;
        });

        // Write sales_masiv subcollection - use transactions to properly merge
        const masivPromises = Object.keys(customerSales).map(async (customerPhone) => {
            const saleData = customerSales[customerPhone];
            const saleRef = affiliateRef.collection('sales_masiv').doc(customerPhone);
            
            await db.runTransaction(async (t) => {
                // Always overwrite with values derived from masiv_orders to prevent double-counting
                    t.set(saleRef, {
                        customerPhone,
                        totalPurchases: saleData.totalPurchases,
                        totalAmountPaid: saleData.totalAmountPaid,
                        totalCommissionEarned: saleData.totalCommissionEarned,
                        orders: saleData.orderIds,
                        firstPurchaseDate: saleData.firstPurchaseDate,
                        lastPurchaseDate: saleData.lastPurchaseDate,
                        lastOrderId: saleData.lastOrderId,
                        lastAmountPaid: saleData.lastAmountPaid,
                        lastCommission: saleData.lastCommission,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
            });
        });
        await Promise.all(masivPromises);

        // ========== 2. SYNC SUBSCRIPTION SALES ==========
        const subsSnapshot = await affiliateRef.collection('sales_subscriptions').get();

        let subSales = 0;
        let subEarnings = 0; // in Rupees (converted from paise)

        const subPromises = subsSnapshot.docs.map(async (saleDoc) => {
            const sale = saleDoc.data();
            subSales++;
            const commissionInRupees = Math.round((sale.commissionEarned || 0) / 100);
            subEarnings += commissionInRupees;

            await saleDoc.ref.set({
                commissionEarnedRupees: commissionInRupees,
                planAmountRupees: Math.round((sale.planAmount || 0) / 100),
                discountGivenRupees: Math.round((sale.discountGiven || 0) / 100),
            }, { merge: true });
        });
        await Promise.all(subPromises);

        // ========== 3. RE-READ sales_masiv TO COMPUTE MASIV TOTALS ==========
        // Read from the subcollection (source of truth) rather than the masiv_orders query count.
        // This prevents the sync from wiping valid webhook-written data when the masiv_orders
        // query returns 0 (e.g. order has null affiliateId or is still 'pending').
        const masivSalesSnapshot = await affiliateRef.collection('sales_masiv').get();
        let masivSales = 0;
        let masivEarnings = 0;
        masivSalesSnapshot.forEach(doc => {
            const data = doc.data();
            masivSales += data.totalPurchases || 0;
            masivEarnings += data.totalCommissionEarned || 0;
        });

        // ========== 4. UPDATE AFFILIATE TOTALS (all in Rupees) ==========
        const totalSales = masivSales + subSales;
        const totalEarnings = masivEarnings + subEarnings;

        await affiliateRef.update({
            totalSales,
            totalEarnings,
            masivSales,
            masivEarnings,
            subscriptionSales: subSales,
            subscriptionEarnings: subEarnings,
            updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`✅ Synced affiliate stats: ${affiliateId} - MASIV: ${masivSales} sales ₹${masivEarnings}, Subs: ${subSales} sales ₹${subEarnings}, Total: ₹${totalEarnings}`);

        return NextResponse.json({
            success: true,
            affiliateId,
            totalSales,
            totalEarnings,
            masivSales,
            subscriptionSales: subSales,
            totalCustomers: masivSalesSnapshot.size,
            message: `MASIV: ${masivSales} sales (₹${masivEarnings}) + Subscriptions: ${subSales} sales (₹${subEarnings}) = Total: ₹${totalEarnings}`,
        });

    } catch (error: any) {
        console.error('Sync affiliate stats error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
