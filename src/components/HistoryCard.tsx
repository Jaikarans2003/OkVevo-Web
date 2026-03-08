import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, Download, ExternalLink, ImageIcon, Sparkles, Wand2, Camera, Compass } from 'lucide-react';
import type { UserGeneration } from '../services/HistoryService';

interface HistoryCardProps {
    generation: UserGeneration;
    viewMode: 'grid' | 'list';
}

export default function HistoryCard({ generation, viewMode }: HistoryCardProps) {
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
                        <Image
                            src={generation.thumbnailUrl}
                            alt={generation.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
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
                    <Image
                        src={generation.thumbnailUrl}
                        alt={generation.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
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
