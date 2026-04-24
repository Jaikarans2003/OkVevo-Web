'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Image as ImageIcon, LayoutGrid, Users, FileText, Shield, ShoppingBag } from 'lucide-react';

const NAVIGATION_ITEMS = [
    {
        href: '/admin/trend-requests',
        label: 'Trend Requests',
        icon: Sparkles,
        color: 'from-[#FF6B35]/20',
        iconBg: 'bg-[#FF6B35]/10',
        iconBorder: 'border-[#FF6B35]/20',
        iconColor: 'text-[#FF6B35]',
    },
    {
        href: '/admin/banners',
        label: 'Banners',
        icon: ImageIcon,
        color: 'from-orange-500/20',
        iconBg: 'bg-orange-500/10',
        iconBorder: 'border-orange-500/20',
        iconColor: 'text-orange-500',
    },
    {
        href: '/admin/products',
        label: 'Products',
        icon: LayoutGrid,
        color: 'from-blue-500/20',
        iconBg: 'bg-blue-500/10',
        iconBorder: 'border-blue-500/20',
        iconColor: 'text-blue-500',
    },
    {
        href: '/admin/affiliates',
        label: 'Affiliates',
        icon: Users,
        color: 'from-purple-500/20',
        iconBg: 'bg-purple-500/10',
        iconBorder: 'border-purple-500/20',
        iconColor: 'text-purple-500',
    },
    {
        href: '/admin/blogs',
        label: 'Blog',
        icon: FileText,
        color: 'from-green-500/20',
        iconBg: 'bg-green-500/10',
        iconBorder: 'border-green-500/20',
        iconColor: 'text-green-500',
    },
    {
        href: '/admin/sales',
        label: 'Sales',
        icon: ShoppingBag,
        color: 'from-emerald-500/20',
        iconBg: 'bg-emerald-500/10',
        iconBorder: 'border-emerald-500/20',
        iconColor: 'text-emerald-400',
    },
];

export default function AdminSidebar() {
    const pathname = usePathname();

    return (
        <div className="w-64 h-screen bg-[#0A0A0A] border-r border-white/5 flex flex-col sticky top-0">
            {/* Header */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-wider text-white">Admin</h1>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Dashboard</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
                {NAVIGATION_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                group flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                                ${isActive 
                                    ? 'bg-white/5 border border-white/10' 
                                    : 'hover:bg-white/5 border border-transparent'
                                }
                            `}
                        >
                            <div className={`w-9 h-9 rounded-lg ${item.iconBg} border ${item.iconBorder} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`w-4 h-4 ${item.iconColor}`} />
                            </div>
                            <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'} transition-colors`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-white/5">
                <Link
                    href="/admin"
                    className={`
                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                        ${pathname === '/admin' 
                            ? 'bg-white/5 border border-white/10' 
                            : 'hover:bg-white/5 border border-transparent'
                        }
                    `}
                >
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-white/60" />
                    </div>
                    <span className={`text-sm font-bold ${pathname === '/admin' ? 'text-white' : 'text-white/60 hover:text-white'} transition-colors`}>
                        Users
                    </span>
                </Link>
            </div>
        </div>
    );
}
