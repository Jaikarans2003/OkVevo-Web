"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../config/firebase';
import { onAuthStateChanged, User, signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import { getUserHistory, UserGeneration } from '../../services/HistoryService';
import { getUserSubscription, SubscriptionWithPlanDetails, formatPrice, getStatusColor, getStatusLabel } from '../../services/SubscriptionService';
import HistoryCard from '../../components/HistoryCard';
import { 
    LogOut, 
    ArrowLeft, 
    Camera, 
    Loader2,
    Settings,
    Edit3,
    Check,
    X,
    ExternalLink,
    MapPin,
    Twitter,
    Linkedin,
    Globe,
    CreditCard,
    History as HistoryIcon,
    Zap,
    Briefcase
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import NoiseOverlay from '../../components/NoiseOverlay';

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    // Edit state
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: '',
        bio: '',
        twitter: '',
        linkedin: '',
        website: ''
    });

    // Content state
    const [recentHistory, setRecentHistory] = useState<UserGeneration[]>([]);
    const [subscription, setSubscription] = useState<SubscriptionWithPlanDetails | null>(null);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setEditData(prev => ({ ...prev, name: currentUser.displayName || '' }));
                try {
                    const profile = await getUserProfile(currentUser.uid);
                    setUserProfile(profile);
                    if (profile) {
                        setEditData({
                            name: profile.organisationName || currentUser.displayName || '',
                            bio: profile.bio || '',
                            twitter: profile.socialLinks?.twitter || '',
                            linkedin: profile.socialLinks?.linkedin || '',
                            website: profile.socialLinks?.website || ''
                        });
                    }

                    // Fetch integrated data in parallel
                    const [hist, sub] = await Promise.all([
                        getUserHistory(currentUser.uid, 4), // max 4 for the grid
                        getUserSubscription(currentUser.uid)
                    ]);
                    setRecentHistory(hist);
                    setSubscription(sub);
                } catch (error) {
                    console.error('Error fetching user data:', error);
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

    const handleSaveProfile = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await updateProfile(user, { displayName: editData.name });
            
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                organisationName: editData.name,
                bio: editData.bio,
                socialLinks: {
                    twitter: editData.twitter,
                    linkedin: editData.linkedin,
                    website: editData.website
                },
                updatedAt: serverTimestamp()
            });

            if (auth.currentUser) {
                setUser(auth.currentUser);
            }
            if (userProfile) {
                setUserProfile({
                    ...userProfile,
                    organisationName: editData.name,
                    bio: editData.bio,
                    socialLinks: {
                        twitter: editData.twitter,
                        linkedin: editData.linkedin,
                        website: editData.website
                    }
                });
            }
            setEditing(false);
        } catch (error) {
            console.error("Profile update error:", error);
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
                await updateProfile(user, { photoURL: data.url });
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, { photoURL: data.url, updatedAt: serverTimestamp() });
                if (auth.currentUser) {
                    setUser(auth.currentUser);
                }
            }
        } catch (error) {
            console.error("Upload error:", error);
        } finally {
            setUploading(false);
        }
    };

    if (loading && !user) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-[#FF4D00] animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    const displayName = userProfile?.organisationName || user.displayName || 'Creator';
    const initials = displayName.charAt(0).toUpperCase();

    // Animation Configs
    const titleLetters = "PROFILE".split('');
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
    };
    const letterVariants = {
        hidden: { opacity: 0, y: 40, filter: 'blur(10px)', scale: 0.8 },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: { type: 'spring' as const, damping: 12, stiffness: 100 } }
    };

    const showSocialLinks = userProfile?.socialLinks && (userProfile.socialLinks.twitter || userProfile.socialLinks.linkedin || userProfile.socialLinks.website);

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white relative overflow-x-hidden selection:bg-[#FF4D00]/30 selection:text-white pt-24 pb-32">
            <NoiseOverlay />

            {/* Background Image */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <img 
                    src="/images/herobg.png" 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-30 mix-blend-screen"
                />
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/5 bg-[#0A0A0A]/40 px-8 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/workspace" className="flex items-center gap-3 group">
                        <ArrowLeft className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
                        <span className="text-sm font-black tracking-widest uppercase text-white/50 group-hover:text-white transition-colors">Workspace</span>
                    </Link>
                    <button onClick={handleSignOut} className="flex items-center gap-2 px-5 py-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-bold text-xs uppercase tracking-widest transition-all">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </nav>

            <main className="relative z-10 max-w-5xl mx-auto px-6 w-full mt-8">


                <div className="w-full flex justify-center mb-8 relative z-20">
                     <motion.h1 
                        variants={containerVariants} 
                        initial="hidden" 
                        animate="show" 
                        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-none tracking-tight flex"
                    >
                        {titleLetters.map((char, index) => (
                            <motion.span key={index} variants={letterVariants} className="inline-block bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                                {char}
                            </motion.span>
                        ))}
                        <motion.span 
                            initial={{ opacity: 0, scale: 0 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            transition={{ delay: 1.2, type: 'spring' }} 
                            className="text-[#FF4D00]"
                        >
                            .
                        </motion.span>
                    </motion.h1>
                </div>

                {/* Profile Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="w-full bg-[#111] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl relative mb-16"
                >
                    {/* Cover Photo Gradient Area */}
                    <div className="h-64 md:h-80 w-full relative overflow-hidden bg-[#0A0A0A]">
                        {/* Mesh gradient effect */}
                        <div className="absolute inset-0 opacity-80">
                            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[120%] bg-gradient-to-br from-[#FF4D00] to-transparent rounded-full blur-[100px]" />
                            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[100%] bg-gradient-to-tl from-purple-600 to-transparent rounded-full blur-[100px]" />
                            <div className="absolute top-[20%] right-[20%] w-[30%] h-[60%] bg-gradient-to-tr from-blue-500 to-transparent rounded-full blur-[80px]" />
                        </div>
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
                        
                        {/* Edit Button top right */}
                        {!editing && (
                            <button onClick={() => setEditing(true)} className="absolute top-6 right-6 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 transition-all flex items-center gap-2 group z-20">
                                <Edit3 className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white">Edit Profile</span>
                            </button>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="px-8 pb-10 relative">
                        {/* Avatar */}
                        <div className="relative -mt-24 mb-6 inline-block z-20">
                            <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border-[8px] border-[#111] bg-[#1a1a1a] relative group overflow-hidden shadow-2xl">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-[#333] to-[#111] flex items-center justify-center text-5xl font-black text-white/50 uppercase">
                                        {initials}
                                    </div>
                                )}
                                
                                <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 cursor-pointer transition-all backdrop-blur-sm z-10">
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                    {uploading ? <Loader2 className="w-8 h-8 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white mb-2" />}
                                    <span className="text-xs font-bold uppercase tracking-widest text-white">{uploading ? 'Uploading' : 'Update Photo'}</span>
                                </label>
                            </div>
                            {userProfile?.userType === 'pro' && (
                                <div className="absolute bottom-4 right-4 bg-gradient-to-r from-yellow-400 to-yellow-600 w-10 h-10 rounded-full border-4 border-[#111] flex items-center justify-center shadow-lg" title="PRO User">
                                    <Zap className="w-4 h-4 text-black fill-black" />
                                </div>
                            )}
                        </div>

                        {/* Profile Info Form / Display */}
                        <AnimatePresence mode="wait">
                            {editing ? (
                                <motion.div 
                                    key="edit"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-6 w-full max-w-2xl"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2 col-span-1 md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#FF4D00]">Display Name</label>
                                            <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:border-[#FF4D00] outline-none transition-colors" placeholder="Your Name" />
                                        </div>
                                        <div className="space-y-2 col-span-1 md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#FF4D00]">Bio / Role</label>
                                            <textarea value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#FF4D00] outline-none transition-colors h-24 resize-none" placeholder="e.g. AI Film Director & Digital Artist" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#FF4D00] flex items-center gap-2"><Twitter className="w-3 h-3"/> Twitter / X</label>
                                            <input type="text" value={editData.twitter} onChange={e => setEditData({...editData, twitter: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF4D00] outline-none transition-colors" placeholder="Username or URL" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#FF4D00] flex items-center gap-2"><Linkedin className="w-3 h-3"/> LinkedIn</label>
                                            <input type="text" value={editData.linkedin} onChange={e => setEditData({...editData, linkedin: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF4D00] outline-none transition-colors" placeholder="LinkedIn URL" />
                                        </div>
                                        <div className="space-y-2 col-span-1 md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-[#FF4D00] flex items-center gap-2"><Globe className="w-3 h-3"/> Personal Website</label>
                                            <input type="text" value={editData.website} onChange={e => setEditData({...editData, website: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-[#FF4D00] outline-none transition-colors" placeholder="https://yourwebsite.com" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 pt-4">
                                        <button onClick={handleSaveProfile} disabled={loading} className="px-8 py-3 bg-[#FF4D00] hover:bg-[#e64600] text-white rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-transform hover:scale-105">
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save Changes
                                        </button>
                                        <button onClick={() => setEditing(false)} className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors">
                                            <X className="w-4 h-4" /> Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="display"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-start"
                                >
                                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-2">{displayName}</h2>
                                    {userProfile?.bio ? (
                                        <p className="text-lg md:text-xl text-white/70 font-medium mb-4 max-w-2xl">{userProfile.bio}</p>
                                    ) : (
                                        <p className="text-lg text-white/40 italic mb-4">No bio added yet.</p>
                                    )}
                                    <div className="flex items-center gap-2 text-white/50 mb-8 border border-white/10 px-4 py-2 rounded-full bg-white/5 w-fit">
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-sm font-medium">{user.email}</span>
                                    </div>

                                    {showSocialLinks && (
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-white/30 mr-2">Links</span>
                                            {userProfile.socialLinks?.twitter && (
                                                <a href={userProfile.socialLinks.twitter.startsWith('http') ? userProfile.socialLinks.twitter : `https://twitter.com/${userProfile.socialLinks.twitter}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white/5 hover:bg-[#FF4D00]/20 hover:text-[#FF4D00] hover:border-[#FF4D00]/50 border border-white/10 rounded-full flex items-center gap-2 text-sm font-bold transition-all">
                                                    <Twitter className="w-4 h-4" /> Twitter
                                                </a>
                                            )}
                                            {userProfile.socialLinks?.linkedin && (
                                                <a href={userProfile.socialLinks.linkedin.startsWith('http') ? userProfile.socialLinks.linkedin : `https://${userProfile.socialLinks.linkedin}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/50 border border-white/10 rounded-full flex items-center gap-2 text-sm font-bold transition-all">
                                                    <Linkedin className="w-4 h-4" /> LinkedIn
                                                </a>
                                            )}
                                            {userProfile.socialLinks?.website && (
                                                <a href={userProfile.socialLinks.website.startsWith('http') ? userProfile.socialLinks.website : `https://${userProfile.socialLinks.website}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50 border border-white/10 rounded-full flex items-center gap-2 text-sm font-bold transition-all">
                                                    <Globe className="w-4 h-4" /> Portfolio
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Grid layout for History & Billing */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                    {/* Recent History Section */}
                    <div className="col-span-1 lg:col-span-2">
                        <div className="flex items-end justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                    <HistoryIcon className="w-6 h-6 text-[#FF4D00]" /> Recent Activity
                                </h3>
                                <p className="text-white/50 text-sm mt-1">Your latest generations</p>
                            </div>
                            <Link href="/history" className="text-xs font-black uppercase tracking-widest text-[#FF4D00] hover:text-[#e64600] flex items-center gap-1 transition-colors">
                                View All <ArrowLeft className="w-4 h-4 rotate-180" />
                            </Link>
                        </div>
                        
                        {recentHistory.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {recentHistory.map(gen => (
                                    <HistoryCard key={gen.id} generation={gen} viewMode="grid" />
                                ))}
                            </div>
                        ) : (
                            <div className="w-full bg-[#111] border border-white/10 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center">
                                <HistoryIcon className="w-12 h-12 text-white/10 mb-4" />
                                <p className="text-white/50 font-medium mb-4">No recent history found.</p>
                                <Link href="/workspace" className="px-6 py-2 bg-[#FF4D00] text-white rounded-full font-bold text-sm hover:scale-105 transition-transform">
                                    Start Creating
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Subscription / Billing Section */}
                    <div className="col-span-1">
                        <div className="flex items-end justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                    <CreditCard className="w-6 h-6 text-[#FF4D00]" /> Billing
                                </h3>
                                <p className="text-white/50 text-sm mt-1">Manage subscription</p>
                            </div>
                        </div>

                        <div className="bg-[#111] border border-white/10 rounded-[2rem] p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4D00]/5 rounded-full blur-2xl group-hover:bg-[#FF4D00]/10 transition-colors duration-500" />
                            
                            {subscription ? (
                                <div className="relative z-10 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Current Plan</p>
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${getStatusColor(subscription.status)} bg-opacity-20`}>
                                            <div className={`w-2 h-2 rounded-full ${getStatusColor(subscription.status)}`} />
                                            <span className="text-xs font-bold">{getStatusLabel(subscription.status)}</span>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="text-3xl font-black text-white italic tracking-tight">{subscription.planDetails.name}</h4>
                                        <p className="text-[#FF4D00] font-bold mt-1 text-lg">
                                            {formatPrice(subscription.planDetails.price)} <span className="text-white/40 text-sm">/ {subscription.planDetails.period}</span>
                                        </p>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-white/10">
                                        <p className="flex items-center justify-between text-sm">
                                            <span className="text-white/50">Started</span>
                                            <span className="font-medium">{subscription.createdAt ? new Date((subscription.createdAt as any).toDate?.() || subscription.createdAt).toLocaleDateString() : 'N/A'}</span>
                                        </p>
                                        {subscription.nextBillingDate && (
                                            <p className="flex items-center justify-between text-sm">
                                                <span className="text-white/50">Renews</span>
                                                <span className="font-medium text-white">{new Date((subscription.nextBillingDate as any).toDate?.() || subscription.nextBillingDate).toLocaleDateString()}</span>
                                            </p>
                                        )}
                                    </div>

                                    <Link href="/billing" className="w-full mt-4 block text-center px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-colors">
                                        View Details
                                    </Link>
                                </div>
                            ) : (
                                <div className="relative z-10 flex flex-col items-center justify-center text-center py-6">
                                    <Briefcase className="w-10 h-10 text-white/20 mb-4" />
                                    <h4 className="text-xl font-bold mb-2">Hobby Plan</h4>
                                    <p className="text-white/50 text-sm mb-6">You are currently on the free tier.</p>
                                    <Link href="/#pricing" className="w-full px-4 py-3 bg-gradient-to-r from-[#FF4D00] to-orange-600 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-[#FF4D00]/20 transition-all text-center">
                                        Upgrade Now
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
