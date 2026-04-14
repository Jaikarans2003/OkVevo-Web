'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import type { Affiliate } from '@/types/affiliate';
import AffiliateTable from '@/components/admin/AffiliateTable';
import AdminGuard from '@/components/admin/AdminGuard';
import { Users, Plus, Gift, ArrowLeft, Copy, Check } from 'lucide-react';
import Link from 'next/link';

function AffiliatesPage() {
    const router = useRouter();
    const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
    const [loading, setLoading] = useState(true);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAffiliate, setNewAffiliate] = useState({ name: '', phoneNumber: '', email: '' });
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');
    const [flatCoupon, setFlatCoupon] = useState<{ code: string; isActive: boolean } | null>(null);
    const [copiedCode, setCopiedCode] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const token = await user.getIdToken();
                setAuthToken(token);
            }
        });
        return () => unsubscribe();
    }, []);

    // Load affiliates
    useEffect(() => {
        const q = query(collection(db, 'affiliates'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const affiliatesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate() || new Date(),
                updatedAt: doc.data().updatedAt?.toDate() || new Date(),
            })) as Affiliate[];
            setAffiliates(affiliatesData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Load flat coupon
    useEffect(() => {
        const loadFlatCoupon = async () => {
            const q = query(collection(db, 'coupons'), where('type', '==', 'flat'));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                setFlatCoupon({
                    code: doc.data().code,
                    isActive: doc.data().isActive,
                });
            }
        };
        loadFlatCoupon();
    }, []);

    const handleAddAffiliate = async () => {
        if (!newAffiliate.name || !newAffiliate.email) {
            setError('Please fill in all fields');
            return;
        }

        if (!authToken) {
            setError('Not authenticated');
            return;
        }

        setAdding(true);
        setError('');

        try {
            const response = await fetch('/api/affiliates/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newAffiliate),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create affiliate');
            }

            setShowAddModal(false);
            setNewAffiliate({ name: '', phoneNumber: '', email: '' });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setAdding(false);
        }
    };

    const handleToggleStatus = async (affiliateId: string, newStatus: 'active' | 'inactive') => {
        try {
            const affiliateRef = doc(db, 'affiliates', affiliateId);
            await updateDoc(affiliateRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });

            // Also update the corresponding coupon
            const affiliate = affiliates.find(a => a.id === affiliateId);
            if (affiliate) {
                const couponsQuery = query(
                    collection(db, 'coupons'),
                    where('code', '==', affiliate.couponCode)
                );
                const couponsSnapshot = await getDocs(couponsQuery);
                couponsSnapshot.forEach(async (couponDoc) => {
                    await updateDoc(doc(db, 'coupons', couponDoc.id), {
                        isActive: newStatus === 'active',
                        updatedAt: serverTimestamp(),
                    });
                });
            }
        } catch (err) {
            console.error('Error toggling status:', err);
        }
    };

    const handleSyncStats = async (affiliateId: string) => {
        if (!authToken) return;

        try {
            const response = await fetch('/api/admin/sync-affiliate-stats', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ affiliateId }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to sync stats');
            }

            const data = await response.json();
            alert(`✅ Stats synced!\n\nMASIV: ${data.masivSales || 0} sales\nSubscriptions: ${data.subscriptionSales || 0} sales\nTotal Sales: ${data.totalSales}\nTotal Earnings: ₹${data.totalEarnings}`);
        } catch (err: any) {
            console.error('Error syncing stats:', err);
            alert(`❌ Error: ${err.message}`);
        }
    };

    const handleMigratePurchaseHistory = async () => {
        if (!authToken) return;

        const confirmed = confirm(
            'This will migrate purchase history from all existing paid orders.\n\n' +
            'This is a one-time operation. Continue?'
        );

        if (!confirmed) return;

        try {
            const response = await fetch('/api/admin/migrate-purchase-history', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to migrate');
            }

            const data = await response.json();
            alert(
                `✅ Migration Complete!\n\n` +
                `Total Orders: ${data.totalOrders}\n` +
                `Total Users: ${data.totalUsers}\n` +
                `Created: ${data.created}\n` +
                `Updated: ${data.updated}\n` +
                `Errors: ${data.errors}`
            );
        } catch (err: any) {
            console.error('Error migrating:', err);
            alert(`❌ Error: ${err.message}`);
        }
    };

    const handleSyncAllAffiliates = async () => {
        if (!authToken) return;

        const confirmed = confirm(
            'This will sync stats for ALL affiliates.\n' +
            'Syncs both MASIV orders and Subscription sales.\n\n' +
            'Continue?'
        );

        if (!confirmed) return;

        try {
            const response = await fetch('/api/admin/sync-all-affiliates', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to sync');
            }

            const data = await response.json();
            const details = (data.results || []).filter((r: any) => r.success).map((r: any) =>
                `${r.affiliateId}: ${r.masivSales || 0} MASIV + ${r.subscriptionSales || 0} subs = ₹${r.totalEarnings}`
            ).join('\n');
            alert(
                `✅ Sync Complete!\n\n` +
                `Total Affiliates: ${data.totalAffiliates}\n` +
                `Success: ${data.successCount}\n` +
                `Errors: ${data.errorCount}\n\n` +
                `${details}`
            );
        } catch (err: any) {
            console.error('Error syncing:', err);
            alert(`❌ Error: ${err.message}`);
        }
    };

    const handleGenerateFlatCoupon = async () => {
        if (!authToken) return;

        try {
            const response = await fetch('/api/coupons/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: 'OKVEVO100',
                    type: 'flat',
                    discountAmount: 100,
                    discountType: 'fixed',
                    minOrderValue: 199,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create coupon');
            }

            const data = await response.json();
            setFlatCoupon({ code: data.code, isActive: true });
        } catch (err: any) {
            console.error('Error creating flat coupon:', err);
            alert(err.message);
        }
    };

    const handleCopyFlatCode = () => {
        if (flatCoupon) {
            navigator.clipboard.writeText(flatCoupon.code);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    const totalSales = affiliates.reduce((sum, a) => sum + a.totalSales, 0);
    const totalEarnings = affiliates.reduce((sum, a) => sum + a.totalEarnings, 0);
    const activeAffiliates = affiliates.filter(a => a.status === 'active').length;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141413] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading affiliates...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#141413] text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-[#1a1a1a]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/admin"
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-3">
                                <Users className="w-8 h-8 text-[#FF6B35]" />
                                <div>
                                    <h1 className="text-2xl font-bold">Affiliate Partners</h1>
                                    <p className="text-sm text-gray-400">Manage affiliate codes and commissions</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-[#FF6B35] hover:bg-[#FF8F6B] rounded-xl transition-colors font-bold"
                        >
                            <Plus className="w-5 h-5" />
                            Add Affiliate
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="w-5 h-5 text-[#FF6B35]" />
                            <span className="text-white/60 text-sm font-bold uppercase tracking-wider">Active Affiliates</span>
                        </div>
                        <p className="text-4xl font-black">{activeAffiliates}</p>
                    </div>
                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Gift className="w-5 h-5 text-blue-500" />
                            <span className="text-white/60 text-sm font-bold uppercase tracking-wider">Total Sales</span>
                        </div>
                        <p className="text-4xl font-black">{totalSales}</p>
                    </div>
                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">💰</span>
                            <span className="text-white/60 text-sm font-bold uppercase tracking-wider">Total Earnings</span>
                        </div>
                        <p className="text-4xl font-black text-green-500">₹{totalEarnings}</p>
                    </div>
                </div>

                {/* Admin Tools Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Flat Coupon */}
                    <div className="bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20 rounded-2xl p-6">
                        <div>
                            <h3 className="text-xl font-black mb-2">Flat ₹100 Off Coupon</h3>
                            <p className="text-white/60 text-sm mb-4">
                                Valid for 2nd or 3rd purchase only • Minimum order: ₹199
                            </p>
                            {flatCoupon ? (
                                <div className="flex items-center gap-3">
                                    <code className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-500 font-mono text-lg font-bold">
                                        {flatCoupon.code}
                                    </code>
                                    <button
                                        onClick={handleCopyFlatCode}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        {copiedCode ? (
                                            <Check className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <Copy className="w-5 h-5 text-white/60" />
                                        )}
                                    </button>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        flatCoupon.isActive
                                            ? 'bg-green-500/20 text-green-500'
                                            : 'bg-red-500/20 text-red-500'
                                    }`}>
                                        {flatCoupon.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            ) : (
                                <button
                                    onClick={handleGenerateFlatCoupon}
                                    className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition-colors"
                                >
                                    Generate Flat Coupon
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Sync All Affiliates */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 rounded-2xl p-6">
                        <div>
                            <h3 className="text-xl font-black mb-2">Sync All Affiliates</h3>
                            <p className="text-white/60 text-sm mb-4">
                                Sync MASIV orders + Subscription sales for all affiliates
                            </p>
                            <button
                                onClick={handleSyncAllAffiliates}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold transition-colors"
                            >
                                Sync All Affiliates
                            </button>
                        </div>
                    </div>

                    {/* Migration Tool */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 rounded-2xl p-6">
                        <div>
                            <h3 className="text-xl font-black mb-2">Purchase History Migration</h3>
                            <p className="text-white/60 text-sm mb-4">
                                One-time migration to populate purchase history from existing orders
                            </p>
                            <button
                                onClick={handleMigratePurchaseHistory}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-colors"
                            >
                                Migrate Purchase History
                            </button>
                        </div>
                    </div>
                </div>

                {/* Affiliates Table */}
                <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-black mb-6">All Affiliates</h2>
                    <AffiliateTable
                        affiliates={affiliates}
                        onToggleStatus={handleToggleStatus}
                    />
                </div>
            </div>

            {/* Add Affiliate Modal */}
            {showAddModal && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                    onClick={() => setShowAddModal(false)}
                >
                    <div
                        className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-black mb-6">Add New Affiliate</h2>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-white/70 mb-2">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={newAffiliate.name}
                                    onChange={(e) => setNewAffiliate({ ...newAffiliate, name: e.target.value })}
                                    placeholder="John Doe"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-white/70 mb-2">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={newAffiliate.phoneNumber}
                                    onChange={(e) => setNewAffiliate({ ...newAffiliate, phoneNumber: e.target.value })}
                                    placeholder="8618966497"
                                    maxLength={10}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-white/70 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={newAffiliate.email}
                                    onChange={(e) => setNewAffiliate({ ...newAffiliate, email: e.target.value })}
                                    placeholder="john@example.com"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                />
                            </div>
                            {error && (
                                <p className="text-red-400 text-sm">{error}</p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAffiliate}
                                disabled={adding}
                                className="flex-1 px-6 py-3 bg-[#FF6B35] hover:bg-[#FF8F6B] disabled:bg-white/10 disabled:text-white/30 rounded-xl font-bold transition-colors"
                            >
                                {adding ? 'Adding...' : 'Add Affiliate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AffiliatesPageWithGuard() {
    return (
        <AdminGuard>
            <AffiliatesPage />
        </AdminGuard>
    );
}
