'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, DollarSign, Calendar, Copy, Check, ShoppingBag } from 'lucide-react';
import type { AffiliateStats } from '@/types/affiliate';

export default function AffiliateDashboard() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<AffiliateStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copiedCode, setCopiedCode] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.email) return;

            try {
                const response = await fetch(`/api/affiliates/stats?email=${encodeURIComponent(user.email)}`);
                
                if (response.status === 404) {
                    setError('You are not registered as an affiliate partner.');
                    setLoading(false);
                    return;
                }

                if (!response.ok) {
                    throw new Error('Failed to fetch affiliate stats');
                }

                const data = await response.json();
                setStats(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user?.email) {
            fetchStats();
        }
    }, [user]);

    const handleCopyCode = () => {
        if (stats?.couponCode) {
            navigator.clipboard.writeText(stats.couponCode);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-[#141413] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#141413] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-red-400 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <div className="min-h-screen bg-[#141413] text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-[#1a1a1a]">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Affiliate Dashboard</h1>
                            <p className="text-gray-400 mt-1">Track your performance and earnings</p>
                        </div>
                        <button
                            onClick={() => router.push('/')}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Coupon Code Card */}
                <div className="bg-gradient-to-r from-[#FF6B35]/20 to-transparent border border-[#FF6B35]/30 rounded-2xl p-8 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-2">Your Affiliate Code</h2>
                            <div className="flex items-center gap-4">
                                <code className="text-4xl font-black font-mono text-[#FF6B35]">
                                    {stats.couponCode}
                                </code>
                                <button
                                    onClick={handleCopyCode}
                                    className="p-3 bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20 rounded-xl transition-colors"
                                    title="Copy code"
                                >
                                    {copiedCode ? (
                                        <Check className="w-6 h-6 text-green-500" />
                                    ) : (
                                        <Copy className="w-6 h-6 text-[#FF6B35]" />
                                    )}
                                </button>
                            </div>
                            <p className="text-white/60 text-sm mt-3">
                                Share this code with your audience to earn 10% commission on every sale
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                <ShoppingBag className="w-6 h-6 text-blue-500" />
                            </div>
                            <span className="text-white/60 text-sm font-bold uppercase tracking-wider">Total Sales</span>
                        </div>
                        <p className="text-5xl font-black">{stats.totalSales}</p>
                        <p className="text-white/40 text-xs mt-2">Orders using your code</p>
                    </div>

                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-green-500" />
                            </div>
                            <span className="text-white/60 text-sm font-bold uppercase tracking-wider">Total Earnings</span>
                        </div>
                        <p className="text-5xl font-black text-green-500">₹{stats.totalEarnings.toFixed(2)}</p>
                        <p className="text-white/40 text-xs mt-2">Commission earned</p>
                    </div>

                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-purple-500" />
                            </div>
                            <span className="text-white/60 text-sm font-bold uppercase tracking-wider">Partner Since</span>
                        </div>
                        <p className="text-2xl font-black">{formatDate(stats.partnershipStartDate)}</p>
                        <p className="text-white/40 text-xs mt-2">Affiliate partnership</p>
                    </div>
                </div>

                {/* Monthly Performance */}
                {stats.monthlySales.length > 0 && (
                    <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 mb-8">
                        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-[#FF6B35]" />
                            Monthly Performance
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {stats.monthlySales.slice(0, 6).map((month) => (
                                <div key={month.month} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                    <p className="text-white/60 text-sm font-bold mb-2">
                                        {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                    </p>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-2xl font-black">{month.sales}</span>
                                        <span className="text-white/40 text-sm">sales</span>
                                    </div>
                                    <p className="text-green-500 font-bold mt-1">₹{month.earnings.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sales History */}
                <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-black mb-6">Recent Sales</h2>
                    {stats.salesHistory.length === 0 ? (
                        <div className="text-center py-12 text-white/30">
                            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p className="font-bold">No sales yet</p>
                            <p className="text-sm mt-2">Start sharing your affiliate code to earn commissions!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-white/40">Date</th>
                                        <th className="text-left py-3 px-4 text-xs font-black uppercase tracking-widest text-white/40">Customer</th>
                                        <th className="text-right py-3 px-4 text-xs font-black uppercase tracking-widest text-white/40">Order Amount</th>
                                        <th className="text-right py-3 px-4 text-xs font-black uppercase tracking-widest text-white/40">Your Commission</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.salesHistory.map((sale) => (
                                        <tr key={sale.orderId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="py-4 px-4">
                                                <span className="text-white/80 text-sm">
                                                    {new Date(sale.orderDate).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div>
                                                    <p className="font-bold text-white">{sale.customerName}</p>
                                                    <p className="text-white/40 text-xs">{sale.customerPhone}</p>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <span className="font-bold text-white">₹{sale.orderAmount}</span>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <span className="font-bold text-green-500">₹{sale.commissionEarned.toFixed(2)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
