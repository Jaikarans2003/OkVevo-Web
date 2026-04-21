import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdminToken } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * Sync all affiliates stats and create sales sub-collections
 * This is a global sync that processes all affiliates at once
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

        console.log('🔄 Starting global affiliate sync...');

        // Get all affiliates
        const affiliatesSnapshot = await db.collection('affiliates').get();
        
        if (affiliatesSnapshot.empty) {
            return NextResponse.json({
                success: true,
                message: 'No affiliates found',
                totalAffiliates: 0,
            });
        }

        const results = [];

        // Process each affiliate
        for (const affiliateDoc of affiliatesSnapshot.docs) {
            const affiliateId = affiliateDoc.id;
            console.log(`📊 Processing affiliate: ${affiliateId}`);

            try {
                const affiliateRef = db.collection('affiliates').doc(affiliateId);

                // ========== 1. SYNC MASIV ORDERS ==========
                // Query for both 'paid' (new webhook) and 'completed' (old webhook) statuses
                const ordersSnapshot = await db.collection('masiv_orders')
                    .where('affiliateId', '==', affiliateId)
                    .where('status', 'in', ['paid', 'completed'])
                    .get();

                // Group MASIV orders by customer phone number
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
                    
                    await saleRef.set({
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
                await Promise.all(masivPromises);

                // ========== 2. SYNC SUBSCRIPTION SALES ==========
                const subsSnapshot = await affiliateRef.collection('sales_subscriptions').get();

                let subSales = 0;
                let subEarnings = 0; // in Rupees (converted from paise)

                // Re-write each subscription sale doc with consistent Rupee values
                const subPromises = subsSnapshot.docs.map(async (saleDoc) => {
                    const sale = saleDoc.data();
                    subSales++;
                    // commissionEarned from webhook is in paise, convert to Rupees
                    const commissionInRupees = Math.round((sale.commissionEarned || 0) / 100);
                    subEarnings += commissionInRupees;

                    // Update the doc with Rupee values for consistent display
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

                console.log(`✅ Synced ${affiliateId}: ${masivSales} MASIV + ${subSales} subscriptions = ${totalSales} total, ₹${totalEarnings}`);

                results.push({
                    affiliateId,
                    totalSales,
                    totalEarnings,
                    masivSales,
                    subscriptionSales: subSales,
                    totalCustomers: masivSalesSnapshot.size,
                    success: true,
                });

            } catch (error: any) {
                console.error(`❌ Error syncing affiliate ${affiliateId}:`, error.message);
                results.push({
                    affiliateId,
                    success: false,
                    error: error.message,
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;

        console.log(`✅ Global sync complete: ${successCount} success, ${errorCount} errors`);

        return NextResponse.json({
            success: true,
            totalAffiliates: affiliatesSnapshot.size,
            successCount,
            errorCount,
            results,
            message: `Synced ${successCount} affiliates successfully`,
        });

    } catch (error: any) {
        console.error('Global affiliate sync error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
