'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import InstagramHero from '@/components/social-studio/InstagramHero';
import TrendGrid from '@/components/social-studio/TrendGrid';
import TrendModal from '@/components/social-studio/TrendModal';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import StudioNavbar from '@/components/workspace/StudioNavbar';

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

            <StudioNavbar />

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
