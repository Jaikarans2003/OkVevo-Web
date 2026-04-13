export interface Coupon {
    id: string;
    code: string;
    type: 'affiliate' | 'flat';
    discountAmount: number;
    discountType: 'percentage' | 'fixed';
    affiliateId?: string;
    isActive: boolean;
    minOrderValue: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CouponUsage {
    id: string;
    userId: string;
    phoneNumber: string;
    couponCode: string;
    orderId: string;
    discountApplied: number;
    usedAt: Date;
}

export interface UserPurchaseHistory {
    phoneNumber: string;
    purchaseCount: number;
    orders: string[];
    lastPurchaseDate: Date;
    createdAt: Date;
}

export interface CouponValidationRequest {
    couponCode: string;
    phoneNumber: string;
    totalAmount: number;
}

export interface CouponValidationResponse {
    valid: boolean;
    discountAmount: number;
    type: 'affiliate' | 'flat' | null;
    affiliateId?: string;
    message: string;
    finalAmount?: number;
}
