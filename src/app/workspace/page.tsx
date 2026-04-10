'use client';

import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Modular Redesign Components (WGMI Style)
import WorkspaceBento from '../../components/workspace/WorkspaceBento';
import DashNavbar from '../../components/workspace/WorkspaceNavbar';

export default function WorkspacePage() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();
    const { userProfile, loading: authLoading, isAuthenticated } = useAuth();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated()) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);


    return (
        <div className="bg-black text-white font-sans selection:bg-accent-orange/30 overflow-x-hidden min-h-screen relative">
            {/* Consistent Grid Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div 
                    className="absolute inset-0 opacity-[0.08]" 
                    style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
                        backgroundSize: '40px 40px'
                    }} 
                />
            </div>
            
            <div className="relative z-10">
                <DashNavbar />

                <main>
                    <WorkspaceBento user={user} />
                </main>
            </div>
        </div>
    );
}
