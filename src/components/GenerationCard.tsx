"use client";

import { useState } from 'react';
import { Play, Download, Trash2, Clock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import type { GenerationMetadata } from '../services/GenerationMetadataService';
import { deleteGenerationComplete } from '../services/GenerationMetadataService';
import GenerationDetail from './GenerationDetail';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/themeUtils';

interface GenerationCardProps {
    generation: GenerationMetadata;
    viewMode: 'grid' | 'list';
    onDelete: () => void;
}

export default function GenerationCard({ generation, viewMode, onDelete }: GenerationCardProps) {
    const { resolvedTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);
    const [showDetail, setShowDetail] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!confirm('Are you sure you want to delete this generation? This action cannot be undone.')) {
            return;
        }

        setDeleting(true);
        try {
            await deleteGenerationComplete(generation.id, generation.userId, generation.sessionId);
            onDelete();
        } catch (error) {
            console.error('Failed to delete generation:', error);
            alert('Failed to delete generation. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!generation.files.finalVideo) {
            alert('Final video is not available yet');
            return;
        }

        try {
            const link = document.createElement('a');
            link.href = generation.files.finalVideo;
            link.download = `${generation.title.replace(/\s+/g, '_')}.mp4`;
            link.click();
        } catch (error) {
            console.error('Failed to download video:', error);
            alert('Failed to download video. Please try again.');
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getStatusIcon = () => {
        switch (generation.status) {
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'processing':
                return <Loader2 className="w-5 h-5 text-accent-orange animate-spin" />;
            case 'failed':
                return <AlertCircle className="w-5 h-5 text-red-400" />;
            default:
                return null;
        }
    };

    const getStatusBadge = () => {
        const baseClasses = "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5";

        switch (generation.status) {
            case 'completed':
                return (
                    <span className={`${baseClasses} bg-green-500/20 text-green-400 border border-green-500/30`}>
                        {getStatusIcon()}
                        Completed
                    </span>
                );
            case 'processing':
                return (
                    <span className={`${baseClasses} bg-accent-orange/20 text-accent-orange border border-accent-orange/30`}>
                        {getStatusIcon()}
                        Processing
                    </span>
                );
            case 'failed':
                return (
                    <span className={`${baseClasses} bg-red-500/20 text-red-400 border border-red-500/30`}>
                        {getStatusIcon()}
                        Failed
                    </span>
                );
            default:
                return null;
        }
    };

    if (viewMode === 'list') {
        return (
            <>
                <div
                    onClick={() => setShowDetail(true)}
                    className={`${tc.card} rounded-xl p-4 hover:border-accent-orange transition-all duration-300 cursor-pointer group`}
                >
                    <div className="flex items-center gap-4">
                        {/* Thumbnail */}
                        <div className={`w-32 h-20 ${resolvedTheme === 'light' ? 'bg-text-main/5' : 'bg-custom-bg'} rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                            {generation.files.finalVideo ? (
                                <video
                                    src={generation.files.finalVideo}
                                    className="w-full h-full object-cover"
                                    muted
                                />
                            ) : (
                                <Play className="w-8 h-8 text-accent-orange/40" />
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <h3 className={`text-lg font-bold ${tc.text} mb-1 truncate group-hover:text-accent-orange transition-colors`}>
                                {generation.title}
                            </h3>
                            <p className={`text-sm ${tc.textDim} mb-2 line-clamp-1`}>
                                {generation.description}
                            </p>
                            <div className={`flex items-center gap-4 text-xs ${tc.textDim}`}>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatDate(generation.createdAt)}
                                </span>
                                {generation.duration > 0 && (
                                    <span>{generation.duration}s</span>
                                )}
                            </div>
                        </div>

                        {/* Status and Actions */}
                        <div className="flex items-center gap-3">
                            {getStatusBadge()}

                            {generation.status === 'completed' && generation.files.finalVideo && (
                                <button
                                    onClick={handleDownload}
                                    className={`p-2 ${resolvedTheme === 'light' ? 'bg-accent-orange/10 hover:bg-accent-orange/20' : 'bg-accent-orange/10 hover:bg-accent-orange/20'} rounded-lg transition-all group/btn`}
                                    title="Download"
                                >
                                    <Download className="w-4 h-4 text-accent-orange group-hover/btn:scale-110 transition-transform" />
                                </button>
                            )}

                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all group/btn disabled:opacity-50"
                                title="Delete"
                            >
                                {deleting ? (
                                    <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4 text-red-400 group-hover/btn:scale-110 transition-transform" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {showDetail && (
                    <GenerationDetail
                        generation={generation}
                        onClose={() => setShowDetail(false)}
                    />
                )}
            </>
        );
    }

    // Grid view
    return (
        <>
            <div
                onClick={() => setShowDetail(true)}
                className={`${tc.card} rounded-xl overflow-hidden hover:border-accent-orange transition-all duration-300 cursor-pointer group`}
            >
                {/* Thumbnail */}
                <div className={`aspect-video ${resolvedTheme === 'light' ? 'bg-text-main/5' : 'bg-custom-bg'} flex items-center justify-center relative overflow-hidden`}>
                    {generation.files.finalVideo ? (
                        <>
                            <video
                                src={generation.files.finalVideo}
                                className="w-full h-full object-cover"
                                muted
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-12 h-12 text-white" />
                            </div>
                        </>
                    ) : (
                        <Play className="w-12 h-12 text-accent-orange/40" />
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                        {getStatusBadge()}
                    </div>
                </div>

                {/* Info */}
                <div className="p-4">
                    <h3 className={`text-lg font-bold ${tc.text} mb-2 truncate group-hover:text-accent-orange transition-colors`}>
                        {generation.title}
                    </h3>
                    <p className={`text-sm ${tc.textDim} mb-3 line-clamp-2`}>
                        {generation.description}
                    </p>

                    <div className={`flex items-center justify-between text-xs ${tc.textDim} mb-4`}>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(generation.createdAt)}
                        </span>
                        {generation.duration > 0 && (
                            <span>{generation.duration}s</span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        {generation.status === 'completed' && generation.files.finalVideo && (
                            <button
                                onClick={handleDownload}
                                className={`flex-1 px-4 py-2 bg-accent-orange hover:bg-orange-600 ${resolvedTheme === 'light' ? 'text-white' : 'text-custom-cream'} rounded-lg font-medium transition-all flex items-center justify-center gap-2`}
                            >
                                <Download className="w-4 h-4" />
                                Download
                            </button>
                        )}

                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {deleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {showDetail && (
                <GenerationDetail
                    generation={generation}
                    onClose={() => setShowDetail(false)}
                />
            )}
        </>
    );
}
