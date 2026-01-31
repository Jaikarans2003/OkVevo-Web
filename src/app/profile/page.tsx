"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../config/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import { LogOut, ArrowLeft, Building2, Shield, MessageSquare, UserCircle, Edit3 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);

                // Fetch user profile from Firestore
                try {
                    const profile = await getUserProfile(currentUser.uid);
                    setUserProfile(profile);
                } catch (error) {
                    console.error('Error fetching user profile:', error);
                }
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
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={24}
                            height={24}
                            className="w-6 h-6 group-hover:scale-110 transition-transform"
                        />
                        <span className="font-[family-name:var(--font-museo-moderno)] font-bold text-lg text-custom-cream tracking-wide">OKVEVO</span>
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

            {/* Right Sidebar - Quick Actions */}
            <aside className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50">
                <div className="bg-custom-bg/80 backdrop-blur-md border border-custom-orange/20 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl shadow-custom-orange/10 min-w-[200px]">
                    {/* Logo */}
                    <Link href="/chat" className="group flex items-center justify-center">
                        <div className="p-3 bg-custom-orange/10 rounded-2xl hover:bg-custom-orange/20 transition-all duration-300">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                width={32}
                                height={32}
                                className="w-8 h-8 group-hover:scale-110 transition-transform"
                            />
                        </div>
                    </Link>

                    {/* Divider */}
                    <div className="w-full h-px bg-custom-orange/20"></div>

                    {/* Chat Button */}
                    <Link
                        href="/chat"
                        className="flex items-center gap-3 p-3 bg-custom-orange rounded-2xl hover:bg-orange-600 transition-all duration-300 group"
                    >
                        <MessageSquare className="w-5 h-5 text-custom-cream group-hover:scale-110 transition-transform flex-shrink-0" />
                        <span className="text-custom-cream font-bold text-sm">Chat</span>
                    </Link>

                    {/* Avatar Button - Coming Soon */}
                    <div className="flex items-center gap-3 p-3 bg-custom-cream/5 rounded-2xl opacity-60 cursor-not-allowed">
                        <UserCircle className="w-5 h-5 text-custom-cream/50 flex-shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-custom-cream/50 font-bold text-sm">Avatar</span>
                            <span className="text-xs text-custom-orange/70">Coming Soon</span>
                        </div>
                    </div>

                    {/* Editing Button - Coming Soon */}
                    <div className="flex items-center gap-3 p-3 bg-custom-cream/5 rounded-2xl opacity-60 cursor-not-allowed">
                        <Edit3 className="w-5 h-5 text-custom-cream/50 flex-shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-custom-cream/50 font-bold text-sm">Editing</span>
                            <span className="text-xs text-custom-orange/70">Coming Soon</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Profile Content */}
            <main className="pt-32 px-6 pb-12 max-w-3xl mx-auto">
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

                        {userProfile?.userType && (
                            <div className="p-4 bg-custom-bg/50 border border-custom-orange/10 rounded-2xl transition-all hover:border-custom-orange/30">
                                <label className="block text-xs font-bold text-custom-orange uppercase tracking-wider mb-1">Account Type</label>
                                <div className="text-lg font-medium text-custom-cream capitalize">
                                    {userProfile.userType}
                                </div>
                            </div>
                        )}

                        {userProfile?.userType === 'organisation' && userProfile.organisationName && (
                            <div className="p-4 bg-custom-bg/50 border border-custom-orange/10 rounded-2xl transition-all hover:border-custom-orange/30">
                                <label className="block text-xs font-bold text-custom-orange uppercase tracking-wider mb-1">Organisation</label>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-lg font-medium text-custom-cream mb-1">
                                            {userProfile.organisationName}
                                        </div>
                                        <div className="text-sm text-custom-cream/60 capitalize">
                                            Role: {userProfile.organisationRole}
                                        </div>
                                    </div>
                                    {userProfile.organisationRole === 'admin' && (
                                        <span className="px-3 py-1 bg-custom-orange/20 text-custom-orange text-xs font-bold rounded-full border border-custom-orange/50 flex items-center gap-1">
                                            <Shield className="w-3 h-3" />
                                            Admin
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Organisation Dashboard Link for Admins */}
                        {userProfile?.userType === 'organisation' && userProfile.organisationRole === 'admin' && (
                            <Link
                                href="/dashboard/organisation"
                                className="block p-6 bg-gradient-to-br from-custom-orange/10 to-orange-600/10 border-2 border-custom-orange/30 rounded-2xl hover:border-custom-orange hover:from-custom-orange/20 hover:to-orange-600/20 transition-all duration-300 group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-custom-orange rounded-xl group-hover:scale-110 transition-transform">
                                            <Building2 className="w-6 h-6 text-custom-cream" />
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-custom-orange mb-1">
                                                Organisation Dashboard
                                            </div>
                                            <div className="text-sm text-custom-cream/60">
                                                Manage your organisation, members, and settings
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowLeft className="w-5 h-5 text-custom-orange rotate-180 group-hover:translate-x-2 transition-transform" />
                                </div>
                            </Link>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
