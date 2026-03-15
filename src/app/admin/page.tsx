'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import type { UserWithStats, AdminAction, CreditOperation } from '@/types/admin';
import UserTable from '@/components/admin/UserTable';
import CreditEditModal from '@/components/admin/CreditEditModal';
import DeleteUserModal from '@/components/admin/DeleteUserModal';
import AuditLogPanel from '@/components/admin/AuditLogPanel';
import { RefreshCw, Users, Activity, Shield } from 'lucide-react';

export default function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
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
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                const token = await user.getIdToken();
                setAuthToken(token);
                
                // Fetch initial data
                await Promise.all([
                    fetchUsers(token),
                    fetchAuditLogs(token)
                ]);
            } catch (err: any) {
                console.error('Auth error:', err);
                if (err.message?.includes('Forbidden')) {
                    setError('Access denied. You do not have admin permissions.');
                    setTimeout(() => router.push('/'), 3000);
                } else {
                    setError(err.message || 'Failed to load admin dashboard');
                }
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const fetchUsers = async (token: string) => {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch users');
            }

            const data = await response.json();
            setUsers(data.users || []);
        } catch (err: any) {
            throw err;
        }
    };

    const fetchAuditLogs = async (token: string) => {
        try {
            const response = await fetch('/api/admin/audit-logs?limit=50', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch audit logs');
            }

            const data = await response.json();
            setAuditLogs(data.logs || []);
        } catch (err: any) {
            console.error('Failed to fetch audit logs:', err);
        }
    };

    const handleRefresh = async () => {
        if (!authToken) return;
        
        setRefreshing(true);
        try {
            await Promise.all([
                fetchUsers(authToken),
                fetchAuditLogs(authToken)
            ]);
        } catch (err: any) {
            setError(err.message || 'Failed to refresh data');
        } finally {
            setRefreshing(false);
        }
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
}
