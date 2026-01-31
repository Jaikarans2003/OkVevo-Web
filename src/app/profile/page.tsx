"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../config/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Film, User as UserIcon, LogOut, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                router.push('/login');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-custom-bg flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-custom-orange border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-custom-bg text-custom-cream">
            {/* Navbar */}
            <nav className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-auto">
                <div className="bg-custom-bg/80 backdrop-blur-md border border-custom-orange/20 rounded-full pl-6 pr-2 py-2 flex items-center gap-8 shadow-2xl shadow-custom-orange/10">
                    <Link href="/chat" className="flex items-center gap-2 group">
                        <Film className="w-5 h-5 text-custom-orange group-hover:rotate-12 transition-transform" />
                        <span className="font-[family-name:var(--font-museo-moderno)] font-boldtext-lg text-custom-cream tracking-wide">OKVEVO</span>
                    </Link>

                    <div className="flex items-center gap-4">
                        <Link
                            href="/chat"
                            className="p-2 text-custom-cream/70 hover:text-custom-orange transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="w-px h-6 bg-custom-orange/20"></div>
                        <button
                            onClick={handleSignOut}
                            className="px-6 py-2.5 bg-custom-cream/5 hover:bg-red-500/10 text-custom-cream/70 hover:text-red-400 text-sm font-bold rounded-full border border-custom-orange/10 hover:border-red-500/30 transition-all duration-300 flex items-center gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            {/* Profile Content */}
            <main className="pt-32 px-6 pb-12 max-w-2xl mx-auto">
                <div className="bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/20 rounded-3xl p-8 shadow-xl">
                    <div className="flex items-center gap-6 mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-custom-orange to-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-custom-orange/30">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-3xl font-bold text-custom-cream">
                                    {user.displayName ? user.displayName[0].toUpperCase() : user.email?.[0].toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-custom-orange mb-1">My Profile</h1>
                            <p className="text-custom-cream/60">Manage your account details</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-4 bg-custom-bg/50 border border-custom-orange/10 rounded-2xl transition-all hover:border-custom-orange/30">
                            <label className="block text-xs font-bold text-custom-orange uppercase tracking-wider mb-1">Full Name</label>
                            <div className="text-lg font-medium text-custom-cream">
                                {user.displayName || 'Not set'}
                            </div>
                        </div>

                        <div className="p-4 bg-custom-bg/50 border border-custom-orange/10 rounded-2xl transition-all hover:border-custom-orange/30">
                            <label className="block text-xs font-bold text-custom-orange uppercase tracking-wider mb-1">Email Address</label>
                            <div className="text-lg font-medium text-custom-cream">
                                {user.email}
                            </div>
                        </div>

                        {/* <div className="p-4 bg-custom-bg/50 border border-custom-orange/10 rounded-2xl transition-all hover:border-custom-orange/30">
                            <label className="block text-xs font-bold text-custom-orange uppercase tracking-wider mb-1">Account ID</label>
                            <div className="text-sm font-mono text-custom-cream/60">
                                {user.uid}
                            </div>
                        </div> */}
                    </div>
                </div>
            </main>
        </div>
    );
}
