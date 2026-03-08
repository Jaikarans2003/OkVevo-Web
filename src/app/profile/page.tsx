"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../config/firebase';
import { onAuthStateChanged, User, signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import { 
    LogOut, 
    ArrowLeft, 
    Shield, 
    Mail, 
    Crown, 
    LayoutDashboard,
    User as UserIcon,
    Settings,
    CreditCard,
    Zap,
    Camera,
    Loader2
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import NoiseOverlay from '../../components/NoiseOverlay';

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setNewName(currentUser.displayName || '');
                try {
                    const profile = await getUserProfile(currentUser.uid);
                    setUserProfile(profile);
                    if (profile && profile.organisationName) {
                        setNewName(profile.organisationName);
                    }
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

    const handleNameUpdate = async () => {
        if (!user || !newName.trim()) return;
        
        setLoading(true);
        try {
            // Update Auth
            await updateProfile(user, { displayName: newName });
            
            // Update Firestore
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                organisationName: newName,
                updatedAt: serverTimestamp()
            });

            // Update local state
            setUser({ ...user, displayName: newName } as User);
            setEditingName(false);
        } catch (error) {
            console.error("Name update error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("uid", user.uid);

            const response = await fetch("/api/upload/avatar", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (data.url) {
                // Update Firebase Auth Profile
                await updateProfile(user, { photoURL: data.url });
                
                // Also update Firestore users collection
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    photoURL: data.url,
                    updatedAt: serverTimestamp()
                });

                // Update local state to reflect change immediately
                setUser({ ...user, photoURL: data.url } as User);
            }
        } catch (error) {
            console.error("Upload error:", error);
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#7D7EF9] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    const displayName = user.displayName || 'User';
    const initials = displayName.charAt(0).toUpperCase();

    return (
        <div className="min-h-screen bg-black text-white selection:bg-[#FF4D00]/30 relative overflow-x-hidden">
            <NoiseOverlay />

            {/* --- BACKGROUND AESTHETICS --- */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <img 
                    src="/images/herobg.png" 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-30 mix-blend-screen"
                />
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#FF4D00]/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#FF4D00]/5 blur-[100px] rounded-full" />
            </div>

            {/* --- MINIMAL NAVBAR --- */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-white/5 px-8 py-6">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                    <Link href="/workspace" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-[#FF4D00] rounded-xl flex items-center justify-center shadow-lg shadow-[#FF4D00]/20 group-hover:rotate-6 transition-transform">
                            <Zap className="w-5 h-5 text-white fill-white" />
                        </div>
                        <span className="text-2xl font-black tracking-tighter text-white">
                            OKVEVO<span className="text-[#FF4D00]">.</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-6">
                        <Link href="/workspace" className="text-sm font-black uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors">
                            Workspace
                        </Link>
                        <button 
                            onClick={handleSignOut}
                            className="bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-red-400 transition-all"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            {/* --- MAIN CONTENT (CENTERED) --- */}
            <main className="relative z-10 pt-44 pb-32 px-6 flex flex-col items-center max-w-4xl mx-auto">
                
                {/* Profile Header */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center mb-16 w-full text-center"
                >
                    <div className="relative mb-10 group/avatar">
                        <input 
                            type="file" 
                            id="avatar-upload" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploading}
                        />
                        <label 
                            htmlFor="avatar-upload"
                            className={`w-40 h-40 rounded-full border-4 border-[#FF4D00]/30 p-2 relative block cursor-pointer group-hover:border-[#FF4D00]/60 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#FF4D00] to-[#e64600] overflow-hidden flex items-center justify-center text-6xl font-black text-white shadow-2xl relative">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt={displayName} className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-500" />
                                ) : (
                                    initials
                                )}
                                
                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                    <Camera className="w-8 h-8 text-white" />
                                </div>

                                {/* Loading Spinner */}
                                {uploading && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    </div>
                                )}
                            </div>
                        </label>
                        <div className="absolute bottom-2 right-2 w-10 h-10 bg-black rounded-full border-4 border-[#FF4D00] flex items-center justify-center shadow-lg">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        {editingName ? (
                            <div className="flex flex-col items-center gap-4">
                                <input 
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="text-4xl md:text-6xl font-black text-center bg-transparent border-b-4 border-[#FF4D00] outline-none tracking-tighter w-full max-w-lg"
                                    autoFocus
                                />
                                <div className="flex gap-4">
                                    <button 
                                        onClick={handleNameUpdate}
                                        className="bg-[#FF4D00] text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform"
                                    >
                                        Save Changes
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setEditingName(false);
                                            setNewName(user.displayName || '');
                                        }}
                                        className="bg-white/10 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <h1 
                                onClick={() => setEditingName(true)}
                                className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none mb-4 cursor-pointer hover:text-[#FF4D00] transition-colors group"
                            >
                                {displayName}<span className="text-[#FF4D00]">.</span>
                                <span className="text-[10px] block opacity-0 group-hover:opacity-40 transition-opacity font-black uppercase tracking-widest mt-2">Click to edit name</span>
                            </h1>
                        )}
                    </div>
                    <p className="text-xl text-white/40 font-medium tracking-tight">
                        {user.email}
                    </p>
                </motion.div>

                {/* Account Bento Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-12">
                    
                    {/* Primary Info Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/5 border border-white/10 rounded-[3rem] p-10 backdrop-blur-xl relative overflow-hidden group"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-8">
                                <UserIcon className="w-5 h-5 text-[#FF4D00]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Personal Details</span>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-[#FF4D00] mb-1">Full Name</p>
                                    <h3 className="text-2xl font-bold text-white">{displayName}</h3>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-[#FF4D00] mb-1">Email</p>
                                    <p className="text-lg font-medium text-white/80">{user.email}</p>
                                </div>
                            </div>
                        </div>
                        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-[#FF4D00]/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                    </motion.div>

                    {/* Subscription/Status Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[#111111] border border-white/5 rounded-[3rem] p-10 relative overflow-hidden group"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-8">
                                <Crown className="w-5 h-5 text-accent-orange" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Account Status</span>
                            </div>
                            <div className="mb-6">
                                <p className="text-[10px] font-black uppercase text-accent-orange mb-1">Tier</p>
                                <h3 className="text-3xl font-black text-white tracking-widest uppercase italic">
                                    {userProfile?.userType || 'Hobby'}
                                </h3>
                            </div>
                            <button className="w-fit flex items-center gap-2 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#FF4D00] hover:border-[#FF4D00] transition-all duration-300">
                                Upgrade Workspace
                            </button>
                        </div>
                        <div className="absolute top-0 right-0 w-40 h-40 bg-accent-orange/5 rounded-bl-[5rem] blur-2xl" />
                    </motion.div>
                </div>

                {/* Secondary Actions / Settings */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-full space-y-4"
                >
                    <Link href="/workspace" className="flex items-center justify-between p-8 bg-[#FF4D00] rounded-[2.5rem] group overflow-hidden relative">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-black text-white leading-none mb-1">Enter Workspace</h3>
                            <p className="text-white/70 text-sm font-medium">Continue your creative journey</p>
                        </div>
                        <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform">
                            <LayoutDashboard className="w-6 h-6 text-[#FF4D00]" />
                        </div>
                        <div className="absolute top-0 right-0 bottom-0 left-[70%] bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </Link>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Security', icon: Shield, color: 'text-green-400' },
                            { label: 'Settings', icon: Settings, color: 'text-blue-400' },
                            { label: 'Billing', icon: CreditCard, color: 'text-purple-400' }
                        ].map((action, i) => (
                            <button key={i} className="flex items-center gap-4 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all text-left">
                                <action.icon className={`w-5 h-5 ${action.color}`} />
                                <span className="text-xs font-black uppercase tracking-widest">{action.label}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Bottom Disc Badge (Matching Workspace) */}
                <div className="mt-24">
                    <div className="w-24 h-24 rounded-full bg-[#111] flex items-center justify-center border-4 border-white/5 relative group cursor-pointer hover:rotate-12 transition-transform duration-500">
                        <div className="absolute inset-x-[-10px] inset-y-[-10px] rounded-full border border-dashed border-[#FF4D00]/20 animate-spin-slow" />
                        <div className="text-[10px] font-black text-white text-center uppercase tracking-tighter">
                            User<br />Profile<br />v2
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}

// Add slow spin animation to tailwind config or just use framer for simplicity if needed
// For now, these classes are illustrative of the design intent.
