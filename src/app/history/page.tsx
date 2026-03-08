"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, Loader2, Search, Grid, List, Sun, Moon, Sparkles, Plus, History } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getUserHistory, UserGeneration } from '../../services/HistoryService';
import HistoryCard from '../../components/HistoryCard';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import NoiseOverlay from '../../components/NoiseOverlay';
import { motion, AnimatePresence } from 'framer-motion';

function HistoryContent() {
    const router = useRouter();
    const { userProfile, loading: authLoading, isAuthenticated } = useAuth();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [generations, setGenerations] = useState<UserGeneration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('ALL');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Filter categories
    const FILTER_TABS = [
        { id: 'ALL', label: 'All History' },
        { id: 'AI_INFLUENCER', label: 'AI Influencer' },
        { id: 'DIRECTOR_PHOTOS', label: 'Director Photos' },
        { id: 'PRODUCT_SHOOTS', label: 'Product Shoots' },
        { id: 'TRENDS', label: 'Trends' },
        { id: 'PRODUCT_PLACEMENT', label: 'Placements' }
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
                // If the user belongs to an org, you might want to switch orgId here instead of uid depending on the requirements.
                // Assuming history is personal or shared via the collection ID. Use UID as primary for now.
                const hist = await getUserHistory(userProfile.uid, 100);
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
            <div className={`min-h-screen ${tc.bg} flex items-center justify-center`}>
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-accent-orange mx-auto mb-4" />
                    <p className={`${tc.text} text-lg font-medium`}>Gathering your creative history...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${tc.bg} ${tc.text} relative overflow-hidden transition-colors duration-500`}>
            {resolvedTheme === 'light' && <NoiseOverlay />}

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-accent-orange/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2000ms' }} />
            </div>

            {/* Header */}
            <header className={`${tc.sidebar} backdrop-blur-xl sticky top-0 z-40 border-b border-white/5`}>
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/workspace" className="flex items-center gap-3 group">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                width={40}
                                height={40}
                                className="group-hover:scale-110 transition-transform duration-300"
                            />
                            <span className="text-2xl font-bold text-accent-orange tracking-wide">
                                <span className={resolvedTheme === 'light' ? 'text-black' : 'text-white'}>OK</span>VEVO
                            </span>
                        </Link>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                                className={`p-3 rounded-full transition-all duration-300 relative ${resolvedTheme === 'light' ? 'bg-black/5 text-black' : 'bg-white/10 text-white'}`}
                            >
                                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            </button>
                            <Link href="/profile" className="p-3 bg-gradient-to-r from-accent-orange to-orange-600 rounded-full hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-300 group">
                                <User className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
                {/* Title */}
                <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-accent-orange/10 rounded-2xl">
                                <History className="w-8 h-8 text-accent-orange" />
                            </div>
                            <h1 className="text-5xl md:text-6xl font-black text-accent-orange leading-tight tracking-tight">
                                History
                            </h1>
                        </div>
                        <p className={`${tc.textDim} text-lg ml-2`}>
                            Your entire OKVEVO creative legacy in one place
                        </p>
                    </div>

                    <Link
                        href="/workspace"
                        className="group flex items-center gap-2 px-8 py-4 bg-text-main text-bg-main rounded-full font-bold text-lg hover:scale-105 hover:shadow-xl transition-all duration-300"
                    >
                        <Plus className="w-6 h-6" />
                        New Creation
                    </Link>
                </div>

                {/* Filters */}
                <div className="mb-10 p-2 rounded-[2rem] bg-black/5 dark:bg-white/5 shadow-xl shadow-black/20 backdrop-blur-md border border-black/10 dark:border-white/10">
                    <div className="flex flex-col lg:flex-row items-center gap-4 p-2">
                        {/* Search */}
                        <div className="relative w-full lg:flex-1">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-main/50 dark:text-white/50" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by title..."
                                className="w-full bg-transparent border-none focus:ring-0 text-text-main dark:text-white placeholder:text-text-main/50 dark:placeholder:text-white/50 pl-12 pr-4 py-3 font-medium cursor-text"
                            />
                        </div>

                        <div className="hidden lg:block w-px h-8 bg-black/10 dark:bg-white/10" />

                        {/* Tabs */}
                        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-2 lg:pb-0">
                            {FILTER_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilterType(tab.id)}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${filterType === tab.id
                                        ? 'bg-accent-orange text-white shadow-lg shadow-accent-orange/30'
                                        : 'text-text-main/70 hover:text-text-main dark:text-white/70 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* View Toggle */}
                        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-white/20 shadow-sm text-accent-orange' : 'text-text-main/70 hover:text-text-main dark:text-white/70 dark:hover:text-white'}`}
                            >
                                <Grid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/20 shadow-sm text-accent-orange' : 'text-text-main/70 hover:text-text-main dark:text-white/70 dark:hover:text-white'}`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-8 text-center font-medium">
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Content Area */}
                {filteredGenerations.length === 0 ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
                        <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 bg-accent-orange/20 blur-2xl rounded-full" />
                            <Sparkles className="w-20 h-20 text-accent-orange relative z-10" />
                        </div>
                        <h3 className={`text-3xl font-bold ${tc.text} mb-3`}>
                            {searchQuery || filterType !== 'ALL' ? 'No history found' : 'No history yet'}
                        </h3>
                        <p className={`${tc.textDim} mb-8 text-lg max-w-md mx-auto`}>
                            {searchQuery || filterType !== 'ALL' ? 'Try adjusting your filters.' : 'You haven\'t made anything yet. Start creating!'}
                        </p>
                    </motion.div>
                ) : (
                    <motion.div layout className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'flex flex-col gap-4'}>
                        <AnimatePresence>
                            {filteredGenerations.map((gen) => (
                                <motion.div
                                    key={gen.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3 }}
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
    return (
        <ThemeProvider>
            <HistoryContent />
        </ThemeProvider>
    );
}
