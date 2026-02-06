'use client';

import { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

import NoiseOverlay from './NoiseOverlay';
import Navbar from './ook/Navbar';
import Hero from './ook/Hero';
import Features from './ook/Features';
import HowItWorks from './ook/HowItWorks';
import Pricing from './ook/Pricing';
import TuneTalez from './ook/TuneTalez';
import Quotes from './ook/Quotes';
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
            router.push('/dashboard');
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
                <Features />
                <HowItWorks />
                <Pricing />
                <TuneTalez />
                <Quotes onJoinClick={handleJoinClick} />
            </main>
            <Footer />
        </div>
    );
}
