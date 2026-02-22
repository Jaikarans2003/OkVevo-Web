'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import InstagramHero from '@/components/social-studio/InstagramHero';
import TrendGrid from '@/components/social-studio/TrendGrid';
import TrendModal from '@/components/social-studio/TrendModal';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface Trend {
    id: string;
    title: string;
    description: string;
    image: string;
    tags: string[];
}

export default function InstagramTrendsStudio() {
    const pathname = usePathname();
    const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);

    return (
        <div className="min-h-screen bg-[#0B0B0D] text-white selection:bg-[#FF0080]/30 font-sans pb-20">
            {/* Minimal Subtle Grain Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[100]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            {/* Header Navigation */}
            <nav className="h-24 px-8 flex items-center justify-between border-b border-white/5 sticky top-0 bg-[#0B0B0D]/80 backdrop-blur-xl z-[90]">
                <Link href="/" className="flex items-center gap-1 group">
                    <Image
                        src="/OKVEVO WithOut BackGrounds/White.svg"
                        alt="OKVEVO Logo"
                        width={140}
                        height={40}
                        className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                </Link>

                <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                    {[
                        { name: 'Product Studio', href: '/workspace/product' },
                        { name: 'Social Media', href: '/workspace/social' },
                        { name: 'Director', href: '/workspace/director' }
                    ].map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`relative text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === item.href ? 'text-white' : 'text-white/20 hover:text-white/60'}`}
                        >
                            {item.name}
                            {pathname === item.href && (
                                <div className="absolute -bottom-2 left-0 right-0 h-[1px] bg-white opacity-20" />
                            )}
                        </Link>
                    ))}
                </div>

                {/* <div className="flex items-center gap-4">
                    <button className="h-10 px-6 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                        Feedback
                    </button>
                </div> */}
            </nav>

            <main>
                <InstagramHero />
                <TrendGrid onSelect={(trend) => setSelectedTrend(trend)} />
            </main>

            {/* Trend Generation Modal */}
            <AnimatePresence>
                {selectedTrend && (
                    <TrendModal
                        trend={selectedTrend}
                        onClose={() => setSelectedTrend(null)}
                    />
                )}
            </AnimatePresence>


        </div>
    );
}
