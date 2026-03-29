"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../config/firebase';
import { onAuthStateChanged, User, signOut, updateEmail } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getUserProfile } from '../../services/userService';
import type { UserProfile } from '../../services/userService';
import { ArrowLeft, Loader2, Check, AlertCircle, Edit3, Calendar, Activity, ChevronLeft, ChevronRight, LogOut, Phone } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // UI state
    const [currentDate, setCurrentDate] = useState("");

    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    const [formData, setFormData] = useState({
        email: '',
        phoneNumber: '',
        bio: ''
    });

    useEffect(() => {
        const date = new Date();
        setCurrentDate(date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })); // e.g. "26 May"

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const profile = await getUserProfile(currentUser.uid);
                    setUserProfile(profile);
                    setFormData({
                        email: profile?.email || currentUser.email || '',
                        phoneNumber: profile?.phoneNumber || '',
                        bio: profile?.bio || ''
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

            setUserProfile(prev => prev ? { ...prev, email: formData.email, phoneNumber: formData.phoneNumber, bio: formData.bio } : null);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#070707] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#FF4D00] animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    const firstName = user.displayName?.split(' ')[0] || "Creator";

    return (
        <div className="h-screen w-screen bg-[#0C0C0C] text-white font-sans flex flex-col md:flex-row overflow-hidden selection:bg-[#FF4D00]/30 relative">
            
            {/* Minimal Background Lines / Stylings */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <svg className="absolute w-full h-full opacity-10" viewBox="0 0 1000 1000" fill="none">
                    <path d="M-100 200 C 300 100, 400 400, 900 200" stroke="currentColor" strokeWidth="1" />
                    <path d="M-100 600 C 400 700, 300 300, 1100 500" stroke="currentColor" strokeWidth="1" />
                </svg>
            </div>

            <AnimatePresence mode="wait">
                {!isEditing ? (
                    
                    /* DASHBOARD DISPLAY MODE - FULL SCREEN */
                    <motion.div 
                        key="dashboard"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full h-full flex flex-col md:flex-row relative z-10"
                    >
                        {/* LEFT PANEL (Main Dashboard Content) */}
                        <div className="flex-1 bg-transparent p-6 md:p-12 lg:p-20 flex flex-col gap-10 md:gap-14 overflow-y-auto custom-scrollbar">
                            
                            {/* Header Row */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <Link href="/workspace" className="text-white/50 text-xs font-bold tracking-widest uppercase hover:text-white flex items-center gap-2 transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Back to Space
                                </Link>
                                
                                <div className="flex items-center gap-4 self-end md:self-auto">
                                    <div className="flex items-center gap-2 px-5 py-3 rounded-full border border-white/10 bg-transparent text-sm font-semibold text-[#A0A0A0]">
                                        <Calendar className="w-4 h-4 opacity-70" />
                                        {currentDate}
                                    </div>
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="px-6 py-3 rounded-full bg-white text-black text-sm font-bold hover:bg-[#FF4D00] hover:text-white transition-colors"
                                    >
                                        Edit Details
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="mt-3 hidden md:block">
                                    <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[18px] border-l-[#FF4D00] border-b-[12px] border-b-transparent"></div>
                                </div>
                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.1] tracking-tight text-[#EAEAEA]">
                                    Hi, {firstName}.<br />
                                    Workspace Activity 👋
                                </h1>
                            </div>

                            {/* Middle Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto lg:h-[220px]">
                                
                                {/* Purple-ish Card -> Engagement Line Graph */}
                                <div className="bg-[#B9A3E3] rounded-[36px] p-8 text-black flex flex-col relative overflow-hidden group min-h-[220px]">
                                    <div className="flex justify-between items-start z-10">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold tracking-widest text-black/80">ENGAGEMENT</span>
                                            <span className="text-sm font-semibold opacity-70 mt-1">Score</span>
                                        </div>
                                        <div className="px-4 py-2 bg-black rounded-full text-white text-xs font-bold">
                                            85 BPM
                                        </div>
                                    </div>
                                    
                                    <div className="absolute bottom-6 left-0 right-0 h-28 px-6">
                                        <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                                            <path d="M0 20 Q 25 5, 50 20 T 100 20" stroke="black" strokeWidth="1.5" fill="none" />
                                            <circle cx="25" cy="12.5" r="3" fill="black" />
                                            <circle cx="25" cy="12.5" r="6" fill="black" className="animate-ping opacity-30" />
                                            <line x1="25" y1="12.5" x2="25" y2="40" stroke="black" strokeWidth="1" strokeDasharray="3 3" opacity="0.3"/>
                                        </svg>
                                    </div>
                                    
                                    <div className="absolute bottom-6 left-8 right-8 flex justify-between text-xs font-bold opacity-40">
                                        <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span>
                                    </div>
                                </div>

                                {/* Dark Geometric Card -> Account Tier */}
                                <div className="bg-[#1C1C1E] rounded-[36px] p-8 flex items-center justify-center gap-10 border border-white/5 relative min-h-[220px]">
                                    <div className="relative w-24 h-24 flex items-center justify-center opacity-80">
                                        <svg className="w-full h-full text-[#B9A3E3] animate-[spin_20s_linear_infinite]" viewBox="0 0 100 100" fill="none">
                                            <path d="M50 5 Q 75 5, 80 20 T 95 50 T 80 80 T 50 95 T 20 80 T 5 50 T 20 20 T 50 5" stroke="currentColor" strokeWidth="1.5" className="opacity-50"/>
                                            <path d="M50 10 Q 75 10, 85 25 T 90 50 T 85 75 T 50 90 T 15 75 T 10 50 T 15 25 T 50 10" stroke="#FF4D00" strokeWidth="1.5" className="opacity-80"/>
                                        </svg>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[#888] text-sm font-semibold mb-3">Account Plan</span>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-4xl font-bold text-white tracking-tight">Pro</span><span className="text-sm text-[#888]">~</span>
                                            <span className="text-2xl font-bold text-white tracking-tight">Max</span><span className="text-sm text-[#888]">~</span>
                                        </div>
                                        <div className="flex gap-10 text-xs text-[#555] font-bold mt-2">
                                            <span>Tier</span>
                                            <span>Limit</span>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Bottom Wide Bio Block */}
                            <div className="w-full min-h-[240px] bg-[#121212] rounded-[36px] border border-white/5 overflow-hidden flex items-stretch mt-auto relative group">
                                <div className="hidden lg:flex flex-col justify-center px-6 hover:bg-white/5 transition-colors cursor-pointer border-r border-white/5">
                                    <ChevronLeft className="w-6 h-6 text-white/40 group-hover:text-white" />
                                </div>
                                
                                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                                    <div className="w-full md:w-[300px] h-[200px] md:h-full relative shrink-0">
                                        <div className="absolute inset-0 bg-[#FF4D00]/20 rounded-full blur-[60px] top-10" />
                                        <div className="absolute inset-x-0 bottom-0 top-0 md:top-[15%] bg-gradient-to-tr from-[#1A1A1A] to-[#222] rounded-[36px] m-6 overflow-hidden border border-white/5 shadow-inner">
                                            <img src="/weight.png" alt="Profile Story" className="w-full h-full object-cover mix-blend-luminosity opacity-40 group-hover:opacity-80 transition-opacity duration-700" onError={(e) => e.currentTarget.style.display = 'none'}/>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center py-8 pr-10 pl-6 z-10">
                                        <h3 className="text-xl md:text-2xl lg:text-3xl font-medium text-white leading-snug mb-6">
                                            {formData.bio ? `"${formData.bio}"` : "Add a biography to tell the community about your creative workflow and vision."}
                                        </h3>
                                        <button onClick={() => setIsEditing(true)} className="self-start px-6 py-2.5 rounded-full border border-white/10 text-xs uppercase tracking-widest font-bold text-white/50 hover:bg-white hover:text-black transition-colors">
                                            {formData.bio ? "Edit Story" : "Add Bio"}
                                        </button>
                                    </div>
                                </div>

                                <div className="hidden lg:flex flex-col justify-center px-6 hover:bg-white/5 transition-colors cursor-pointer border-l border-white/5">
                                    <ChevronRight className="w-6 h-6 text-white/40 group-hover:text-white" />
                                </div>
                            </div>

                        </div>

                        {/* RIGHT DASHBOARD PANEL (Theme Color Sidebar - FULL HEIGHT) */}
                        <div className="w-full md:w-[380px] lg:w-[460px] shrink-0 bg-[#FF4D00] p-10 lg:p-14 flex flex-col text-black relative overflow-y-auto shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
                            
                            {/* Decorative dots styling */}
                            <div className="absolute top-10 left-10 w-2 h-2 bg-black rounded-full" />
                            <div className="absolute top-16 right-16 w-3 h-3 bg-black rounded-full" />
                            <div className="absolute top-36 left-16 w-1.5 h-1.5 bg-black rounded-full" />
                            <div className="absolute top-28 right-28 w-1 h-1 bg-black rounded-full" />
                            <div className="absolute top-44 right-20 w-1.5 h-1.5 bg-black rounded-full" />
                            
                            {/* Profile Identity */}
                            <div className="mt-12 flex flex-col items-center z-10 w-full">
                                <div className="w-32 h-32 rounded-[28px] border-2 border-black/20 p-1.5 mb-6 relative">
                                    <div className="w-full h-full bg-black/10 rounded-[20px] overflow-hidden flex items-center justify-center shadow-lg">
                                        <img src={user.photoURL || "/OKVEVO WithOut BackGrounds/Black.svg"} className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                                    </div>
                                </div>
                                <div className="text-xl font-bold bg-black/5 px-6 py-2 rounded-full inline-block tracking-tight text-center">
                                    {user.displayName || "MASIV Creator"}
                                </div>
                                <div className="text-sm font-bold text-black/60 mt-3 truncate w-full text-center tracking-wide px-4">
                                    {formData.email}
                                </div>
                            </div>

                            {/* 2x2 Stats Grid for minimal details */}
                            <div className="grid grid-cols-2 gap-4 mt-16 z-10 w-full">
                                <div className="bg-black/5 hover:bg-black/10 transition-colors duration-300 rounded-[24px] p-6 flex flex-col items-center text-center shadow-sm">
                                    <Phone className="w-5 h-5 mb-4 opacity-40" />
                                    <span className="text-sm font-bold tracking-tight truncate w-full">{formData.phoneNumber || "No Phone"}</span>
                                    <span className="text-[10px] font-extrabold opacity-50 mt-1 uppercase tracking-widest">Contact</span>
                                </div>
                                <div className="bg-black/5 hover:bg-black/10 transition-colors duration-300 rounded-[24px] p-6 flex flex-col items-center text-center shadow-sm">
                                    <Activity className="w-5 h-5 mb-4 opacity-40" />
                                    <span className="text-[17px] font-bold tracking-tight text-black">Active</span>
                                    <span className="text-[10px] font-extrabold opacity-50 mt-1 uppercase tracking-widest">Status</span>
                                </div>
                                <div className="bg-black/5 hover:bg-black/10 transition-colors duration-300 rounded-[24px] p-6 flex flex-col items-center text-center shadow-sm">
                                    <span className="text-3xl font-bold mb-1 tracking-tighter">04</span>
                                    <span className="text-[10px] font-extrabold opacity-50 uppercase tracking-widest mt-1">Projects</span>
                                </div>
                                <div className="bg-black/5 hover:bg-black/10 transition-colors duration-300 rounded-[24px] p-6 flex flex-col items-center text-center shadow-sm">
                                    <span className="text-3xl font-medium mb-1 tracking-tighter">∞</span>
                                    <span className="text-[10px] font-extrabold opacity-50 uppercase tracking-widest mt-1">Access</span>
                                </div>
                            </div>

                            {/* Bottom Pulse Chart */}
                            <div className="mt-auto pt-16 z-10 w-full mb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold tracking-widest uppercase opacity-80">Pulse Rate</span>
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-black rounded-full" />
                                        <div className="w-2 h-2 bg-black rounded-full" />
                                    </div>
                                </div>
                                <svg viewBox="0 0 200 40" className="w-full h-12 overflow-visible" fill="none">
                                    <path d="M0 20 L 20 20 L 30 10 L 40 30 L 50 20 L 70 20 L 80 5 L 90 35 L 100 20 L 120 20 L 130 15 L 140 28 L 150 20 L 200 20" stroke="black" strokeWidth="2.5" strokeLinejoin="miter" strokeMiterlimit="2" />
                                </svg>
                            </div>

                        </div>
                    </motion.div>

                ) : (

                    /* MINIMAL EDIT FORM - NOW CENTERED FULLSCREEN */
                    <motion.div 
                        key="edit"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full h-full flex items-center justify-center relative z-10 p-6 md:p-12"
                    >
                        <div className="w-full max-w-xl bg-[#111] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] rounded-[48px] p-10 md:p-14 relative overflow-hidden backdrop-blur-3xl">
                            
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#FF4D00] to-transparent opacity-50" />

                            <div className="flex justify-between items-center mb-12">
                                <button type="button" className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors shadow-inner">
                                    <Edit3 className="w-5 h-5 text-[#FF4D00]" />
                                </button>
                                <button onClick={() => { setIsEditing(false); setStatus({type:null, message:''}); }} className="w-12 h-12 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-full flex items-center justify-center transition-colors shadow-inner">
                                    <LogOut className="w-5 h-5 ml-0.5" />
                                </button>
                            </div>

                            <div className="mb-10 text-center">
                                <h1 className="text-3xl font-bold tracking-tight text-white mb-3">Update Credentials</h1>
                                <p className="text-white/40 text-sm font-medium">Keep your canvas updated.</p>
                            </div>

                            <form onSubmit={handleSave} className="space-y-6">
                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-white/40 uppercase ml-2 group-focus-within:text-[#FF4D00] transition-colors tracking-widest">Email Address</label>
                                    <input 
                                        type="email" 
                                        required
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        className="w-full bg-[#1A1A1A] border-transparent rounded-[24px] px-6 py-5 text-white outline-none focus:ring-2 focus:ring-[#FF4D00]/50 transition-all text-sm font-medium"
                                        placeholder="name@example.com"
                                    />
                                </div>

                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-white/40 uppercase ml-2 group-focus-within:text-[#FF4D00] transition-colors tracking-widest">Phone Number</label>
                                    <input 
                                        type="tel" 
                                        value={formData.phoneNumber} 
                                        onChange={e => setFormData({...formData, phoneNumber: e.target.value})} 
                                        className="w-full bg-[#1A1A1A] border-transparent rounded-[24px] px-6 py-5 text-white outline-none focus:ring-2 focus:ring-[#FF4D00]/50 transition-all text-sm font-medium"
                                        placeholder="+1 (555) 000-0000"
                                    />
                                </div>

                                <div className="space-y-2 group">
                                    <label className="text-xs font-bold text-white/40 uppercase ml-2 group-focus-within:text-[#FF4D00] transition-colors tracking-widest">Biography</label>
                                    <textarea 
                                        value={formData.bio} 
                                        onChange={e => setFormData({...formData, bio: e.target.value})} 
                                        className="w-full bg-[#1A1A1A] border-transparent rounded-[24px] px-6 py-5 text-white outline-none focus:ring-2 focus:ring-[#FF4D00]/50 transition-all text-sm font-medium resize-none min-h-[140px]"
                                        placeholder="Record your workflow or ideas..."
                                    />
                                </div>

                                {status.message && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                        className={`text-xs py-4 px-5 rounded-2xl flex items-center justify-center gap-3 mt-6 font-bold tracking-wide ${
                                            status.type === 'success' ? 'bg-[#FF4D00]/20 text-[#FF4D00]' : 'bg-red-500/20 text-red-500'
                                        }`}
                                    >
                                        {status.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                        {status.message}
                                    </motion.div>
                                )}

                                <div className="pt-6 w-full flex flex-col gap-4">
                                    <button 
                                        type="submit" 
                                        disabled={saving}
                                        className="w-full bg-white text-black font-bold py-5 rounded-[24px] hover:bg-[#FF4D00] hover:text-white transform transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                    >
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => { setIsEditing(false); setStatus({type:null, message:''}); }}
                                        className="w-full bg-white/5 text-white font-bold py-5 rounded-[24px] hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        Cancel Edit
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
