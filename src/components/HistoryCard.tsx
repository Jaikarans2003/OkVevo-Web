import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Download, ExternalLink, ImageIcon, Sparkles, Wand2, Camera, Compass, X, Film, Loader2, Clock, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import type { UserGeneration } from '../services/HistoryService';
import type { TrendGeneration, PipelineStatus } from '../services/TrendGenerationService';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

interface HistoryCardProps {
    generation: UserGeneration;
    viewMode: 'grid' | 'list';
}

// Status constants for trend generations
const STATUS_COLORS: Record<PipelineStatus, string> = {
    pending: 'bg-yellow-500',
    'generating-images': 'bg-blue-500',
    'generating-videos': 'bg-purple-500',
    stitching: 'bg-orange-500',
    complete: 'bg-green-500',
    error: 'bg-red-500',
};

const STATUS_LABELS: Record<PipelineStatus, string> = {
    pending: 'Pending',
    'generating-images': 'Generating Images',
    'generating-videos': 'Generating Videos',
    stitching: 'Stitching Video',
    complete: 'Complete',
    error: 'Failed',
};

// Trend Generation Card Component
function TrendGenerationCard({ generation }: { generation: UserGeneration }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [fullTrendData, setFullTrendData] = useState<TrendGeneration | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Fetch full trend data when expanded
    useEffect(() => {
        if (expandedId === generation.id && !fullTrendData) {
            fetchFullTrendData();
        }
    }, [expandedId]);

    // Body scroll lock when modal is open
    useEffect(() => {
        if (expandedId) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [expandedId]);

    const fetchFullTrendData = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, 'trendGenerations', generation.id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as TrendGeneration;
                setFullTrendData(data);
            }
        } catch (error) {
            console.error('Failed to fetch trend data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Use full data if available, otherwise fallback to basic data
    const trendGen = fullTrendData || {
        jobId: generation.id,
        userId: generation.userId,
        trendId: 'sky-fall',
        trendTitle: generation.title,
        status: generation.status as PipelineStatus,
        images: [],
        videos: [],
        finalVideoUrl: generation.videoUrl,
        createdAt: { toDate: () => generation.createdAt } as any,
    };

    const handleDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const completedImages = 5; // Default for SkyFall trend
    const totalImages = 5;
    const completedVideos = 4;
    const totalVideos = 4;
    const isProcessing = trendGen.status !== 'complete' && trendGen.status !== 'error';
    const thumbnailUrl = generation.thumbnailUrl;

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
                    <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[trendGen.status]}`} />
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{trendGen.trendTitle}</p>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">
                            {STATUS_LABELS[trendGen.status]}
                            {trendGen.status === 'generating-images' && ` ${completedImages}/${totalImages}`}
                            {trendGen.status === 'generating-videos' && ` ${completedVideos}/${totalVideos}`}
                        </p>
                    </div>
                </div>
                <button
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                >
                    <Trash2 className="w-3.5 h-3.5 text-white/30 hover:text-red-400" />
                </button>
            </div>

            {/* Card Body */}
            {isProcessing && (
                <div className="aspect-[16/9] bg-gradient-to-br from-white/5 to-white/[0.02] flex flex-col items-center justify-center gap-3 relative">
                    {thumbnailUrl && (
                        <img src={thumbnailUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                    )}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-[#FF0080]/40 animate-spin" />
                        <div className="flex items-center gap-1.5 text-white/40">
                            <Clock className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                {STATUS_LABELS[trendGen.status]}
                                {trendGen.status === 'generating-images' && ` — ${completedImages}/${totalImages}`}
                                {trendGen.status === 'generating-videos' && ` — ${completedVideos}/${totalVideos}`}
                            </span>
                        </div>
                        <div className="w-48 h-1 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-[#FF0080]/50 to-[#FF0080]"
                                initial={{ width: '0%' }}
                                animate={{
                                    width: trendGen.status === 'generating-images' ? `${(completedImages / totalImages) * 50}%`
                                        : trendGen.status === 'generating-videos' ? `${50 + (completedVideos / totalVideos) * 40}%`
                                            : trendGen.status === 'stitching' ? '90%'
                                                : '10%'
                                }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {trendGen.status === 'error' && (
                <div className="aspect-[16/9] bg-gradient-to-br from-red-500/5 to-transparent flex flex-col items-center justify-center gap-3 px-6">
                    <AlertCircle className="w-8 h-8 text-red-400/40" />
                    <p className="text-xs text-red-400/60 text-center line-clamp-2">
                        Generation failed
                    </p>
                </div>
            )}

            {trendGen.status === 'complete' && (
                <>
                    <div className="relative aspect-[16/9] cursor-pointer" onClick={() => setExpandedId(generation.id)}>
                        {thumbnailUrl && (
                            <img src={thumbnailUrl} alt={trendGen.trendTitle} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-3 flex gap-2">
                            <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3 text-blue-400" />
                                <span className="text-[9px] font-bold text-blue-400">{completedImages} Shots</span>
                            </div>
                            {trendGen.finalVideoUrl && (
                                <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center gap-1">
                                    <Film className="w-3 h-3 text-[#FF0080]" />
                                    <span className="text-[9px] font-bold text-[#FF0080]">Final Video</span>
                                </div>
                            )}
                        </div>
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                        </div>
                    </div>

                    <div className="p-3 flex gap-2">
                        <button
                            onClick={() => setExpandedId(generation.id)}
                            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors
                                       flex items-center justify-center gap-1.5 text-xs text-white/50 hover:text-white"
                        >
                            <Sparkles className="w-3 h-3" />
                            View All
                        </button>
                        {trendGen.finalVideoUrl && (
                            <button
                                onClick={() => handleDownload(trendGen.finalVideoUrl!, `skyfall-final.mp4`)}
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

            {/* Expanded Modal */}
            <AnimatePresence>
                {expandedId === generation.id && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
                        onClick={() => setExpandedId(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#151518] rounded-3xl border border-white/10 max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/10 flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold text-white">{trendGen.trendTitle}</h3>
                                    <span className="text-sm text-white/30 uppercase tracking-wider">
                                        {STATUS_LABELS[trendGen.status]}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => setExpandedId(null)} 
                                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5 text-white/50" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 min-h-0 overflow-hidden">
                                {loading ? (
                                    <div className="flex items-center justify-center h-96">
                                        <Loader2 className="w-8 h-8 text-[#FF0080] animate-spin" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col lg:flex-row gap-6 h-full p-6">
                                        {/* Left: Generated Photos */}
                                        <div className="flex-1 lg:flex-[2] overflow-y-auto space-y-4">
                                            {trendGen.images?.some(img => img.url) && (
                                                <div className="space-y-3">
                                                    <span className="text-sm text-white/40 flex items-center gap-1.5">
                                                        <ImageIcon className="w-4 h-4" /> Generated Images ({trendGen.images.filter(i => i.url).length}/{trendGen.images.length})
                                                    </span>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                        {trendGen.images.map((img, i) => (
                                                            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-white/5">
                                                                {img.url ? (
                                                                    <>
                                                                        <img src={img.url} alt={`Shot ${i + 1}`} className="w-full h-full object-cover" />
                                                                        <button
                                                                            onClick={() => handleDownload(img.url!, `skyfall-shot${i + 1}.png`)}
                                                                            className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 transition-colors"
                                                                        >
                                                                            <Download className="w-4 h-4 text-white/60" />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex items-center justify-center h-full">
                                                                        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: Final Video */}
                                        {trendGen.finalVideoUrl && (
                                            <div className="lg:flex-1 overflow-y-auto space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-white/40 flex items-center gap-1.5">
                                                        <Film className="w-4 h-4" /> Final Stitched Video
                                                    </span>
                                                    <button
                                                        onClick={() => handleDownload(trendGen.finalVideoUrl!, `skyfall-final.mp4`)}
                                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                    >
                                                        <Download className="w-4 h-4 text-white/40" />
                                                    </button>
                                                </div>
                                                <video
                                                    src={trendGen.finalVideoUrl}
                                                    controls
                                                    autoPlay
                                                    loop
                                                    className="w-full rounded-xl"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default function HistoryCard({ generation, viewMode }: HistoryCardProps) {
    // Use specialized component for trend generations
    if (generation.type === 'TRENDS') {
        return <TrendGenerationCard generation={generation} />;
    }

    const isCompleted = generation.status === 'complete';
    const isProcessing = !isCompleted && generation.status !== 'error' && generation.status !== 'failed';
    const isFailed = generation.status === 'error' || generation.status === 'failed';

    const getStatusColor = () => {
        if (isCompleted) return 'bg-green-500/10 text-green-500 border-green-500/20';
        if (isFailed) return 'bg-red-500/10 text-red-500 border-red-500/20';
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    };

    const getTypeIcon = () => {
        switch (generation.type) {
            case 'AI_INFLUENCER': return <Wand2 className="w-4 h-4" />;
            case 'DIRECTOR_PHOTOS': return <Camera className="w-4 h-4" />;
            case 'PRODUCT_SHOOTS': return <ImageIcon className="w-4 h-4" />;
            case 'TRENDS': return <Sparkles className="w-4 h-4" />;
            case 'PRODUCT_PLACEMENT': return <Compass className="w-4 h-4" />;
            default: return <Wand2 className="w-4 h-4" />;
        }
    };

    const getTypeLabel = () => {
        switch (generation.type) {
            case 'AI_INFLUENCER': return 'AI Influencer';
            case 'DIRECTOR_PHOTOS': return 'Director Photos';
            case 'PRODUCT_SHOOTS': return 'Product Shoots';
            case 'TRENDS': return 'Trend Generation';
            case 'PRODUCT_PLACEMENT': return 'Product Placement';
            default: return 'Generation';
        }
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const urlToDownload = generation.videoUrl || generation.imageUrl;
        if (!urlToDownload) return;

        // Triggers a download
        const link = document.createElement('a');
        link.href = urlToDownload;
        link.download = `${generation.title.replace(/\s+/g, '_')}_${generation.id}`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleView = () => {
        const urlToView = generation.videoUrl || generation.imageUrl;
        if (urlToView) {
            window.open(urlToView, '_blank');
        }
    };

    if (viewMode === 'list') {
        return (
            <div
                className={`group flex flex-col sm:flex-row gap-6 p-4 rounded-2xl border transition-all duration-300
                    bg-white/5 border-white/10 hover:bg-white/10 hover:border-accent-orange/50 cursor-pointer text-text-main`}
                onClick={handleView}
            >
                {/* Thumbnail */}
                <div className="w-full sm:w-48 aspect-video sm:aspect-square relative rounded-xl overflow-hidden bg-black/20 flex-shrink-0">
                    {generation.thumbnailUrl ? (
                        <img
                            src={generation.thumbnailUrl}
                            alt={generation.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-text-dim">
                            {getTypeIcon()}
                        </div>
                    )}

                    {/* Video Indicator */}
                    {generation.videoUrl && (
                        <div className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-md rounded-lg text-white">
                            <Play className="w-3 h-3" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-between py-2">
                    <div>
                        <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="text-xl font-bold line-clamp-2">{generation.title}</h3>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor()}`}>
                                {generation.status.toUpperCase()}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-text-dim mt-4">
                            <div className="flex items-center gap-1.5 opacity-80">
                                {getTypeIcon()}
                                <span>{getTypeLabel()}</span>
                            </div>
                            <span className="opacity-50">•</span>
                            <span>{new Date(generation.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    {isCompleted && (
                        <div className="flex gap-2 mt-4 sm:mt-0 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={handleDownload}
                                className="p-2 rounded-lg bg-black/5 hover:bg-black/10 text-white transition-colors"
                                title="Download"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleView}
                                className="p-2 rounded-lg bg-accent-orange/10 text-accent-orange hover:bg-accent-orange hover:text-white transition-colors"
                                title="Open externally"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Grid View
    return (
        <div
            className="group flex flex-col bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-accent-orange/50 transition-all duration-300 cursor-pointer text-text-main"
            onClick={handleView}
        >
            {/* Thumbnail */}
            <div className="relative aspect-video w-full bg-black/20 overflow-hidden">
                {generation.thumbnailUrl ? (
                    <img
                        src={generation.thumbnailUrl}
                        alt={generation.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-text-dim">
                        <div className="p-4 rounded-full bg-white/5">
                            {getTypeIcon()}
                        </div>
                    </div>
                )}

                {/* Overlays */}
                <div className="absolute inset-x-0 top-0 p-3 flex justify-between items-start">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-md text-xs font-medium text-white border border-white/10">
                        {getTypeIcon()}
                        <span>{getTypeLabel()}</span>
                    </div>
                    {generation.videoUrl && (
                        <div className="p-1.5 rounded-lg bg-black/50 backdrop-blur-md text-white border border-white/10">
                            <Play className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>

                {/* Status Overlay for non-completed */}
                {!isCompleted && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center border-t border-white/10">
                        <div className={`px-4 py-2 rounded-xl text-sm font-bold border flex items-center gap-2 ${getStatusColor()}`}>
                            {isProcessing && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                            {generation.status.toUpperCase()}
                        </div>
                    </div>
                )}
            </div>

            {/* Content info */}
            <div className="p-5 flex flex-col flex-1">
                <h3 className="text-lg font-bold mb-2 line-clamp-1 group-hover:text-accent-orange transition-colors">
                    {generation.title}
                </h3>

                <div className="flex items-center justify-between text-sm text-text-dim mt-auto">
                    <span>{new Date(generation.createdAt).toLocaleDateString()}</span>

                    {isCompleted && (
                        <div className="flex gap-1.5">
                            <button
                                onClick={handleDownload}
                                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleView}
                                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
