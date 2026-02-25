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
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import {
    subscribeToGenerations,
    deleteGeneration,
    type TrendGeneration,
} from '@/services/TrendGenerationService';

export default function MyGenerations() {
    const { user } = useAuth();
    const [generations, setGenerations] = useState<TrendGeneration[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    // Real-time Firestore listener
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

    const pendingCount = generations.filter(g => g.status === 'pending').length;

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
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF0080]/10 border border-[#FF0080]/20">
                            <Loader2 className="w-3 h-3 text-[#FF0080] animate-spin" />
                            <span className="text-[10px] font-black text-[#FF0080] uppercase tracking-wider">
                                {pendingCount} Processing
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
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                >
                    <AnimatePresence>
                        {generations.map((gen) => (
                            <motion.div
                                key={gen.jobId}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-[#151518] rounded-2xl border border-white/10 overflow-hidden group"
                            >
                                {/* Card Header */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${gen.status === 'pending' ? 'bg-yellow-400 animate-pulse' :
                                                gen.status === 'complete' ? 'bg-green-400' :
                                                    'bg-red-400'
                                            }`} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{gen.trendTitle}</p>
                                            <p className="text-[10px] text-white/30 uppercase tracking-wider">
                                                {gen.status === 'pending' ? 'Processing...' :
                                                    gen.status === 'error' ? 'Failed' :
                                                        gen.trendType === 'video' ? 'Image + Video' : 'Image'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(gen.jobId); }}
                                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-white/30 hover:text-red-400" />
                                    </button>
                                </div>

                                {/* Card Body */}
                                {gen.status === 'pending' && (
                                    <div className="aspect-[4/3] bg-gradient-to-br from-white/5 to-white/[0.02] flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="w-8 h-8 text-[#FF0080]/40 animate-spin" />
                                        <div className="flex items-center gap-1.5 text-white/20">
                                            <Clock className="w-3 h-3" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                Generating...
                                            </span>
                                        </div>
                                        {/* Shimmer */}
                                        <div className="w-3/4 h-1 rounded-full bg-white/5 overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-transparent via-[#FF0080]/30 to-transparent"
                                                animate={{ x: ['-100%', '200%'] }}
                                                transition={{ duration: 1.5, repeat: Infinity }}
                                                style={{ width: '50%' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {gen.status === 'error' && (
                                    <div className="aspect-[4/3] bg-gradient-to-br from-red-500/5 to-transparent flex flex-col items-center justify-center gap-3 px-6">
                                        <AlertCircle className="w-8 h-8 text-red-400/40" />
                                        <p className="text--xs text-red-400/60 text-center line-clamp-2">
                                            {gen.errorMessage || 'Generation failed'}
                                        </p>
                                    </div>
                                )}

                                {gen.status === 'complete' && gen.imageUrl && (
                                    <>
                                        <div
                                            className="relative aspect-[4/3] cursor-pointer"
                                            onClick={() => setExpandedId(expandedId === gen.jobId ? null : gen.jobId)}
                                        >
                                            <Image
                                                src={gen.imageUrl}
                                                alt={gen.trendTitle}
                                                fill
                                                className="object-cover"
                                            />
                                            {gen.videoUrl && (
                                                <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-1">
                                                    <Video className="w-3 h-3 text-[#FF0080]" />
                                                    <span className="text-[9px] font-bold text-[#FF0080]">VIDEO</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="p-3 flex gap-2">
                                            <button
                                                onClick={() => handleDownload(gen.imageUrl!, `${gen.trendId}-image.png`)}
                                                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors
                                                           flex items-center justify-center gap-1.5 text-xs text-white/50 hover:text-white"
                                            >
                                                <ImageIcon className="w-3 h-3" />
                                                <Download className="w-3 h-3" />
                                            </button>
                                            {gen.videoUrl && (
                                                <button
                                                    onClick={() => handleDownload(gen.videoUrl!, `${gen.trendId}-video.mp4`)}
                                                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors
                                                               flex items-center justify-center gap-1.5 text-xs text-white/50 hover:text-white"
                                                >
                                                    <Video className="w-3 h-3" />
                                                    <Download className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Expanded Overlay */}
            <AnimatePresence>
                {expandedId && (() => {
                    const gen = generations.find(g => g.jobId === expandedId);
                    if (!gen || gen.status !== 'complete') return null;

                    return (
                        <motion.div
                            className="fixed inset-0 z-[150] flex items-center justify-center p-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setExpandedId(null)} />
                            <motion.div
                                className="relative w-full max-w-2xl bg-[#111113] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                            >
                                <div className="flex items-center justify-between p-4 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-[#FF0080]" />
                                        <h3 className="text-sm font-bold text-white">{gen.trendTitle}</h3>
                                    </div>
                                    <button onClick={() => setExpandedId(null)} className="p-2 rounded-lg hover:bg-white/10">
                                        <X className="w-4 h-4 text-white/50" />
                                    </button>
                                </div>

                                <div className="p-4 space-y-4">
                                    {gen.imageUrl && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-white/40 flex items-center gap-1.5">
                                                    <ImageIcon className="w-3 h-3" /> Generated Image
                                                </span>
                                                <button
                                                    onClick={() => handleDownload(gen.imageUrl!, `${gen.trendId}-image.png`)}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                                >
                                                    <Download className="w-3.5 h-3.5 text-white/40" />
                                                </button>
                                            </div>
                                            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
                                                <Image src={gen.imageUrl} alt="Generated" fill className="object-cover" />
                                            </div>
                                        </div>
                                    )}

                                    {gen.videoUrl && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-white/40 flex items-center gap-1.5">
                                                    <Video className="w-3 h-3" /> Generated Video
                                                </span>
                                                <button
                                                    onClick={() => handleDownload(gen.videoUrl!, `${gen.trendId}-video.mp4`)}
                                                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                                >
                                                    <Download className="w-3.5 h-3.5 text-white/40" />
                                                </button>
                                            </div>
                                            <video
                                                src={gen.videoUrl}
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
