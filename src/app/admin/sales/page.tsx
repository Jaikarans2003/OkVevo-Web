'use client';

import { useEffect, useState } from 'react';
import { db } from '@/config/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminGuard from '@/components/admin/AdminGuard';
import { ShoppingBag, Mail, Phone, User, Briefcase, MessageSquare, Calendar } from 'lucide-react';

type ContactCategory = 'enterpriseEnquiry' | 'problemTicket' | 'generalQuery';

interface Submission {
    id: string;
    name: string;
    designation: string;
    email: string;
    whatsapp?: string;
    message: string;
    submittedAt: any;
}

const CATEGORIES: { key: ContactCategory; label: string; color: string; bg: string; border: string }[] = [
    {
        key: 'enterpriseEnquiry',
        label: 'Enterprise Enquiry',
        color: 'text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
    },
    {
        key: 'problemTicket',
        label: 'Problem Ticket',
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
    },
    {
        key: 'generalQuery',
        label: 'General Query',
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
    },
];

function formatDate(ts: any): string {
    if (!ts) return '—';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SalesContent() {
    const [activeTab, setActiveTab] = useState<ContactCategory>('enterpriseEnquiry');
    const [submissions, setSubmissions] = useState<Record<ContactCategory, Submission[]>>({
        enterpriseEnquiry: [],
        problemTicket: [],
        generalQuery: [],
    });
    const [loading, setLoading] = useState<Record<ContactCategory, boolean>>({
        enterpriseEnquiry: true,
        problemTicket: true,
        generalQuery: true,
    });

    useEffect(() => {
        const unsubscribers: (() => void)[] = [];

        CATEGORIES.forEach(({ key }) => {
            const q = query(
                collection(db, 'contactSubmissions', key, 'submissions'),
                orderBy('submittedAt', 'desc')
            );
            const unsub = onSnapshot(q, (snap) => {
                const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
                setSubmissions(prev => ({ ...prev, [key]: docs }));
                setLoading(prev => ({ ...prev, [key]: false }));
            });
            unsubscribers.push(unsub);
        });

        return () => unsubscribers.forEach(u => u());
    }, []);

    const activeCat = CATEGORIES.find(c => c.key === activeTab)!;
    const activeData = submissions[activeTab];
    const isLoading = loading[activeTab];

    return (
        <div className="flex h-screen bg-[#060606] text-white overflow-hidden">
            <AdminSidebar />

            <div className="flex-1 overflow-y-auto">
                <div className="p-8 max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-widest text-white">Sales & Enquiries</h1>
                            <p className="text-xs text-white/30 uppercase tracking-widest mt-0.5">Contact form submissions</p>
                        </div>
                    </div>

                    {/* Summary badges */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.key}
                                onClick={() => setActiveTab(cat.key)}
                                className={`rounded-2xl p-5 border transition-all text-left ${
                                    activeTab === cat.key
                                        ? `${cat.bg} ${cat.border}`
                                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
                                }`}
                            >
                                <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 ${activeTab === cat.key ? cat.color : 'text-white/30'}`}>
                                    {cat.label}
                                </p>
                                <p className="text-3xl font-black text-white">
                                    {loading[cat.key] ? '—' : submissions[cat.key].length}
                                </p>
                                <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest">submissions</p>
                            </button>
                        ))}
                    </div>

                    {/* Active Category Header */}
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${activeCat.bg} border ${activeCat.border} mb-6`}>
                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${activeCat.color}`}>{activeCat.label}</span>
                        <span className={`text-xs font-black ${activeCat.color}`}>({activeData.length})</span>
                    </div>

                    {/* Submissions */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : activeData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-white/20">
                            <MessageSquare size={40} className="mb-4" />
                            <p className="text-sm font-black uppercase tracking-widest">No submissions yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeData.map((sub) => (
                                <div
                                    key={sub.id}
                                    className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                                >
                                    {/* Top row */}
                                    <div className="flex flex-wrap items-start gap-6 mb-4">
                                        <div className="flex items-center gap-2 min-w-[160px]">
                                            <User size={14} className="text-white/30 flex-shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-white/30 uppercase tracking-widest">Name</p>
                                                <p className="text-sm font-bold text-white">{sub.name || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 min-w-[160px]">
                                            <Briefcase size={14} className="text-white/30 flex-shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-white/30 uppercase tracking-widest">Designation</p>
                                                <p className="text-sm font-bold text-white">{sub.designation || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 min-w-[200px]">
                                            <Mail size={14} className="text-white/30 flex-shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-white/30 uppercase tracking-widest">Email</p>
                                                <a href={`mailto:${sub.email}`} className="text-sm font-bold text-orange-400 hover:text-orange-300 transition-colors">
                                                    {sub.email}
                                                </a>
                                            </div>
                                        </div>
                                        {sub.whatsapp && (
                                            <div className="flex items-center gap-2">
                                                <Phone size={14} className="text-white/30 flex-shrink-0" />
                                                <div>
                                                    <p className="text-[10px] text-white/30 uppercase tracking-widest">WhatsApp</p>
                                                    <a href={`https://wa.me/${sub.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-green-400 hover:text-green-300 transition-colors">
                                                        {sub.whatsapp}
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 ml-auto">
                                            <Calendar size={14} className="text-white/30 flex-shrink-0" />
                                            <div>
                                                <p className="text-[10px] text-white/30 uppercase tracking-widest">Submitted</p>
                                                <p className="text-xs font-bold text-white/60">{formatDate(sub.submittedAt)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Message */}
                                    <div className="border-t border-white/5 pt-4">
                                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <MessageSquare size={12} /> Message
                                        </p>
                                        <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{sub.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SalesPage() {
    return (
        <AdminGuard>
            <SalesContent />
        </AdminGuard>
    );
}
