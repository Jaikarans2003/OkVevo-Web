import { Timestamp } from 'firebase/firestore';

/**
 * User with aggregated statistics for admin dashboard
 */
export interface UserWithStats {
    uid: string;
    email: string;
    displayName?: string;
    userType: 'single' | 'organisation' | 'pro';
    planType?: 'hobby' | 'pro';
    creditsAllocated: number;
    creditsSpent: number;
    creditsRemaining: number;
    adminCredits: number;
    lastActivity?: Date;
    createdAt: Date;
    subscriptionStatus?: 'active' | 'cancelled' | 'paused' | 'completed' | 'pending';
    proOrganisationId?: string;
}

/**
 * Aggregated user statistics stored in userStats collection
 * This is updated via Cloud Functions on subscription/credit changes
 */
export interface UserStats {
    uid: string;
    email: string;
    creditsAllocated: number;
    creditsSpent: number;
    creditsRemaining: number;
    planType?: 'hobby' | 'pro';
    subscriptionStatus?: 'active' | 'cancelled' | 'paused' | 'completed' | 'pending';
    lastActivity?: Timestamp;
    updatedAt: Timestamp;
}

/**
 * Admin action types
 */
export type AdminActionType = 
    | 'delete_user' 
    | 'update_credits' 
    | 'view_users'
    | 'view_audit_logs';

/**
 * Admin action audit log
 */
export interface AdminAction {
    id: string;
    adminEmail: string;
    action: AdminActionType;
    targetUserId?: string;
    targetUserEmail?: string;
    details: {
        [key: string]: any;
    };
    timestamp: Timestamp;
    ipAddress?: string;
}

/**
 * Credit update operation types
 */
export type CreditOperation = 'add' | 'deduct' | 'set';

/**
 * Credit update request
 */
export interface CreditUpdateRequest {
    userId: string;
    operation: CreditOperation;
    amount: number;
    reason: string;
}

/**
 * Admin authentication result
 */
export interface AdminAuthResult {
    isAdmin: boolean;
    email?: string;
    error?: string;
}
