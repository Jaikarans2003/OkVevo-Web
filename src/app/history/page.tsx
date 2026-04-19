"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    User, 
    Loader2, 
    Search, 
    Grid, 
    List, 
    Sparkles, 
    Plus, 
    History,
    ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getUserHistory, UserGeneration } from '@/services/HistoryService';
import HistoryCard from '@/components/HistoryCard';
import NoiseOverlay from '@/components/NoiseOverlay';
import StudioNavbar from '@/components/workspace/StudioNavbar';
import { motion, AnimatePresence } from 'framer-motion';

function HistoryContent() {
    const router = useRouter();
    const { userProfile, loading: authLoading, isAuthenticated } = useAuth();

    const [generations, setGenerations] = useState<UserGeneration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Filter categories
    const FILTER_TABS = [
        { id: 'ALL', label: 'All History' },
        // { id: 'AI_INFLUENCER', label: 'AI Influencer' },
       // { id: 'PRODUCT_SHOOTS', label: 'Product Shoots' },
        // { id: 'TRENDS', label: 'Trends' },
       // { id: 'PRODUCT_PLACEMENT', label: 'Placements' }
    ];

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated()) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    // Load generation history
    useEffect(() => {
        const loadHistory = async () => {
            if (!userProfile) return;
            setLoading(true);
            setError(null);
            try {
                const hist = await getUserHistory(userProfile.uid, 200);
                setGenerations(hist);
            } catch (err) {
                console.error('Failed to load history:', err);
                setError('Failed to load history. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        if (userProfile) {
            loadHistory();
        }
    }, [userProfile]);

    // Filter mechanism
    const filteredGenerations = generations.filter(gen => {
        if (filterType !== 'ALL' && gen.type !== filterType) {
            return false;
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return gen.title.toLowerCase().includes(query) || gen.type.toLowerCase().includes(query);
        }
        return true;
    });

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-[#FF4D00] animate-spin" />
            </div>
        );
    }

    const navbarRightContent = (
        <div className="flex items-center gap-4">
            <Link href="/profile" className="p-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all group">
                <User className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            </Link>
        </div>
    );

    // Animation Configs
    const titleLetters = "HISTORY".split('');
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
    };
    const letterVariants = {
        hidden: { opacity: 0, y: 40, filter: 'blur(10px)', scale: 0.8 },
        show: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, transition: { type: 'spring' as const, damping: 12, stiffness: 100 } }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white relative overflow-x-hidden selection:bg-[#FF4D00]/30 selection:text-white pb-32">
            <NoiseOverlay />
            
            {/* Background Image */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <img 
                    src="/images/herobg.png" 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-20 mix-blend-screen"
                />
            </div>

            {/* Studio Navbar */}
            <StudioNavbar rightContent={navbarRightContent} />

            <main className="relative z-10 max-w-7xl mx-auto px-6 py-24 relative">
                {/* Title Section */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-16">
                    <div className="flex flex-col items-center md:items-start">
                        <motion.h1 
                            variants={containerVariants} 
                            initial="hidden" 
                            animate="show" 
                            className="text-5xl md:text-7xl lg:text-8xl font-black leading-none tracking-tight flex"
                        >
                            {titleLetters.map((char, index) => (
                                <motion.span key={index} variants={letterVariants} className="inline-block bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 lowercase first-letter:uppercase">
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
                        <p className="text-white/40 text-lg md:text-xl font-medium mt-4">The OKVEVO Archive: Pure Greatness Only</p>
                    </div>

                    <Link
                        href="/workspace"
                        className="group flex items-center gap-3 px-10 py-5 bg-[#FF4D00] hover:bg-[#e64600] text-white rounded-full font-black uppercase tracking-widest text-sm hover:scale-105 hover:shadow-2xl hover:shadow-[#FF4D00]/20 transition-all duration-300"
                    >
                        <Plus className="w-5 h-5 flex-shrink-0" />
                        Create New
                    </Link>
                </div>

                {/* Filters */}
                <div className="mb-12 p-3 rounded-[3rem] bg-[#111]/80 backdrop-blur-2xl border border-white/10 shadow-3xl">
                    <div className="flex flex-col lg:flex-row items-center gap-6 p-2">
                        {/* Search */}
                        <div className="relative w-full lg:flex-1 group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-[#FF4D00] transition-colors" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search your creations..."
                                className="w-full bg-white/5 border border-white/5 focus:border-[#FF4D00]/30 rounded-2xl pl-14 pr-6 py-4 text-white font-bold outline-none transition-all placeholder:text-white/20"
                            />
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar scroll-smooth">
                            {FILTER_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilterType(tab.id)}
                                    className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${filterType === tab.id
                                        ? 'bg-[#FF4D00] text-white shadow-xl shadow-[#FF4D00]/20'
                                        : 'text-white/50 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="hidden lg:block w-px h-10 bg-white/10" />

                        {/* View Toggle */}
                        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/5">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-[#FF4D00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
                            >
                                <Grid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-[#FF4D00] text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-[2rem] mb-12 text-center font-bold flex items-center justify-center gap-3">
                            <ArrowLeft className="w-5 h-5 rotate-180" /> {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Content Area */}
                {filteredGenerations.length === 0 ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-32 bg-[#111] border border-white/10 rounded-[4rem] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF4D00]/5 rounded-full blur-[100px]" />
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="p-8 bg-white/5 rounded-full mb-8">
                                <Sparkles className="w-16 h-16 text-white/10 group-hover:text-[#FF4D00] transition-colors duration-500" />
                            </div>
                            <h3 className="text-4xl font-black mb-4">
                                {searchQuery || filterType !== 'ALL' ? 'No creations found' : 'No history yet'}
                            </h3>
                            <p className="text-white/40 mb-10 text-xl max-w-md mx-auto">
                                {searchQuery || filterType !== 'ALL' ? 'Try adjusting your filters or search keywords.' : 'The canvas is empty, but your creativity isn\'t. Start your journey today.'}
                            </p>
                            <Link href="/workspace" className="px-10 py-4 bg-white/5 hover:bg-[#FF4D00] border border-white/10 hover:border-transparent rounded-full font-black text-xs uppercase tracking-widest transition-all duration-300">
                                Launch Workspace
                            </Link>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div layout className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8' : 'flex flex-col gap-6'}>
                        <AnimatePresence>
                            {filteredGenerations.map((gen, idx) => (
                                <motion.div
                                    key={gen.id}
                                    layout
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                                >
                                    <HistoryCard generation={gen} viewMode={viewMode} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </main>
        </div>
    );
}

export default function HistoryPage() {
    return <HistoryContent />;
}
