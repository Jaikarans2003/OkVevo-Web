"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, Loader2, Wand2, Search, Filter, Grid, List, Sun, Moon, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getUserGenerations, getOrganisationGenerations } from '../../services/GenerationMetadataService';
import type { GenerationMetadata } from '../../services/GenerationMetadataService';
import GenerationCard from '../../components/GenerationCard';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import NoiseOverlay from '../../components/NoiseOverlay';
import { motion, AnimatePresence } from 'framer-motion';

function AIStudioContent() {
    const router = useRouter();
    const { user, userProfile, loading: authLoading, isAuthenticated } = useAuth();
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const [generations, setGenerations] = useState<GenerationMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'processing' | 'completed' | 'failed'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated()) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    // Load generations
    useEffect(() => {
        const loadGenerations = async () => {
            if (!userProfile) return;

            setLoading(true);
            setError(null);

            try {
                let fetchedGenerations: GenerationMetadata[] = [];

                // Check if user is part of an organisation
                if (userProfile.organisationId) {
                    fetchedGenerations = await getOrganisationGenerations(userProfile.organisationId);
                } else if (userProfile.proOrganisationId) {
                    fetchedGenerations = await getOrganisationGenerations(userProfile.proOrganisationId);
                } else {
                    fetchedGenerations = await getUserGenerations(userProfile.uid);
                }

                setGenerations(fetchedGenerations);
            } catch (err) {
                console.error('Failed to load generations:', err);
                setError('Failed to load generations');
            } finally {
                setLoading(false);
            }
        };

        if (userProfile) {
            loadGenerations();
        }
    }, [userProfile]);

    // Filter generations
    const filteredGenerations = generations.filter(gen => {
        // Filter by status
        if (filterStatus !== 'all' && gen.status !== filterStatus) {
            return false;
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                gen.title.toLowerCase().includes(query) ||
                gen.description.toLowerCase().includes(query)
            );
        }

        return true;
    });

    if (authLoading || loading) {
        return (
            <div className={`min-h-screen ${tc.bg} flex items-center justify-center`}>
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-accent-orange mx-auto mb-4" />
                    <p className={`${tc.text} text-lg`}>Loading your studio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${tc.bg} ${tc.text} relative overflow-hidden transition-colors duration-500`}>
            {resolvedTheme === 'light' && <NoiseOverlay />}

            {/* Ambient Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-accent-orange/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2000ms' }} />
            </div>

            {/* Header */}
            <header className={`${tc.sidebar} backdrop-blur-xl sticky top-0 z-40 border-b border-white/5`}>
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/welcome" className="flex items-center gap-3 group">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                width={40}
                                height={40}
                                className="group-hover:scale-110 transition-transform duration-300"
                            />
                            <span className="text-2xl font-[family-name:var(--font-museo-moderno)] text-accent-orange tracking-wide">
                                <span className={resolvedTheme === 'light' ? 'text-black' : 'text-white'}>OK</span>VEVO
                            </span>
                        </Link>

                        {/* Theme Toggle & Profile */}
                        <div className="flex items-center gap-4">
                            {/* Theme Toggle */}
                            <button
                                onClick={() => {
                                    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                                    setTheme(nextTheme);
                                }}
                                className={`p-3 rounded-full transition-all duration-300 group relative ${resolvedTheme === 'light'
                                    ? 'bg-black/5 hover:bg-black/10 text-black'
                                    : 'bg-white/10 hover:bg-white/20 text-white'
                                    }`}
                            >
                                {theme === 'light' ? (
                                    <Moon className="w-5 h-5" />
                                ) : theme === 'dark' ? (
                                    <Sun className="w-5 h-5" />
                                ) : (
                                    <div className="relative">
                                        <Sun className="w-5 h-5 absolute opacity-0 scale-50 transition-all dark:opacity-100 dark:scale-100" />
                                        <Moon className="w-5 h-5 transition-all dark:opacity-0 dark:scale-50" />
                                    </div>
                                )}
                            </button>

                            {/* Profile */}
                            <Link
                                href="/profile"
                                className="p-3 bg-gradient-to-r from-accent-orange to-orange-600 rounded-full hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-300 group"
                            >
                                <User className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
                {/* Page Title & Actions */}
                <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 bg-accent-orange/10 rounded-2xl">
                                <Wand2 className="w-8 h-8 text-accent-orange" />
                            </div>
                            <h1 className="text-5xl md:text-6xl font-black text-accent-orange leading-tight tracking-tight">
                                AI Studio
                            </h1>
                        </div>
                        <p className={`${tc.textDim} text-lg ml-2`}>
                            Your creative space for intelligent generation
                        </p>
                    </div>

                    <Link
                        href="/chat"
                        className="group flex items-center gap-2 px-8 py-4 bg-text-main text-bg-main rounded-full font-bold text-lg hover:scale-105 hover:shadow-xl transition-all duration-300"
                    >
                        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        New Creation
                    </Link>
                </div>

                {/* Filters and Search Bar - Glassmorphism */}
                <div className={`mb-10 p-2 rounded-[2rem] ${resolvedTheme === 'light' ? 'bg-white/60 shadow-xl shadow-black/5' : 'bg-white/5 shadow-xl shadow-black/20'} backdrop-blur-md border border-white/20`}>
                    <div className="flex flex-col lg:flex-row items-center gap-4 p-2">
                        {/* Search */}
                        <div className="relative w-full lg:flex-1">
                            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 ${tc.textDim}`} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search your masterpieces..."
                                className={`w-full bg-transparent border-none focus:ring-0 ${tc.text} placeholder:text-text-dim/40 pl-12 pr-4 py-3 font-medium`}
                            />
                        </div>

                        {/* Divider */}
                        <div className="hidden lg:block w-px h-8 bg-current opacity-10" />

                        {/* Filters */}
                        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-2 lg:pb-0">
                            {(['all', 'completed', 'processing', 'failed'] as const).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${filterStatus === status
                                        ? 'bg-accent-orange text-white shadow-lg shadow-accent-orange/30'
                                        : `${tc.textDim} hover:bg-black/5 dark:hover:bg-white/10`
                                        }`}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* View Toggle */}
                        <div className={`hidden md:flex items-center gap-1 p-1 rounded-xl ${resolvedTheme === 'light' ? 'bg-black/5' : 'bg-white/10'}`}>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-accent-orange' : `${tc.textDim} hover:text-text-main`}`}
                            >
                                <Grid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-accent-orange' : `${tc.textDim} hover:text-text-main`}`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error State */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-8 text-center font-medium"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Generations Grid/List */}
                {filteredGenerations.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-20"
                    >
                        <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 bg-accent-orange/20 blur-2xl rounded-full" />
                            <Sparkles className="w-20 h-20 text-accent-orange relative z-10" />
                        </div>
                        <h3 className={`text-3xl font-bold ${tc.text} mb-3`}>
                            {searchQuery || filterStatus !== 'all'
                                ? 'No creations found'
                                : 'Start Your First Masterpiece'}
                        </h3>
                        <p className={`${tc.textDim} mb-8 text-lg max-w-md mx-auto`}>
                            {searchQuery || filterStatus !== 'all'
                                ? 'Adjust your filters to see more results.'
                                : 'The canvas is empty. Let your imagination run wild in the studio.'}
                        </p>
                        {!searchQuery && filterStatus === 'all' && (
                            <Link
                                href="/chat"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-accent-orange hover:bg-orange-600 text-white font-bold rounded-full transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-accent-orange/40"
                            >
                                <Plus className="w-5 h-5" />
                                Create Video
                            </Link>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        layout
                        className={
                            viewMode === 'grid'
                                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'
                                : 'space-y-6'
                        }
                    >
                        <AnimatePresence>
                            {filteredGenerations.map((generation) => (
                                <motion.div
                                    key={generation.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <GenerationCard
                                        generation={generation}
                                        viewMode={viewMode}
                                        onDelete={() => {
                                            setGenerations(prev => prev.filter(g => g.id !== generation.id));
                                        }}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </main>
        </div>
    );
}

export default function AIStudioPage() {
    return (
        <ThemeProvider>
            <AIStudioContent />
        </ThemeProvider>
    );
}
