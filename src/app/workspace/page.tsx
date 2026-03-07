'use client';

import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

// Modular Redesign Components (WGMI Style)
import DashHeroModular from '../../components/workspace/WorkspaceHeroModular';
import DashGridModular from '../../components/workspace/WorkspaceGridModular';
import DashTrendsModular from '../../components/workspace/WorkspaceTrendsModular';
import DashSpotlight from '../../components/workspace/WorkspaceSpotlight';
import DashFooterModular from '../../components/workspace/WorkspaceFooterModular';
import DashNavbar from '../../components/workspace/WorkspaceNavbar';

export default function WorkspacePage() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);


    return (
        <div className="bg-black text-white font-sans selection:bg-[#E2FF4D]/30 overflow-x-hidden min-h-screen">
            <DashNavbar />

            <main>
                <DashHeroModular user={user} />
                {/* <DashGridModular /> */}
                {/* <DashTrendsModular /> */}
                {/* <DashSpotlight /> */}
                {/* <DashFooterModular /> */}
            </main>
        </div>
    );
}
