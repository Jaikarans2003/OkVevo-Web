'use client';

import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

// Modular Redesign Components (WGMI Style)
import DashHeroModular from './DashHeroModular';
import DashGridModular from './DashGridModular';
import DashTrendsModular from './DashTrendsModular';
import DashSpotlight from './DashSpotlight';
import DashFooterModular from './DashFooterModular';
import DashNavbar from './DashNavbar';

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleJoinClick = () => {
        router.push('/chat');
    };

    return (
        <div className="bg-[#FAFAFA] text-black font-sans selection:bg-[#E2FF4D]/30 overflow-x-hidden min-h-screen">
            <DashNavbar />

            <main>
                <DashHeroModular user={user} />
                <DashGridModular />
                {/* <DashTrendsModular /> */}
                <DashSpotlight />
                <DashFooterModular />
            </main>
        </div>
    );
}
