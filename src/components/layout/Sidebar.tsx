"use client";

import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    ShoppingBag,
    Video,
    Activity,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Clapperboard
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const menuItems = [
    { icon: LayoutDashboard, label: 'Workspace', href: '/workspace' },
    { icon: Users, label: 'AI Avatars', href: '/workspace/social' }, // Point to social as a placeholder
    { icon: ShoppingBag, label: 'Product Studio', href: '/workspace/product' },
    { icon: Video, label: 'UGC Factory', href: '/workspace/social' }, // Point to social as a placeholder
    { icon: Activity, label: 'AI Influencer', href: '/workspace/ai-influencer' },
    { icon: Clapperboard, label: 'Director Mode', href: '/workspace/director' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <motion.aside
            initial={{ width: 280 }}
            animate={{ width: collapsed ? 80 : 280 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} // Smooth cubic-bezier
            className="h-[calc(100%-2rem)] m-4 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/20 flex flex-col relative z-50 shrink-0 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]"
        >
            {/* Logo Area */}
            <div className={`h-20 flex items-center px-6 ${collapsed ? 'justify-center' : 'justify-start'} overflow-hidden`}>
                <Link href="/" className="flex items-center gap-1 group">
                    <AnimatePresence mode="wait">
                        {collapsed ? (
                            <motion.div
                                key="collapsed-logo"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="w-10 h-10 flex items-center justify-center shrink-0"
                            >
                                <Image
                                    src="/OKVEVO WithOut BackGrounds/Orange.svg"
                                    alt="OKVEVO O"
                                    width={40}
                                    height={40}
                                    className="object-contain"
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="full-logo"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="flex items-center gap-2"
                            >
                                <Image
                                    src="/OKVEVO WithOut BackGrounds/Orange.svg"
                                    alt="OKVEVO Logo"
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 object-contain"
                                />
                                <span className="text-xl font-black tracking-[-0.05em] text-white">
                                    OKVEVO<span className="w-1.5 h-1.5 rounded-full bg-accent-orange inline-block ml-1 animate-pulse" />
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`
                                flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative
                                ${isActive
                                    ? 'bg-accent-orange/10 text-accent-orange'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'}
                                ${collapsed ? 'justify-center' : ''}
                            `}
                        >
                            <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-accent-orange' : 'group-hover:text-white'} transition-colors`} />

                            <AnimatePresence>
                                {!collapsed && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -5 }}
                                        transition={{ duration: 0.2 }}
                                        className="ml-3 font-medium whitespace-nowrap"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {isActive && !collapsed && (
                                <motion.div
                                    layoutId="activeIndicator"
                                    className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-orange"
                                />
                            )}

                            {/* Tooltip for collapsed state */}
                            {collapsed && (
                                <div className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                    {item.label}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="p-4 border-t border-white/5 space-y-1">
                <button className={`
                    w-full flex items-center px-3 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all
                    ${collapsed ? 'justify-center' : ''}
                `}>
                    <Settings className="w-5 h-5 shrink-0" />
                    {!collapsed && (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="ml-3 font-medium"
                        >
                            Settings
                        </motion.span>
                    )}
                </button>

                <button className={`
                    w-full flex items-center px-3 py-3 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-all
                    ${collapsed ? 'justify-center' : ''}
                `}>
                    <LogOut className="w-5 h-5 shrink-0" />
                    {!collapsed && (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="ml-3 font-medium"
                        >
                            Logout
                        </motion.span>
                    )}
                </button>
            </div>

            {/* Collapse Toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-24 w-6 h-6 bg-accent-orange rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-900/20 hover:scale-110 transition-transform z-50 border border-black"
            >
                <motion.div
                    animate={{ rotate: collapsed ? 0 : 180 }}
                    transition={{ duration: 0.3 }}
                >
                    <ChevronRight className="w-3 h-3" />
                </motion.div>
            </button>

        </motion.aside>
    );
}
