"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../config/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import { LogOut, ArrowLeft, Building2, Shield, MessageSquare, UserCircle, Edit3, Mail, Crown } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import NoiseOverlay from '../../components/NoiseOverlay';

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
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-accent-orange border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#050505] text-white relative">
            <NoiseOverlay />

            {/* Background Gradient */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.15, 0.1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-orange rounded-full blur-[150px]"
                />
            </div>

            {/* Navbar */}
            <nav className="relative z-20 sticky top-0 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/chat" className="flex items-center gap-2 group">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                width={32}
                                height={32}
                                className="w-8 h-8 group-hover:scale-110 transition-transform"
                            />
                            <span className="text-2xl font-black tracking-tighter text-white">
                                OKVEVO<span className="text-accent-orange">.</span>
                            </span>
                        </Link>

                        <div className="flex items-center gap-4">
                            <Link
                                href="/chat"
                                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border-2 border-white/10 hover:border-accent-orange/30 text-white font-bold rounded-full transition-all duration-300 flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Chat
                            </Link>
                            <button
                                onClick={handleSignOut}
                                className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/20 hover:border-red-500/50 text-red-400 hover:text-red-300 font-bold rounded-full transition-all duration-300 flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column - Profile Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                        className="lg:col-span-1"
                    >
                        <div className="glass-card bg-white/5 p-8 rounded-[40px] border border-white/10 sticky top-24 backdrop-blur-md">
                            {/* Avatar */}
                            <div className="flex flex-col items-center mb-6">
                                <div className="w-32 h-32 bg-gradient-to-br from-accent-orange to-orange-600 rounded-full flex items-center justify-center shadow-2xl shadow-accent-orange/20 mb-4 relative group">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <span className="text-5xl font-black text-white">
                                            {user.displayName ? user.displayName[0].toUpperCase() : user.email?.[0].toUpperCase()}
                                        </span>
                                    )}
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#050505] rounded-full flex items-center justify-center shadow-lg border border-white/10">
                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-1 text-center">
                                    {user.displayName || 'User'}
                                </h2>
                                <p className="text-white/50 text-sm flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    {user.email}
                                </p>
                            </div>

                            {/* Account Type Badge */}
                            {userProfile?.userType && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-orange/10 to-orange-600/10 border-2 border-accent-orange/20 rounded-full">
                                        <Crown className="w-5 h-5 text-accent-orange" />
                                        <span className="text-accent-orange font-black text-sm uppercase tracking-wider">
                                            {userProfile.userType}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Quick Actions */}
                            <div className="space-y-3">
                                <Link
                                    href="/chat"
                                    className="flex items-center gap-3 p-4 bg-accent-orange hover:bg-orange-600 rounded-2xl transition-all duration-300 group"
                                >
                                    <MessageSquare className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                                    <span className="text-white font-bold">Start Chat</span>
                                </Link>

                                <div className="flex items-center gap-3 p-4 bg-white/5 border-2 border-white/5 rounded-2xl opacity-60 cursor-not-allowed">
                                    <UserCircle className="w-5 h-5 text-white/50" />
                                    <div className="flex-1">
                                        <span className="text-white/50 font-bold text-sm block">Create Avatar</span>
                                        <span className="text-xs text-accent-orange">Coming Soon</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-4 bg-white/5 border-2 border-white/5 rounded-2xl opacity-60 cursor-not-allowed">
                                    <Edit3 className="w-5 h-5 text-white/50" />
                                    <div className="flex-1">
                                        <span className="text-white/50 font-bold text-sm block">Video Editing</span>
                                        <span className="text-xs text-accent-orange">Coming Soon</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Column - Details */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="lg:col-span-2 space-y-6"
                    >
                        {/* Account Information */}
                        <div className="glass-card bg-white/5 p-8 rounded-[40px] border border-white/10 backdrop-blur-md">
                            <h3 className="text-2xl font-bold text-white mb-6">Account Information</h3>
                            <div className="space-y-4">
                                <div className="p-5 bg-black/20 rounded-2xl border-2 border-white/5 hover:border-accent-orange/20 transition-all">
                                    <label className="block text-xs font-black text-accent-orange uppercase tracking-wider mb-2">Full Name</label>
                                    <div className="text-lg font-semibold text-white">
                                        {user.displayName || 'Not set'}
                                    </div>
                                </div>

                                <div className="p-5 bg-black/20 rounded-2xl border-2 border-white/5 hover:border-accent-orange/20 transition-all">
                                    <label className="block text-xs font-black text-accent-orange uppercase tracking-wider mb-2">Email Address</label>
                                    <div className="text-lg font-semibold text-white">
                                        {user.email}
                                    </div>
                                </div>

                                {userProfile?.userType && (
                                    <div className="p-5 bg-black/20 rounded-2xl border-2 border-white/5 hover:border-accent-orange/20 transition-all">
                                        <label className="block text-xs font-black text-accent-orange uppercase tracking-wider mb-2">Account Type</label>
                                        <div className="text-lg font-semibold text-white capitalize">
                                            {userProfile.userType}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Organisation Info */}
                        {userProfile?.userType === 'organisation' && userProfile.organisationName && (
                            <div className="glass-card bg-white/5 p-8 rounded-[40px] border border-white/10 backdrop-blur-md">
                                <h3 className="text-2xl font-bold text-white mb-6">Organisation Details</h3>
                                <div className="p-6 bg-black/20 rounded-2xl border-2 border-white/5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <label className="block text-xs font-black text-accent-orange uppercase tracking-wider mb-2">Organisation Name</label>
                                            <div className="text-xl font-bold text-white mb-2">
                                                {userProfile.organisationName}
                                            </div>
                                            <div className="text-sm text-white/50 capitalize">
                                                Role: <span className="font-semibold text-white">{userProfile.organisationRole}</span>
                                            </div>
                                        </div>
                                        {userProfile.organisationRole === 'admin' && (
                                            <span className="px-4 py-2 bg-accent-orange/10 text-accent-orange text-xs font-black rounded-full border-2 border-accent-orange/30 flex items-center gap-2">
                                                <Shield className="w-4 h-4" />
                                                ADMIN
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Organisation Dashboard Link for Admins */}
                        {userProfile?.userType === 'organisation' && userProfile.organisationRole === 'admin' && (
                            <Link
                                href="/dashboard/organisation"
                                className="block"
                            >
                                <div className="glass-card bg-white/5 p-8 rounded-[40px] border-2 border-accent-orange/30 hover:border-accent-orange hover:shadow-2xl hover:shadow-accent-orange/10 transition-all duration-500 group backdrop-blur-md">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-6">
                                            <div className="p-4 bg-gradient-to-br from-accent-orange to-orange-600 rounded-2xl group-hover:scale-110 transition-transform shadow-lg">
                                                <Building2 className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-xl font-bold text-white mb-2">
                                                    Organisation Dashboard
                                                </div>
                                                <div className="text-sm text-white/50">
                                                    Manage your organisation, members, and settings
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowLeft className="w-6 h-6 text-accent-orange rotate-180 group-hover:translate-x-2 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        )}
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
