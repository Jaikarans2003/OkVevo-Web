'use client';

import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

// Modular Redesign Components (WGMI Style)
import WorkspaceBento from '../../components/workspace/WorkspaceBento';
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
        <div className="bg-black text-white font-sans selection:bg-accent-orange/30 overflow-x-hidden min-h-screen">
            <DashNavbar />

            <main>
                <WorkspaceBento user={user} />
            </main>
        </div>
    );
}
