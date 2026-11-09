'use client';

import NoiseOverlay from '@/components/shared/NoiseOverlay';
import Navbar from '@/components/landing-page/Navbar';
import Footer from '@/components/landing-page/Footer';
import SmoothScroll from '@/components/landing-page/SmoothScroll';

export default function PublicLayout({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
    return (
        <div className="min-h-screen bg-[#f6f1ec]">
            <SmoothScroll />
            <NoiseOverlay />
            <Navbar />
            <main id="main">
                {children}
            </main>
            {footer && <Footer />}
        </div>
    );
}
