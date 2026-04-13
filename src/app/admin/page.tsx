'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { collection, query, orderBy, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import type { UserWithStats, AdminAction, CreditOperation, UserStats } from '@/types/admin';
import UserTable from '@/components/admin/UserTable';
import CreditEditModal from '@/components/admin/CreditEditModal';
import DeleteUserModal from '@/components/admin/DeleteUserModal';
import AuditLogPanel from '@/components/admin/AuditLogPanel';
import { RefreshCw, Users, Activity, Shield, Sparkles, ArrowRight, LayoutGrid, Image as ImageIcon, FileText } from 'lucide-react';
import Link from 'next/link';
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

    // Real-time Users from razorpaySubscriptions collection
    useEffect(() => {
        if (loading) return;

        const q = query(collection(db, 'razorpaySubscriptions'), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const subscriptionsMap = new Map<string, UserWithStats>();
            
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
                    creditsAllocated: data.initialCredits || data.credits || 0,
                    creditsSpent: data.creditsUsed || 0,
                    creditsRemaining: data.credits || 0,
                    planType: data.planType || 'hobby',
                    subscriptionStatus: data.status || 'active',
                    createdAt: data.createdAt?.toDate() || data.updatedAt?.toDate() || new Date(),
                    lastActivity: data.updatedAt?.toDate(),
                } as UserWithStats);
            });
            
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
            <div className="min-h-screen bg-[#141413] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    if (error && !users.length) {
        return (
            <div className="min-h-screen bg-[#141413] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
                    <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                    <p className="text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    const totalCreditsAllocated = users.reduce((sum, u) => sum + u.creditsAllocated, 0);
    const totalCreditsSpent = users.reduce((sum, u) => sum + u.creditsSpent, 0);
    const totalCreditsRemaining = users.reduce((sum, u) => sum + u.creditsRemaining, 0);
    const activeSubscriptions = users.filter(u => u.subscriptionStatus === 'active').length;

    return (
        <div className="min-h-screen bg-[#141413] text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-[#1a1a1a]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield className="w-8 h-8 text-blue-400" />
                            <div>
                                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                                <p className="text-sm text-gray-400">User Management & Analytics</p>
                            </div>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Quick Access Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    {/* Trend Requests Quick Access */}
                    <div className="p-1 bg-gradient-to-r from-[#FF6B35]/20 to-transparent rounded-[24px]">
                        <div className="bg-[#1a1a1a] border border-white/5 rounded-[22px] p-6 flex flex-col items-start justify-between h-full gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-[#FF6B35]/10 flex items-center justify-center border border-[#FF6B35]/20">
                                    <Sparkles className="w-7 h-7 text-[#FF6B35]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tighter uppercase">Trend Requests</h2>
                                    <p className="text-gray-400 text-sm">Manage manual AI generation and student outputs.</p>
                                </div>
                            </div>
                            <Link 
                                href="/admin/trend-requests"
                                className="w-full px-8 py-4 bg-[#FF6B35] hover:bg-[#FF8B55] text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-2 group"
                            >
                                Open Queue <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>

                    {/* Banner Management Quick Access */}
                    <div className="p-1 bg-gradient-to-r from-orange-500/20 to-transparent rounded-[24px]">
                        <div className="bg-[#1a1a1a] border border-white/5 rounded-[22px] p-6 flex flex-col items-start justify-between h-full gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                    <ImageIcon className="w-7 h-7 text-orange-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tighter uppercase">Banners</h2>
                                    <p className="text-gray-400 text-sm">Manage hero carousel ads, titles, and descriptions.</p>
                                </div>
                            </div>
                            <Link 
                                href="/admin/banners"
                                className="w-full px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-2 group"
                            >
                                Manage Banners <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>

                    {/* Product Catalog Quick Access */}
                    <div className="p-1 bg-gradient-to-r from-blue-500/20 to-transparent rounded-[24px]">
                        <div className="bg-[#1a1a1a] border border-white/5 rounded-[22px] p-6 flex flex-col items-start justify-between h-full gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                    <LayoutGrid className="w-7 h-7 text-blue-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tighter uppercase">Products</h2>
                                    <p className="text-gray-400 text-sm">Update trends, change prices, and upload thumbnails.</p>
                                </div>
                            </div>
                            <Link 
                                href="/admin/products"
                                className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-2 group"
                            >
                                Manage Catalog <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>

                    {/* Affiliate Partners Quick Access */}
                    <div className="p-1 bg-gradient-to-r from-purple-500/20 to-transparent rounded-[24px]">
                        <div className="bg-[#1a1a1a] border border-white/5 rounded-[22px] p-6 flex flex-col items-start justify-between h-full gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                    <Users className="w-7 h-7 text-purple-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tighter uppercase">Affiliates</h2>
                                    <p className="text-gray-400 text-sm">Manage affiliate partners and track commissions.</p>
                                </div>
                            </div>
                            <Link 
                                href="/admin/affiliates"
                                className="w-full px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-2 group"
                            >
                                Manage Affiliates <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>

                    {/* Blog Management Quick Access */}
                    <div className="p-1 bg-gradient-to-r from-green-500/20 to-transparent rounded-[24px]">
                        <div className="bg-[#1a1a1a] border border-white/5 rounded-[22px] p-6 flex flex-col items-start justify-between h-full gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                    <FileText className="w-7 h-7 text-green-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tighter uppercase">Blog</h2>
                                    <p className="text-gray-400 text-sm">Create, edit, and manage blog posts with SEO.</p>
                                </div>
                            </div>
                            <Link 
                                href="/admin/blogs"
                                className="w-full px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-2 group"
                            >
                                Manage Blog <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>


                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="w-5 h-5 text-blue-400" />
                            <span className="text-sm text-gray-400">Total Users</span>
                        </div>
                        <div className="text-3xl font-bold">{users.length}</div>
                        <div className="text-xs text-gray-500 mt-1">
                            {activeSubscriptions} active subscriptions
                        </div>
                    </div>

                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Activity className="w-5 h-5 text-green-400" />
                            <span className="text-sm text-gray-400">Credits Allocated</span>
                        </div>
                        <div className="text-3xl font-bold">{totalCreditsAllocated.toLocaleString()}</div>
                    </div>

                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Activity className="w-5 h-5 text-red-400" />
                            <span className="text-sm text-gray-400">Credits Spent</span>
                        </div>
                        <div className="text-3xl font-bold">{totalCreditsSpent.toLocaleString()}</div>
                    </div>

                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Activity className="w-5 h-5 text-yellow-400" />
                            <span className="text-sm text-gray-400">Credits Remaining</span>
                        </div>
                        <div className="text-3xl font-bold">{totalCreditsRemaining.toLocaleString()}</div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Users Table */}
                    <div className="lg:col-span-2">
                        <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-6">
                            <h2 className="text-xl font-semibold mb-6">All Users</h2>
                            <UserTable
                                users={users}
                                onEditCredits={handleEditCredits}
                                onDeleteUser={handleDeleteUser}
                            />
                        </div>
                    </div>

                    {/* Audit Logs */}
                    <div className="lg:col-span-1">
                        <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-6 sticky top-6">
                            <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>
                            <div className="max-h-[600px] overflow-y-auto pr-2">
                                <AuditLogPanel logs={auditLogs} />
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
