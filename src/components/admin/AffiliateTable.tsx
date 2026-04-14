'use client';

import { useState } from 'react';
import { Copy, Check, Ban, CheckCircle } from 'lucide-react';
import type { Affiliate } from '@/types/affiliate';

interface AffiliateTableProps {
    affiliates: Affiliate[];
    onToggleStatus: (affiliateId: string, newStatus: 'active' | 'inactive') => Promise<void>;
}

export default function AffiliateTable({ affiliates, onToggleStatus }: AffiliateTableProps) {
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleToggleStatus = async (affiliateId: string, currentStatus: string) => {
        setTogglingStatus(affiliateId);
        try {
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            await onToggleStatus(affiliateId, newStatus);
        } finally {
            setTogglingStatus(null);
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-white/10">
                        <th className="text-left py-4 px-4 text-xs font-black uppercase tracking-widest text-white/40">Name</th>
                        <th className="text-left py-4 px-4 text-xs font-black uppercase tracking-widest text-white/40">Phone</th>
                        <th className="text-left py-4 px-4 text-xs font-black uppercase tracking-widest text-white/40">Email</th>
                        <th className="text-left py-4 px-4 text-xs font-black uppercase tracking-widest text-white/40">Coupon Code</th>
                        <th className="text-right py-4 px-4 text-xs font-black uppercase tracking-widest text-white/40">Sales</th>
                        <th className="text-right py-4 px-4 text-xs font-black uppercase tracking-widest text-white/40">Earnings</th>
                        <th className="text-center py-4 px-4 text-xs font-black uppercase tracking-widest text-white/40">Status</th>
                        <th className="text-center py-4 px-4 text-xs font-black uppercase tracking-widest text-white/40">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {affiliates.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="text-center py-12 text-white/30">
                                No affiliates found. Add your first affiliate partner!
                            </td>
                        </tr>
                    ) : (
                        affiliates.map((affiliate) => (
                            <tr key={affiliate.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                <td className="py-4 px-4">
                                    <span className="font-bold text-white">{affiliate.name}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className="text-white/60 text-sm font-mono">{affiliate.phoneNumber || affiliate.id}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className="text-white/60 text-sm">{affiliate.email}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <div className="flex items-center gap-2">
                                        <code className="px-3 py-1 bg-[#FF6B35]/10 border border-[#FF6B35]/20 rounded-lg text-[#FF6B35] font-mono text-sm">
                                            {affiliate.couponCode}
                                        </code>
                                        <button
                                            onClick={() => handleCopyCode(affiliate.couponCode)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                            title="Copy code"
                                        >
                                            {copiedCode === affiliate.couponCode ? (
                                                <Check className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-white/40" />
                                            )}
                                        </button>
                                    </div>
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <span className="font-bold text-white">{affiliate.totalSales}</span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                    <span className="font-bold text-green-500">₹{affiliate.totalEarnings}</span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <span
                                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                                            affiliate.status === 'active'
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                        }`}
                                    >
                                        {affiliate.status === 'active' ? (
                                            <>
                                                <CheckCircle className="w-3 h-3" />
                                                Active
                                            </>
                                        ) : (
                                            <>
                                                <Ban className="w-3 h-3" />
                                                Inactive
                                            </>
                                        )}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                    <button
                                        onClick={() => handleToggleStatus(affiliate.id, affiliate.status)}
                                        disabled={togglingStatus === affiliate.id}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                                            affiliate.status === 'active'
                                                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                                                : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20'
                                        } disabled:opacity-50`}
                                    >
                                        {togglingStatus === affiliate.id
                                            ? 'Updating...'
                                            : affiliate.status === 'active'
                                            ? 'Deactivate'
                                            : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
