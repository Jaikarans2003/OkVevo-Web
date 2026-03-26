'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import InstagramHero from '@/components/social-studio/InstagramHero';
import TrendGrid from '@/components/social-studio/TrendGrid';
import TrendModal from '@/components/social-studio/TrendModal';
import MyGenerations from '@/components/social-studio/MyGenerations';
import StudioNavbar from '@/components/workspace/StudioNavbar';
import type { TrendDefinition } from '@/data/trendDefinitions';
import SubscriptionGuard from '@/components/SubscriptionGuard';

export default function InstagramTrendsStudio() {
    const [selectedTrend, setSelectedTrend] = useState<TrendDefinition | null>(null);

    return (
        <SubscriptionGuard>
            <div className="min-h-screen bg-[#0B0B0D] text-white selection:bg-[#FF6B35]/30 font-sans pb-20">
            {/* Minimal Subtle Grain Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[100]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            <StudioNavbar />

            <div 
            className="min-h-screen relative pt-14"
            style={{ 
                backgroundImage: 'url("/images/bgg.png")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
            }}
        >
            {/* Background Overlay */}
            <div className="absolute inset-0 bg-[#050505]/40 backdrop-blur-[2px] pointer-events-none" />

                <div className="relative z-10 space-y-12">
                    <TrendGrid onSelect={(trend) => setSelectedTrend(trend)} />
                    <MyGenerations />
                </div>
            </div>

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
        </SubscriptionGuard>
    );
}
