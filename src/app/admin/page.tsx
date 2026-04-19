'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { collection, query, orderBy, onSnapshot, limit, Timestamp, getDocs, where } from 'firebase/firestore';
import type { UserWithStats, AdminAction, CreditOperation, UserStats } from '@/types/admin';
import UserTable from '@/components/admin/UserTable';
import CreditEditModal from '@/components/admin/CreditEditModal';
import DeleteUserModal from '@/components/admin/DeleteUserModal';
import AuditLogPanel from '@/components/admin/AuditLogPanel';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { RefreshCw, Users, Activity } from 'lucide-react';
import AdminGuard from '@/components/admin/AdminGuard';

function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<UserWithStats[]>([]);
    const [auditLogs, setAuditLogs] = useState<AdminAction[]>([]);
    const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // Check authentication and admin status
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const token = await user.getIdToken();
                setAuthToken(token);
            }
        });
        return () => unsubscribe();
    }, []);

    // Real-time Users - combine razorpaySubscriptions + users collections
    useEffect(() => {
        if (loading) return;

        const q = query(collection(db, 'razorpaySubscriptions'), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const subscriptionsMap = new Map<string, UserWithStats>();
            
            // First pass: collect all subscription data
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const userId = data.userId;
                
                if (!userId) return;
                
                // If user already exists, keep the most recent subscription
                if (subscriptionsMap.has(userId)) {
                    const existing = subscriptionsMap.get(userId)!;
                    const existingDate = existing.createdAt?.getTime() || 0;
                    const currentDate = data.createdAt?.toDate()?.getTime() || 0;
                    
                    if (currentDate <= existingDate) return;
                }
                
                subscriptionsMap.set(userId, {
                    uid: userId,
                    email: data.email || 'No email',
                    userType: 'single',
                    creditsAllocated: data.initialCredits || data.credits || 0,
                    creditsSpent: data.creditsUsed || 0,
                    creditsRemaining: data.credits || 0,
                    adminCredits: 0,
                    planType: data.planType || 'hobby',
                    subscriptionStatus: data.status || 'active',
                    createdAt: data.createdAt?.toDate() || data.updatedAt?.toDate() || new Date(),
                    lastActivity: data.updatedAt?.toDate(),
                } as UserWithStats);
            });
            
            // Second pass: fetch user profile data from users collection
            const userIds = Array.from(subscriptionsMap.keys());
            
            for (const userId of userIds) {
                try {
                    const userDocRef = collection(db, 'users');
                    const userDoc = await getDocs(query(userDocRef, where('__name__', '==', userId), limit(1)));
                    
                    if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data();
                        const updatedUser = subscriptionsMap.get(userId);
                        if (updatedUser) {
                            updatedUser.email = userData.email || updatedUser.email;
                            updatedUser.displayName = userData.displayName;
                            updatedUser.userType = userData.userType || 'single';
                            updatedUser.proOrganisationId = userData.proOrganisationId;
                            if (userData.createdAt) {
                                updatedUser.createdAt = userData.createdAt.toDate();
                            }
                            subscriptionsMap.set(userId, updatedUser);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to fetch profile for user ${userId}:`, err);
                }
            }

            // Third pass: fetch admin credit adjustments
            for (const userId of userIds) {
                try {
                    const adminCreditsDoc = await getDocs(query(collection(db, 'adminCreditAdjustments'), where('__name__', '==', userId), limit(1)));
                    
                    if (!adminCreditsDoc.empty) {
                        const adminCreditsData = adminCreditsDoc.docs[0].data();
                        const updatedUser = subscriptionsMap.get(userId);
                        if (updatedUser) {
                            updatedUser.adminCredits = adminCreditsData.totalAdjustment || 0;
                            subscriptionsMap.set(userId, updatedUser);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to fetch admin credits for user ${userId}:`, err);
                }
            }

            // Fourth pass: fetch LATEST ACTIVE credits from users/{userId}/subscriptions
            // using updatedAt || createdAt fallback in code for robustness
            for (const userId of userIds) {
                try {
                    const userSubsRef = collection(db, 'users', userId, 'subscriptions');
                    const latestSubSnap = await getDocs(userSubsRef);
                    
                    if (!latestSubSnap.empty) {
                        const latestActiveSub = latestSubSnap.docs
                            .filter((subDoc) => (subDoc.data().status || '') === 'active')
                            .sort((a, b) => {
                                const aData = a.data();
                                const bData = b.data();
                                const aMillis = aData.updatedAt?.toMillis?.() ?? aData.createdAt?.toMillis?.() ?? 0;
                                const bMillis = bData.updatedAt?.toMillis?.() ?? bData.createdAt?.toMillis?.() ?? 0;
                                return bMillis - aMillis;
                            })[0];

                        if (latestActiveSub) {
                            const latestSubData = latestActiveSub.data();
                            const updatedUser = subscriptionsMap.get(userId);
                            if (updatedUser) {
                                // Override with latest credits from subcollection
                                updatedUser.creditsRemaining = latestSubData.credits || 0;
                                updatedUser.creditsSpent = latestSubData.creditsUsed || 0;
                                updatedUser.creditsAllocated = latestSubData.initialCredits || latestSubData.credits || 0;
                                subscriptionsMap.set(userId, updatedUser);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Failed to fetch latest subscription for user ${userId}:`, err);
                }
            }
            
            setUsers(Array.from(subscriptionsMap.values()));
        }, (err) => {
            console.error('Firestore Subscriptions Error:', err);
            setError('Failed to load subscription data.');
        });

        return () => unsubscribe();
    }, [loading]);

    // Real-time Audit Logs from adminAuditLogs collection
    useEffect(() => {
        if (loading) return;

        const q = query(
            collection(db, 'adminAuditLogs'), 
            orderBy('timestamp', 'desc'),
            limit(50)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const logsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AdminAction[];
            setAuditLogs(logsData);
        }, (err) => {
            console.error('Firestore Logs Error:', err);
        });

        return () => unsubscribe();
    }, [loading]);

    const handleRefresh = async () => {
        // Since it's real-time, refresh is just a visual feedback or re-sync if needed
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    const handleEditCredits = (user: UserWithStats) => {
        setSelectedUser(user);
        setShowCreditModal(true);
    };

    const handleDeleteUser = (user: UserWithStats) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
    };

    const handleSaveCredits = async (operation: CreditOperation, amount: number, reason: string) => {
        if (!authToken || !selectedUser) return;

        try {
            const response = await fetch('/api/admin/update-credits', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: selectedUser.uid,
                    operation,
                    amount,
                    reason,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update credits');
            }

            // Refresh data
            await handleRefresh();
        } catch (err: any) {
            throw err;
        }
    };

    const handleConfirmDelete = async () => {
        if (!authToken || !selectedUser) return;

        try {
            const response = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: selectedUser.uid,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete user');
            }

            // Refresh data
            await handleRefresh();
        } catch (err: any) {
            throw err;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white/40">Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    if (error && !users.length) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
                    <Activity className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
                    <p className="text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    const totalCreditsAllocated = users.reduce((sum, u) => sum + u.creditsAllocated, 0);
    const totalCreditsRemaining = users.reduce((sum, u) => sum + u.creditsRemaining, 0);
    const activeSubscriptions = users.filter(u => u.subscriptionStatus === 'active').length;

    return (
        <div className="flex min-h-screen bg-[#0A0A0A] text-white">
            {/* Sidebar */}
            <AdminSidebar />

            {/* Main Content */}
            <div className="flex-1">
                {/* Header */}
                <div className="border-b border-white/5 bg-[#111]">
                    <div className="px-8 py-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-black uppercase tracking-tight">User Management</h1>
                                <p className="text-sm text-white/40 mt-1">Monitor users, credits, and subscriptions</p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="px-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="w-5 h-5 text-blue-400" />
                                <span className="text-sm text-white/60 uppercase tracking-wider font-bold">Total Users</span>
                            </div>
                            <div className="text-3xl font-black">{users.length}</div>
                            <div className="text-xs text-white/40 mt-1">
                                {activeSubscriptions} active subscriptions
                            </div>
                        </div>

                        <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Activity className="w-5 h-5 text-green-400" />
                                <span className="text-sm text-white/60 uppercase tracking-wider font-bold">Credits Allocated</span>
                            </div>
                            <div className="text-3xl font-black">{totalCreditsAllocated.toLocaleString()}</div>
                        </div>

                        <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <Activity className="w-5 h-5 text-yellow-400" />
                                <span className="text-sm text-white/60 uppercase tracking-wider font-bold">Credits Remaining</span>
                            </div>
                            <div className="text-3xl font-black">{totalCreditsRemaining.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Users Table */}
                        <div className="lg:col-span-2">
                            <div className="bg-[#111] border border-white/5 rounded-xl p-6">
                                <h2 className="text-lg font-black uppercase tracking-wider mb-6">All Users</h2>
                                <UserTable
                                    users={users}
                                    onEditCredits={handleEditCredits}
                                    onDeleteUser={handleDeleteUser}
                                />
                            </div>
                        </div>

                        {/* Audit Logs */}
                        <div className="lg:col-span-1">
                            <div className="bg-[#111] border border-white/5 rounded-xl p-6 sticky top-6">
                                <h2 className="text-lg font-black uppercase tracking-wider mb-6">Recent Activity</h2>
                                <div className="max-h-[600px] overflow-y-auto pr-2">
                                    <AuditLogPanel logs={auditLogs} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showCreditModal && selectedUser && (
                <CreditEditModal
                    user={selectedUser}
                    onClose={() => {
                        setShowCreditModal(false);
                        setSelectedUser(null);
                    }}
                    onSave={handleSaveCredits}
                />
            )}

            {showDeleteModal && selectedUser && (
                <DeleteUserModal
                    user={selectedUser}
                    onClose={() => {
                        setShowDeleteModal(false);
                        setSelectedUser(null);
                    }}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </div>
    );
}export default function AdminDashboardPage() {
    return (
        <AdminGuard>
            <AdminDashboard />
        </AdminGuard>
    );
}
