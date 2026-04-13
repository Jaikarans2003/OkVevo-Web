'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import NoiseOverlay from '@/components/NoiseOverlay';
import Navbar from '@/components/ook/Navbar';
import Footer from '@/components/ook/Footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

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
                {children}
            </main>
            <Footer />
        </div>
    );
}
