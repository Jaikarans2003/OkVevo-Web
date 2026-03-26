'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Loader2, ShieldAlert } from 'lucide-react';

interface AdminGuardProps {
    children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                console.log('🔒 No user found, redirecting to admin login');
                router.push('/admin/login');
                return;
            }

            try {
                const token = await user.getIdToken();
                
                // Verify admin status on server
                const res = await fetch('/api/admin/check', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.isAdmin) {
                        setIsAdmin(true);
                        setLoading(false);
                        return;
                    }
                }

                setError('Access denied. You do not have admin permissions.');
                setLoading(false);
                // Redirect after a short delay so user can see the error
                setTimeout(() => router.push('/admin/login'), 3000);
                
            } catch (err: any) {
                console.error('Admin guard auth error:', err);
                setError('Authentication failed. Please try logging in again.');
                setLoading(false);
                setTimeout(() => router.push('/admin/login'), 3000);
            }
        });

        return () => unsubscribe();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-white/60 font-medium">Verifying Admin Access...</p>
                </div>
            </div>
        );
    }

    if (error || !isAdmin) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-red-500/5 border border-red-500/20 rounded-[2rem] p-10 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
                    <p className="text-red-400/80 text-sm leading-relaxed mb-6">
                        {error || 'You do not have the required permissions to view this page.'}
                    </p>
                    <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full animate-[progress_3s_linear]" style={{ width: '100%' }} />
                    </div>
                    <p className="text-[10px] text-white/20 uppercase tracking-widest mt-4 font-bold">Redirecting to Login...</p>
                </div>
                <style jsx>{`
                    @keyframes progress {
                        from { width: 100%; }
                        to { width: 0%; }
                    }
                `}</style>
            </div>
        );
    }

    return <>{children}</>;
}
