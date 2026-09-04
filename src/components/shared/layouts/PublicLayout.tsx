'use client';

import NoiseOverlay from '@/components/shared/NoiseOverlay';
import Navbar from '@/components/landing-page/Navbar';
import Footer from '@/components/landing-page/Footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-bg-main">
            <NoiseOverlay />
            <Navbar />
            <main>
                {children}
            </main>
            <Footer />
        </div>
    );
}
