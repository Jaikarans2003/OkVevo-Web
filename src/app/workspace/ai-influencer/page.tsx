'use client';

import InfluencerStudio from '@/components/ai-influencer/InfluencerStudio';
import InfluencerHero from '@/components/ai-influencer/InfluencerHero';
import StudioNavbar from '@/components/workspace/StudioNavbar';

export default function AIInfluencerPage() {
    return (
        <div className="min-h-screen bg-[#0B0B0D] text-white selection:bg-[#FF0080]/30 font-sans pb-20">
            {/* Minimal Subtle Grain Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[100]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            <StudioNavbar />

            <main className="max-w-[1600px] mx-auto px-8 pt-8">
                <InfluencerHero />

                <div className="h-px w-full bg-white/5 my-12" />

                <InfluencerStudio />
            </main>
        </div>
    );
}
