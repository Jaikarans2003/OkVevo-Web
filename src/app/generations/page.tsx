"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, Loader2, History, Search, Filter, Grid, List, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getUserGenerations, getOrganisationGenerations } from '../../services/GenerationMetadataService';
import type { GenerationMetadata } from '../../services/GenerationMetadataService';
import GenerationCard from '../../components/GenerationCard';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import NoiseOverlay from '../../components/NoiseOverlay';

function GenerationsPageContent() {
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
                    <p className={`${tc.text} text-lg`}>Loading your generations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${tc.bg} ${tc.text} relative`}>
            {resolvedTheme === 'light' && <NoiseOverlay />}

            {/* Header */}
            <header className={`${tc.sidebar} backdrop-blur-md sticky top-0 z-40 relative`}>
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/chat" className="flex items-center gap-3 group">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                width={40}
                                height={40}
                                className="group-hover:scale-110 transition-transform"
                            />
                            <span className="text-2xl font-[family-name:var(--font-museo-moderno)] text-accent-orange">
                                OKVEVO
                            </span>
                        </Link>

                        {/* Theme Toggle & Profile */}
                        <div className="flex items-center gap-3">
                            {/* Theme Toggle */}
                            <button
                                onClick={() => {
                                    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
                                    setTheme(nextTheme);
                                }}
                                className={`p-3 ${resolvedTheme === 'light' ? 'bg-white hover:bg-accent-orange/10' : 'bg-custom-orange/10 hover:bg-custom-orange/20'} rounded-2xl transition-all duration-300 group relative`}
                                title={`Current: ${theme} mode`}
                            >
                                {theme === 'light' ? (
                                    <Moon className={`w-5 h-5 ${tc.text}`} />
                                ) : theme === 'dark' ? (
                                    <svg className={`w-5 h-5 ${tc.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                ) : (
                                    <Sun className={`w-5 h-5 ${tc.text}`} />
                                )}
                                <span className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity`}>
                                    {theme === 'light' ? 'Switch to Dark' : theme === 'dark' ? 'Switch to System' : 'Switch to Light'}
                                </span>
                            </button>

                            {/* Profile */}
                            <Link
                                href="/profile"
                                className="p-3 bg-accent-orange rounded-2xl hover:bg-orange-600 transition-all duration-300 group"
                            >
                                <User className={`w-5 h-5 ${resolvedTheme === 'light' ? 'text-white' : 'text-custom-cream'} group-hover:scale-110 transition-transform`} />
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
                {/* Page Title */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <History className="w-8 h-8 text-accent-orange" />
                        <h1 className={`text-4xl font-bold ${tc.text}`}>Your Generations</h1>
                    </div>
                    <p className={tc.textDim}>
                        View and manage all your AI-generated videos
                    </p>
                </div>

                {/* Filters and Search */}
                <div className="mb-8 space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${tc.textDim}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by title or description..."
                            className={`w-full ${tc.input} px-12 py-3.5 rounded-xl transition-all`}
                        />
                    </div>

                    {/* Filters and View Toggle */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-accent-orange" />
                            <div className="flex gap-2">
                                {(['all', 'completed', 'processing', 'failed'] as const).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filterStatus === status
                                            ? 'bg-accent-orange text-white'
                                            : `${resolvedTheme === 'light' ? 'bg-white border border-text-main/10 text-text-main/60 hover:bg-accent-orange/10' : 'bg-custom-cream/5 text-custom-cream/60 hover:bg-custom-cream/10'}`
                                            }`}
                                    >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div className={`flex items-center gap-2 ${resolvedTheme === 'light' ? 'bg-white border border-text-main/10' : 'bg-custom-cream/5'} rounded-lg p-1`}>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid'
                                    ? 'bg-accent-orange text-white'
                                    : `${tc.textDim} hover:text-accent-orange`
                                    }`}
                            >
                                <Grid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list'
                                    ? 'bg-accent-orange text-white'
                                    : `${tc.textDim} hover:text-accent-orange`
                                    }`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className={`${resolvedTheme === 'light' ? 'bg-red-50 border-2 border-red-200' : 'bg-red-500/10 border border-red-500/20'} rounded-xl p-4 mb-8`}>
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {/* Generations Grid/List */}
                {filteredGenerations.length === 0 ? (
                    <div className="text-center py-16">
                        <History className="w-16 h-16 text-accent-orange/40 mx-auto mb-4" />
                        <h3 className={`text-xl font-bold ${tc.text} mb-2`}>
                            {searchQuery || filterStatus !== 'all'
                                ? 'No generations found'
                                : 'No generations yet'}
                        </h3>
                        <p className={`${tc.textDim} mb-6`}>
                            {searchQuery || filterStatus !== 'all'
                                ? 'Try adjusting your filters or search query'
                                : 'Start creating your first AI-generated video!'}
                        </p>
                        {!searchQuery && filterStatus === 'all' && (
                            <Link
                                href="/chat"
                                className="inline-block px-6 py-3 bg-accent-orange hover:bg-orange-600 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105"
                            >
                                Create Your First Video
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className={
                        viewMode === 'grid'
                            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                            : 'space-y-4'
                    }>
                        {filteredGenerations.map((generation) => (
                            <GenerationCard
                                key={generation.id}
                                generation={generation}
                                viewMode={viewMode}
                                onDelete={() => {
                                    // Remove from local state
                                    setGenerations(prev => prev.filter(g => g.id !== generation.id));
                                }}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function GenerationsPage() {
    return (
        <ThemeProvider>
            <GenerationsPageContent />
        </ThemeProvider>
    );
}
