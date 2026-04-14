export interface Affiliate {
    id: string;
    phoneNumber?: string;
    name: string;
    email: string;
    couponCode: string;
    totalSales: number;
    totalEarnings: number;
    commissionRate: number;
    status: 'active' | 'inactive';
    createdAt: Date;
    updatedAt: Date;
}

export interface AffiliateSale {
    orderId: string;
    orderDate: Date;
    orderAmount: number;
    commissionEarned: number;
    customerName: string;
    customerPhone: string;
}

export interface AffiliateStats {
    totalSales: number;
    totalEarnings: number;
    salesHistory: AffiliateSale[];
    partnershipStartDate: Date;
    couponCode: string;
    monthlySales: {
        month: string;
        sales: number;
        earnings: number;
    }[];
}

export interface AffiliateCommission {
    id: string;
    affiliateId: string;
    subscriptionId: string;
    paymentId: string;
    paymentAmount: number;
    commissionAmount: number;
    commissionRate: number;
    billingPeriod: 'monthly' | 'annual';
    couponCode: string;
    userId: string;
    paidAt: Date;
    createdAt: Date;
}
