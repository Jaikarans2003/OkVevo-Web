import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { auth as clientAuth } from '@/config/firebase';
import type { AffiliateStats, AffiliateSale } from '@/types/affiliate';

export async function GET(request: NextRequest) {
    try {
        // Get email from query params
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Find affiliate by email
        const affiliatesRef = collection(db, 'affiliates');
        const affiliateQuery = query(affiliatesRef, where('email', '==', email));
        const affiliateSnapshot = await getDocs(affiliateQuery);

        if (affiliateSnapshot.empty) {
            return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
        }

        const affiliateDoc = affiliateSnapshot.docs[0];
        const affiliate = affiliateDoc.data();
        const affiliateId = affiliateDoc.id;

        // Get sales history from orders
        const ordersRef = collection(db, 'masivOrders');
        const ordersQuery = query(
            ordersRef,
            where('affiliateId', '==', affiliateId),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        const ordersSnapshot = await getDocs(ordersQuery);

        const salesHistory: AffiliateSale[] = ordersSnapshot.docs.map(doc => {
            const order = doc.data();
            return {
                orderId: doc.id,
                orderDate: order.createdAt?.toDate() || new Date(),
                orderAmount: order.totalAmount || 0,
                commissionEarned: order.affiliateCommission || 0,
                customerName: order.customerName || 'N/A',
                customerPhone: order.whatsappNumber || 'N/A',
            };
        });

        // Calculate monthly sales
        const monthlySalesMap = new Map<string, { sales: number; earnings: number }>();
        salesHistory.forEach(sale => {
            const monthKey = sale.orderDate.toISOString().substring(0, 7); // YYYY-MM
            const existing = monthlySalesMap.get(monthKey) || { sales: 0, earnings: 0 };
            monthlySalesMap.set(monthKey, {
                sales: existing.sales + 1,
                earnings: existing.earnings + sale.commissionEarned,
            });
        });

        const monthlySales = Array.from(monthlySalesMap.entries())
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => b.month.localeCompare(a.month));

        const stats: AffiliateStats = {
            totalSales: affiliate.totalSales || 0,
            totalEarnings: affiliate.totalEarnings || 0,
            salesHistory,
            partnershipStartDate: affiliate.createdAt?.toDate() || new Date(),
            couponCode: affiliate.couponCode,
            monthlySales,
        };

        return NextResponse.json(stats);

    } catch (error) {
        console.error('Get affiliate stats error:', error);
        return NextResponse.json({ error: 'Failed to fetch affiliate stats' }, { status: 500 });
    }
}
