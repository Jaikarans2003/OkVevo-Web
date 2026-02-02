"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, Loader2, History, Search, Filter, Grid, List } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getUserGenerations, getOrganisationGenerations } from '../../services/GenerationMetadataService';
import type { GenerationMetadata } from '../../services/GenerationMetadataService';
import GenerationCard from '../../components/GenerationCard';

export default function GenerationsPage() {
    const router = useRouter();
    const { user, userProfile, loading: authLoading, isAuthenticated } = useAuth();

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
            <div className="min-h-screen bg-custom-bg flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-custom-orange mx-auto mb-4" />
                    <p className="text-custom-cream text-lg">Loading your generations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-custom-bg text-custom-cream">
            {/* Header */}
            <header className="border-b border-custom-orange/20 bg-custom-bg/80 backdrop-blur-md sticky top-0 z-40">
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
                            <span className="text-2xl font-[family-name:var(--font-museo-moderno)] text-custom-orange">
                                OKVEVO
                            </span>
                        </Link>

                        {/* Profile */}
                        <Link
                            href="/profile"
                            className="p-3 bg-custom-orange rounded-2xl hover:bg-orange-600 transition-all duration-300 group"
                        >
                            <User className="w-5 h-5 text-custom-cream group-hover:scale-110 transition-transform" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Page Title */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <History className="w-8 h-8 text-custom-orange" />
                        <h1 className="text-4xl font-bold text-custom-cream">Your Generations</h1>
                    </div>
                    <p className="text-custom-cream/60">
                        View and manage all your AI-generated videos
                    </p>
                </div>

                {/* Filters and Search */}
                <div className="mb-8 space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-custom-cream/40" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by title or description..."
                            className="w-full bg-custom-cream/5 border border-custom-orange/20 rounded-xl px-12 py-3.5 text-custom-cream placeholder:text-custom-cream/30 focus:outline-none focus:border-custom-orange focus:ring-1 focus:ring-custom-orange/50 transition-all"
                        />
                    </div>

                    {/* Filters and View Toggle */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-custom-orange" />
                            <div className="flex gap-2">
                                {(['all', 'completed', 'processing', 'failed'] as const).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filterStatus === status
                                                ? 'bg-custom-orange text-custom-cream'
                                                : 'bg-custom-cream/5 text-custom-cream/60 hover:bg-custom-cream/10'
                                            }`}
                                    >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-2 bg-custom-cream/5 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid'
                                        ? 'bg-custom-orange text-custom-cream'
                                        : 'text-custom-cream/60 hover:text-custom-cream'
                                    }`}
                            >
                                <Grid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list'
                                        ? 'bg-custom-orange text-custom-cream'
                                        : 'text-custom-cream/60 hover:text-custom-cream'
                                    }`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8">
                        <p className="text-red-400">{error}</p>
                    </div>
                )}

                {/* Generations Grid/List */}
                {filteredGenerations.length === 0 ? (
                    <div className="text-center py-16">
                        <History className="w-16 h-16 text-custom-orange/40 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-custom-cream mb-2">
                            {searchQuery || filterStatus !== 'all'
                                ? 'No generations found'
                                : 'No generations yet'}
                        </h3>
                        <p className="text-custom-cream/60 mb-6">
                            {searchQuery || filterStatus !== 'all'
                                ? 'Try adjusting your filters or search query'
                                : 'Start creating your first AI-generated video!'}
                        </p>
                        {!searchQuery && filterStatus === 'all' && (
                            <Link
                                href="/chat"
                                className="inline-block px-6 py-3 bg-custom-orange hover:bg-orange-600 text-custom-cream font-bold rounded-xl transition-all duration-300"
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
