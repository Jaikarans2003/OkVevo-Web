'use client';

import { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

import NoiseOverlay from './NoiseOverlay';
import Navbar from './ook/Navbar';
import Hero from './ook/Hero';
import Showcase from './ook/Showcase';
import HowItWorks from './ook/Features';
import BuiltForCreators from './ook/BuiltForCreators';
import Pricing from './ook/Pricing';
import MasivCollaboration from './ook/MasivCollaboration';
import FeaturesGrid from './ook/FeaturesGrid';
import Footer from './ook/Footer';

export default function LandingPage() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    // Firebase authentication
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleJoinClick = () => {
        if (user) {
            router.push('/workspace');
        } else {
            router.push('/login');
        }
    };

    return (
        <div className="min-h-screen bg-bg-main">
            <NoiseOverlay />
            <Navbar user={user} onJoinClick={handleJoinClick} />
            <main>
                <Hero onJoinClick={handleJoinClick} />
                <Showcase />
                {/* <Features /> */}
                <HowItWorks />
                {/* <BuiltForCreators /> */}
                <MasivCollaboration />
                <div id="pricing">
                    <Pricing user={user} />
                </div>
                {/* <FeaturesGrid /> */}
                {/* <TuneTalez /> */}
                {/* <Quotes onJoinClick={handleJoinClick} /> */}
            </main>
            <Footer />
        </div>
    );
}
