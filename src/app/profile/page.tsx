"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../config/firebase';
import { onAuthStateChanged, User, updateEmail, signOut } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import { getUserSubscription, type SubscriptionWithPlanDetails } from '../../services/SubscriptionService';
import { ArrowLeft, ArrowRight, Loader2, Check, AlertCircle, Edit3, Activity, Phone, LogOut, User as UserIcon, Mail, Crown, Building2, Users, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionWithPlanDetails | null>(null);
    const [affiliateData, setAffiliateData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentDate, setCurrentDate] = useState("");
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    const [formData, setFormData] = useState({
        email: '',
        phoneNumber: '',
        bio: ''
    });

    useEffect(() => {
        const date = new Date();
        setCurrentDate(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const [profileData, subData] = await Promise.all([
                        getUserProfile(currentUser.uid),
                        getUserSubscription(currentUser.uid)
                    ]);
                    setProfile(profileData);
                    setSubscription(subData);
                    
                    // Check if user is an affiliate by email
                    const affiliatesRef = collection(db, 'affiliates');
                    const affiliateQuery = query(affiliatesRef, where('email', '==', currentUser.email));
                    const affiliateSnapshot = await getDocs(affiliateQuery);
                    
                    if (!affiliateSnapshot.empty) {
                        const affiliateDoc = affiliateSnapshot.docs[0];
                        setAffiliateData({
                            id: affiliateDoc.id,
                            ...affiliateDoc.data()
                        });
                    }
                    setFormData({
                        email: profileData?.email || currentUser.email || '',
                        phoneNumber: profileData?.phoneNumber || '',
                        bio: profileData?.bio || ''
                    });
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        setSaving(true);
        setStatus({ type: null, message: '' });

        try {
            if (formData.email !== user.email) {
                try {
                    await updateEmail(user, formData.email);
                } catch (error: any) {
                    if (error.code === 'auth/requires-recent-login') {
                        setStatus({ type: 'error', message: 'Please log out and log back in to change your email.' });
                        setSaving(false);
                        return;
                    } else {
                        throw error;
                    }
                }
            }

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                bio: formData.bio,
                updatedAt: serverTimestamp()
            });

            setProfile(prev => prev ? { ...prev, email: formData.email, phoneNumber: formData.phoneNumber, bio: formData.bio } : null);
            setStatus({ type: 'success', message: 'Saved seamlessly.' });
            
            setTimeout(() => {
                setStatus({ type: null, message: '' });
                setIsEditing(false);
            }, 800);

        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', message: error.message || 'An error occurred.' });
        } finally {
            setSaving(false);
        }
    };
    
    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#FF4D00] animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen w-full bg-black text-white font-sans selection:bg-[#FF4D00]/50 relative overflow-x-hidden">

            {/* High-Fidelity Background System */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-black">
                {/* Primary Orange Core - Boosted Opacity */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,77,0,0.5)_0%,rgba(0,0,0,1)_95%)]" />
                
                {/* Dynamic Accent Lights */}
                <div className="absolute top-[-15%] right-[-10%] w-[700px] h-[700px] bg-[#FF4D00]/20 rounded-full blur-[150px] animate-pulse duration-[animation-duration:8s]" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[800px] h-[800px] bg-[#FF4D00]/10 rounded-full blur-[180px] animate-pulse duration-[animation-duration:12s]" />

                {/* Dot Grid Layer */}
                <div className="absolute inset-0 opacity-[0.4]" 
                    style={{ 
                        backgroundImage: `radial-gradient(rgba(255,255,255,0.75) 1px, transparent 1px)`,
                        backgroundSize: '32px 32px' 
                    }} 
                />
                
                {/* Dark Depth Overlay */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                
                {/* Film Grain Texture */}
                <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none bg-[url('https://res.cloudinary.com/dlbvavyun/image/upload/v1711463133/noise_p8xkzm.png')]" />
            </div>

            <AnimatePresence mode="wait">
                {!isEditing ? (
                    <motion.div 
                        key="display"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                        className="max-w-6xl mx-auto px-6 py-20 flex flex-col items-center relative z-10"
                    >
                        {/* Status Bar */}
                        <div className="absolute top-8 left-6 right-6 flex justify-between items-center w-[calc(100%-48px)]">
                            <Link href="/workspace" className="group flex items-center gap-4 text-white hover:text-[#FF4D00] transition-all">
                                <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center group-hover:border-[#FF4D00] group-hover:bg-[#FF4D00]/10 transition-all duration-500">
                                    <ArrowLeft className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] hidden md:block">Workspace</span>
                            </Link>

                            <div className="flex items-center gap-6">
                                <div className="hidden lg:flex flex-col items-end">
                                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#FF4D00]">Session Active</span>
                                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mt-1">{currentDate}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={handleSignOut}
                                        className="group w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:border-red-500 hover:bg-red-500/10 transition-all duration-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                                        title="Sign Out"
                                    >
                                        <LogOut className="w-4 h-4 text-white/40 group-hover:text-red-500 transition-colors" />
                                    </button>
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="px-10 py-3.5 rounded-full border border-[#FF4D00]/50 bg-black/60 text-white text-[10px] font-black uppercase tracking-[0.3em] hover:bg-[#FF4D00] hover:border-[#FF4D00] transition-all duration-500 shadow-[0_0_40px_rgba(255,77,0,0.2)] backdrop-blur-xl"
                                    >
                                        Modify Profile
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Identity Core */}
                        <section className="flex flex-col items-center text-center gap-8 pt-10">
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3, duration: 1 }}
                                className="w-20 h-20 rounded-full p-[3px] bg-[#FF4D00] shadow-[0_0_50px_rgba(255,77,0,0.5)]"
                            >
                                <div className="w-full h-full bg-black rounded-full flex items-center justify-center overflow-hidden">
                                    <img src="/OKVEVO WithOut BackGrounds/Orange.svg" className="w-10 h-10" alt="Identity" />
                                </div>
                            </motion.div>
                            
                            <div className="flex flex-col gap-4">
                                <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none uppercase font-sans drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
                                    {user.displayName || "Creator"}
                                </h1>
                                <div className="flex flex-col items-center gap-6">
                                    <div className="h-[2.5px] w-16 bg-[#FF4D00] shadow-[0_0_20px_#FF4D00]" />
                                    <p className="text-xl md:text-2xl text-white font-bold tracking-tight lowercase opacity-95 drop-shadow-lg">
                                        {formData.email}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* High-Contrast Stats & Subscription Row */}
                        {(() => {
                            const userTypeConfig = {
                                single:       { label: 'Individual',    icon: Users,     color: '#A855F7', detail: 'Single User Account' },
                                pro:          { label: 'Pro Team',      icon: Crown,     color: '#F59E0B', detail: '5-Seat Team Account' },
                                organisation: { label: 'Organisation',  icon: Building2, color: '#3B82F6', detail: 'Organisation Account' },
                            };
                            const typeKey = (profile?.userType || 'single') as keyof typeof userTypeConfig;
                            const typeInfo = userTypeConfig[typeKey] || userTypeConfig.single;

                            const stats = [
                                {
                                    label: 'Subscription Plan',
                                    value: subscription?.planDetails?.name || 'No Active Plan',
                                    icon: Activity,
                                    color: '#FF4D00',
                                    detail: subscription?.status ? `Status: ${subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}` : 'Active Status'
                                },
                                {
                                    label: 'Account Type',
                                    value: typeInfo.label,
                                    icon: typeInfo.icon,
                                    color: typeInfo.color,
                                    detail: typeInfo.detail
                                },
                                { label: 'Direct Wire', value: formData.phoneNumber || 'Unlinked', icon: Phone, color: '#A855F7', detail: 'Primary Contact' },
                                ...(affiliateData ? [{
                                    label: 'Affiliate Earnings',
                                    value: `₹${affiliateData.totalEarnings || 0}`,
                                    icon: Activity,
                                    color: '#10B981',
                                    detail: `${affiliateData.totalSales || 0} Sales • ${affiliateData.couponCode || 'N/A'}`
                                }] : [])
                            ];

                            return (
                                <>
                                    <section className={`grid grid-cols-1 md:grid-cols-${Math.min(stats.length, 4)} gap-6 w-full mt-24 max-w-6xl`}>
                                        {stats.map((stat, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.5 + (i * 0.1), duration: 0.8 }}
                                                className="relative group border border-white/20 bg-[#0A0A0A]/95 rounded-[32px] p-8 h-64 overflow-hidden flex flex-col items-center justify-center hover:border-[#FF4D00] transition-all duration-500 shadow-2xl"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                                                <div className="relative z-10 flex flex-col items-center text-center gap-5">
                                                    <div
                                                        className="w-14 h-14 rounded-full flex items-center justify-center bg-white/5 border border-white/10 transition-all duration-300"
                                                        style={{ borderColor: `${stat.color}44` }}
                                                    >
                                                        <stat.icon className="w-5 h-5 transition-all duration-500" style={{ color: stat.color }} />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 group-hover:text-white transition-colors">{stat.label}</span>
                                                        <span className="text-lg font-bold text-white tracking-widest leading-tight">{stat.value}</span>
                                                        <span className="text-[8px] font-medium text-white/20 mt-1 uppercase tracking-[0.1em]">{stat.detail}</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </section>

                                    {/* Incomplete Pro Setup Banner */}
                                    {subscription?.planType === 'pro' && !profile?.proOrganisationId && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.75, duration: 0.6 }}
                                            className="w-full max-w-6xl mt-6"
                                        >
                                            <div className="relative w-full border border-[#FF4D00]/40 bg-[#FF4D00]/5 rounded-[32px] px-10 py-8 overflow-hidden shadow-[0_0_60px_rgba(255,77,0,0.08)]">
                                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_50%,rgba(255,77,0,0.08),transparent_60%)] pointer-events-none" />
                                                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                                    <div className="flex items-start gap-5">
                                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#FF4D00]/15 border border-[#FF4D00]/30">
                                                            <Crown className="w-5 h-5 text-[#FF4D00]" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#FF4D00] mb-1">Action Required</p>
                                                            <p className="text-sm font-bold text-white">Complete Your Pro Team Setup</p>
                                                            <p className="text-[11px] text-white/40 mt-1 font-medium tracking-wide">You have an active Pro plan — create or join your Pro team to unlock all features.</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => router.push('/onboarding/pro')}
                                                        className="group flex-shrink-0 flex items-center gap-3 px-8 py-4 rounded-full bg-[#FF4D00] hover:bg-[#FF4D00]/90 text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-300 shadow-[0_0_30px_rgba(255,77,0,0.3)] hover:shadow-[0_0_50px_rgba(255,77,0,0.5)] hover:scale-[1.03]"
                                                    >
                                                        Set Up Pro Team
                                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Team Dashboard CTA — Pro & Organisation only */}
                                    {(profile?.userType === 'pro' || profile?.userType === 'organisation') && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.8, duration: 0.6 }}
                                            className="w-full max-w-6xl mt-6"
                                        >
                                            <Link
                                                href={profile.userType === 'pro' ? '/pro-dashboard' : '/organisation'}
                                                className="group flex items-center justify-between w-full border border-white/10 hover:border-[#FF4D00]/60 bg-[#0A0A0A]/95 hover:bg-[#FF4D00]/5 rounded-[32px] px-10 py-7 transition-all duration-500 shadow-2xl"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div
                                                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                                        style={{ background: `${typeInfo.color}22`, border: `1px solid ${typeInfo.color}44` }}
                                                    >
                                                        <typeInfo.icon className="w-5 h-5" style={{ color: typeInfo.color }} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                                                            {profile.userType === 'pro' ? 'Pro Team' : 'Organisation'}
                                                        </p>
                                                        <p className="text-sm font-bold text-white mt-0.5">
                                                            {profile.userType === 'pro'
                                                                ? profile.proOrganisationName || 'Manage Your Pro Team'
                                                                : profile.organisationName || 'Manage Your Organisation'
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-[#FF4D00] text-[10px] font-black uppercase tracking-[0.3em] group-hover:gap-4 transition-all">
                                                    Open Dashboard
                                                    <ExternalLink className="w-4 h-4" />
                                                </div>
                                            </Link>
                                        </motion.div>
                                    )}
                                </>
                            );
                        })()}



                        {/* Simple Navigation */}
                        <div className="mt-12 opacity-30 flex items-center gap-4 hover:opacity-100 transition-all cursor-pointer">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Powered by</span>
                            <img src="/OKVEVO WithOut BackGrounds/Orange.svg" className="w-10 h-10" alt="Logo" />
                        </div>
                    </motion.div>

                ) : (
                    /* High-Fidelity Edit Deck */
                    <motion.div 
                        key="edit"
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="h-screen w-full flex items-center justify-center p-6 relative z-10"
                    >
                        <div className="w-full max-w-xl flex flex-col gap-14 bg-black/60 border border-white/10 p-16 rounded-[60px] shadow-2xl backdrop-blur-3xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,77,0,0.05)_0%,transparent_50%)]" />
                            
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-4xl font-black tracking-tighter text-white uppercase font-sans">Modify Identity</h1>
                                    <p className="text-white/40 text-sm font-bold tracking-tight uppercase">Update your system credentials.</p>
                                </div>
                                <button 
                                    onClick={() => { setIsEditing(false); setStatus({type:null, message:''}); }}
                                    className="w-14 h-14 rounded-full flex items-center justify-center bg-white/5 text-white/30 hover:bg-white/10 hover:text-white transition-all border border-white/10 group"
                                >
                                    <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="flex flex-col gap-10 relative z-10">
                                <div className="flex flex-col gap-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 ml-8">Primary ID</label>
                                    <input 
                                        type="email" 
                                        required
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        className="w-full bg-black/80 border-[2px] border-white/5 rounded-[35px] px-10 py-6 text-white outline-none focus:border-[#FF4D00] transition-all text-sm font-bold shadow-inner"
                                        placeholder="email@domain.com"
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 ml-8">Direct Phone</label>
                                    <input 
                                        type="tel" 
                                        value={formData.phoneNumber} 
                                        onChange={e => setFormData({...formData, phoneNumber: e.target.value})} 
                                        className="w-full bg-black/80 border-[2px] border-white/5 rounded-[35px] px-10 py-6 text-white outline-none focus:border-[#FF4D00] transition-all text-sm font-bold shadow-inner"
                                        placeholder="+91 . . . . . . . . ."
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 ml-8">Creative Bio</label>
                                    <textarea 
                                        value={formData.bio} 
                                        onChange={e => setFormData({...formData, bio: e.target.value})} 
                                        className="w-full bg-black/80 border-[2px] border-white/5 rounded-[35px] px-10 py-6 text-white outline-none focus:border-[#FF4D00] transition-all text-sm font-bold resize-none min-h-[140px] shadow-inner"
                                        placeholder="Define yourself..."
                                    />
                                </div>

                                {status.message && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                        className={`text-[10px] font-black uppercase tracking-[0.3em] p-6 rounded-[30px] flex items-center justify-center gap-4 ${
                                            status.type === 'success' ? 'bg-[#FF4D00]/10 text-[#FF4D00] border border-[#FF4D00]/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
                                        }`}
                                    >
                                        {status.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        {status.message}
                                    </motion.div>
                                )}

                                <div className="flex flex-col gap-5 pt-4">
                                    <button 
                                        type="submit" 
                                        disabled={saving}
                                        className="w-full bg-white text-black font-black py-6 rounded-[35px] hover:bg-[#FF4D00] hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-[0.4em] text-[12px] shadow-xl"
                                    >
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authorize Update"}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => { setIsEditing(false); setStatus({type:null, message:''}); }}
                                        className="w-full bg-white/5 text-white/40 font-black py-6 rounded-[35px] hover:bg-white/10 hover:text-white/60 transition-all uppercase tracking-[0.4em] text-[12px] border border-white/5"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
