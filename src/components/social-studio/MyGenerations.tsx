'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Image as ImageIcon,
    Video,
    Download,
    Trash2,
    Loader2,
    Clock,
    X,
    ChevronDown,
    Sparkles,
    AlertCircle,
    CheckCircle,
    Film,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import {
    subscribeToGenerations,
    deleteGeneration,
    type TrendGeneration,
    type PipelineStatus,
} from '@/services/TrendGenerationService';

const STATUS_LABELS: Record<PipelineStatus, string> = {
    'pending': 'Starting...',
    'generating-images': 'Generating images',
    'generating-videos': 'Generating videos',
    'stitching': 'Stitching final video',
    'complete': 'Complete',
    'error': 'Failed',
};

const STATUS_COLORS: Record<PipelineStatus, string> = {
    'pending': 'bg-yellow-400 animate-pulse',
    'generating-images': 'bg-blue-400 animate-pulse',
    'generating-videos': 'bg-purple-400 animate-pulse',
    'stitching': 'bg-orange-400 animate-pulse',
    'complete': 'bg-green-400',
    'error': 'bg-red-400',
};

export default function MyGenerations() {
    const { user } = useAuth();
    const [generations, setGenerations] = useState<TrendGeneration[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (!user?.uid) return;
        const unsubscribe = subscribeToGenerations(user.uid, setGenerations);
        return () => unsubscribe();
    }, [user?.uid]);

    const handleDownload = async (url: string, filename: string) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch {
            console.error('Download failed');
        }
    };

    const handleDelete = async (jobId: string) => {
        try {
            await deleteGeneration(jobId);
        } catch {
            console.error('Delete failed');
        }
    };

    if (!user?.uid || generations.length === 0) return null;

    const activeCount = generations.filter(g => g.status !== 'complete' && g.status !== 'error').length;

    return (
        <section className="max-w-7xl mx-auto px-6 py-16">
            {/* Header */}
            <div
                className="flex items-center justify-between mb-8 cursor-pointer"
                onClick={() => setCollapsed(!collapsed)}
            >
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white">
                        My <span className="text-white/20">Generations</span>
                    </h2>
                    {activeCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF0080]/10 border border-[#FF0080]/20">
                            <Loader2 className="w-3 h-3 text-[#FF0080] animate-spin" />
                            <span className="text-[10px] font-black text-[#FF0080] uppercase tracking-wider">
                                {activeCount} Active
                            </span>
                        </div>
                    )}
                </div>
                <ChevronDown
                    className={`w-5 h-5 text-white/30 transition-transform ${collapsed ? '' : 'rotate-180'}`}
                />
            </div>

            {/* Grid */}
            {!collapsed && (
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                >
                    <AnimatePresence>
                        {generations.map((gen) => (
                            <GenerationCard
                                key={gen.jobId}
                                gen={gen}
                                onExpand={() => setExpandedId(gen.jobId)}
                                onDelete={() => handleDelete(gen.jobId)}
                                onDownload={handleDownload}
                            />
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Expanded Detail Overlay */}
            <AnimatePresence>
                {expandedId && (() => {
                    const gen = generations.find(g => g.jobId === expandedId);
                    if (!gen) return null;

                    return (
                        <motion.div
                            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setExpandedId(null)} />
                            <motion.div
                                className="relative w-full max-w-3xl bg-[#111113] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-[#FF0080]" />
                                        <h3 className="text-sm font-bold text-white">{gen.trendTitle}</h3>
                                        <span className="text-[10px] text-white/30 uppercase">{STATUS_LABELS[gen.status]}</span>
                                    </div>
                                    <button onClick={() => setExpandedId(null)} className="p-2 rounded-lg hover:bg-white/10">
                                        <X className="w-4 h-4 text-white/50" />
                                    </button>
                                </div>

                                <div className="p-4 space-y-6">
                                    {/* Generated Images Grid */}
                                    {gen.images?.some(img => img.url) && (
                                        <div className="space-y-2">
                                            <span className="text-xs text-white/40 flex items-center gap-1.5">
                                                <ImageIcon className="w-3 h-3" /> Generated Images ({gen.images.filter(i => i.url).length}/{gen.images.length})
                                            </span>
                                            <div className="grid grid-cols-3 gap-2">
                                                {gen.images.map((img, i) => (
                                                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-white/5">
                                                        {img.url ? (
                                                            <>
                                                                <Image src={img.url} alt={`Shot ${i + 1}`} fill className="object-cover" />
                                                                <button
                                                                    onClick={() => handleDownload(img.url!, `skyfall-shot${i + 1}.png`)}
                                                                    className="absolute bottom-1 right-1 p-1 rounded bg-black/60 hover:bg-black/80 transition-colors"
                                                                >
                                                                    <Download className="w-3 h-3 text-white/60" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full">
                                                                <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Final Video */}
                                    {gen.finalVideoUrl && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-white/40 flex items-center gap-1.5">
                                                    <Film className="w-3 h-3" /> Final Stitched Video
                                                </span>
                                                <button
                                                    onClick={() => handleDownload(gen.finalVideoUrl!, `skyfall-final.mp4`)}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                                >
                                                    <Download className="w-3.5 h-3.5 text-white/40" />
                                                </button>
                                            </div>
                                            <video
                                                src={gen.finalVideoUrl}
                                                controls
                                                autoPlay
                                                loop
                                                className="w-full rounded-xl"
                                            />
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
            </AnimatePresence>
        </section>
    );
}

/* ── Generation Card ─────────────────────────────────────────── */

function GenerationCard({
    gen,
    onExpand,
    onDelete,
    onDownload,
}: {
    gen: TrendGeneration;
    onExpand: () => void;
    onDelete: () => void;
    onDownload: (url: string, filename: string) => void;
}) {
    const completedImages = gen.images?.filter(i => i.url).length || 0;
    const totalImages = gen.images?.length || 0;
    const completedVideos = gen.videos?.filter(v => v.url).length || 0;
    const totalVideos = gen.videos?.length || 0;
    const isProcessing = gen.status !== 'complete' && gen.status !== 'error';

    // Find the first completed image for the thumbnail
    const thumbnailUrl = gen.images?.find(i => i.url)?.url;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[#151518] rounded-2xl border border-white/10 overflow-hidden group"
        >
            {/* Card Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[gen.status]}`} />
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{gen.trendTitle}</p>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">
                            {STATUS_LABELS[gen.status]}
                            {gen.status === 'generating-images' && ` ${completedImages}/${totalImages}`}
                            {gen.status === 'generating-videos' && ` ${completedVideos}/${totalVideos}`}
                        </p>
                    </div>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                >
                    <Trash2 className="w-3.5 h-3.5 text-white/30 hover:text-red-400" />
                </button>
            </div>

            {/* Card Body */}
            {isProcessing && (
                <div className="aspect-[16/9] bg-gradient-to-br from-white/5 to-white/[0.02] flex flex-col items-center justify-center gap-3 relative">
                    {/* Show thumbnail if we have one */}
                    {thumbnailUrl && (
                        <Image src={thumbnailUrl} alt="Preview" fill className="object-cover opacity-30" />
                    )}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-[#FF0080]/40 animate-spin" />
                        <div className="flex items-center gap-1.5 text-white/40">
                            <Clock className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                {STATUS_LABELS[gen.status]}
                                {gen.status === 'generating-images' && ` — ${completedImages}/${totalImages}`}
                                {gen.status === 'generating-videos' && ` — ${completedVideos}/${totalVideos}`}
                            </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-48 h-1 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-[#FF0080]/50 to-[#FF0080]"
                                initial={{ width: '0%' }}
                                animate={{
                                    width: gen.status === 'generating-images' ? `${(completedImages / totalImages) * 50}%`
                                        : gen.status === 'generating-videos' ? `${50 + (completedVideos / totalVideos) * 40}%`
                                            : gen.status === 'stitching' ? '90%'
                                                : '10%'
                                }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {gen.status === 'error' && (
                <div className="aspect-[16/9] bg-gradient-to-br from-red-500/5 to-transparent flex flex-col items-center justify-center gap-3 px-6">
                    <AlertCircle className="w-8 h-8 text-red-400/40" />
                    <p className="text-xs text-red-400/60 text-center line-clamp-2">
                        {gen.errorMessage || 'Generation failed'}
                    </p>
                </div>
            )}

            {gen.status === 'complete' && (
                <>
                    <div
                        className="relative aspect-[16/9] cursor-pointer"
                        onClick={onExpand}
                    >
                        {/* Show first image as thumbnail */}
                        {thumbnailUrl && (
                            <Image src={thumbnailUrl} alt={gen.trendTitle} fill className="object-cover" />
                        )}
                        {/* Overlay badges */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-3 flex gap-2">
                            <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3 text-blue-400" />
                                <span className="text-[9px] font-bold text-blue-400">{completedImages} Shots</span>
                            </div>
                            {gen.finalVideoUrl && (
                                <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-1">
                                    <Film className="w-3 h-3 text-[#FF0080]" />
                                    <span className="text-[9px] font-bold text-[#FF0080]">Final Video</span>
                                </div>
                            )}
                        </div>
                        {/* Checkmark */}
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-3 flex gap-2">
                        <button
                            onClick={onExpand}
                            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors
                                       flex items-center justify-center gap-1.5 text-xs text-white/50 hover:text-white"
                        >
                            <Sparkles className="w-3 h-3" />
                            View All
                        </button>
                        {gen.finalVideoUrl && (
                            <button
                                onClick={() => onDownload(gen.finalVideoUrl!, `skyfall-final.mp4`)}
                                className="flex-1 py-2 rounded-lg bg-[#FF0080]/10 hover:bg-[#FF0080]/20 transition-colors
                                           flex items-center justify-center gap-1.5 text-xs text-[#FF0080]/70 hover:text-[#FF0080]"
                            >
                                <Download className="w-3 h-3" />
                                Download Video
                            </button>
                        )}
                    </div>
                </>
            )}
        </motion.div>
    );
}
