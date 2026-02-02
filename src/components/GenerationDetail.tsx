"use client";

import { X, Download, Volume2, Film, FileText } from 'lucide-react';
import type { GenerationMetadata } from '../services/GenerationMetadataService';

interface GenerationDetailProps {
    generation: GenerationMetadata;
    onClose: () => void;
}

export default function GenerationDetail({ generation, onClose }: GenerationDetailProps) {
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const handleDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-custom-bg border border-custom-orange/30 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-custom-bg border-b border-custom-orange/20 p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-custom-cream mb-1">
                            {generation.title}
                        </h2>
                        <p className="text-sm text-custom-cream/60">
                            Created {formatDate(generation.createdAt)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-custom-cream/5 hover:bg-custom-cream/10 rounded-xl transition-all"
                    >
                        <X className="w-6 h-6 text-custom-cream" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Description */}
                    <div>
                        <h3 className="text-lg font-bold text-custom-orange mb-2 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Description
                        </h3>
                        <p className="text-custom-cream/80 leading-relaxed">
                            {generation.description}
                        </p>
                    </div>

                    {/* Final Video */}
                    {generation.files.finalVideo && (
                        <div>
                            <h3 className="text-lg font-bold text-custom-orange mb-3 flex items-center gap-2">
                                <Film className="w-5 h-5" />
                                Final Video
                            </h3>
                            <div className="bg-black rounded-xl overflow-hidden mb-4">
                                <video
                                    src={generation.files.finalVideo}
                                    controls
                                    className="w-full aspect-video"
                                >
                                    Your browser does not support video playback.
                                </video>
                            </div>
                            <button
                                onClick={() => handleDownload(generation.files.finalVideo!, `${generation.title.replace(/\s+/g, '_')}.mp4`)}
                                className="w-full px-6 py-3 bg-custom-orange hover:bg-orange-600 text-custom-cream font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                Download Final Video
                            </button>
                        </div>
                    )}

                    {/* Audio */}
                    {generation.files.audio && (
                        <div>
                            <h3 className="text-lg font-bold text-custom-orange mb-3 flex items-center gap-2">
                                <Volume2 className="w-5 h-5" />
                                Narration Audio
                            </h3>
                            <div className="bg-custom-cream/5 border border-custom-orange/20 rounded-xl p-4 mb-3">
                                <audio
                                    src={generation.files.audio}
                                    controls
                                    className="w-full"
                                    style={{
                                        filter: 'sepia(20%) saturate(200%) hue-rotate(350deg)',
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => handleDownload(generation.files.audio!, `${generation.title.replace(/\s+/g, '_')}_audio.mp3`)}
                                className="w-full px-4 py-2 bg-custom-cream/5 hover:bg-custom-cream/10 text-custom-cream font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Download Audio
                            </button>
                        </div>
                    )}

                    {/* Individual Videos */}
                    {generation.files.videos && generation.files.videos.length > 0 && (
                        <div>
                            <h3 className="text-lg font-bold text-custom-orange mb-3 flex items-center gap-2">
                                <Film className="w-5 h-5" />
                                Individual Scenes ({generation.files.videos.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {generation.files.videos.map((videoUrl, index) => (
                                    <div key={index} className="bg-custom-cream/5 border border-custom-orange/20 rounded-xl overflow-hidden">
                                        <video
                                            src={videoUrl}
                                            controls
                                            className="w-full aspect-video bg-black"
                                        >
                                            Your browser does not support video playback.
                                        </video>
                                        <div className="p-3">
                                            <p className="text-sm font-medium text-custom-cream mb-2">
                                                Scene {index + 1}
                                            </p>
                                            <button
                                                onClick={() => handleDownload(videoUrl, `${generation.title.replace(/\s+/g, '_')}_scene_${index + 1}.mp4`)}
                                                className="w-full px-3 py-1.5 bg-custom-cream/5 hover:bg-custom-cream/10 text-custom-cream text-sm rounded-lg transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="bg-custom-cream/5 border border-custom-orange/20 rounded-xl p-4">
                        <h3 className="text-lg font-bold text-custom-orange mb-3">
                            Metadata
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-custom-cream/60 mb-1">Status</p>
                                <p className="text-custom-cream font-medium capitalize">
                                    {generation.status}
                                </p>
                            </div>
                            <div>
                                <p className="text-custom-cream/60 mb-1">Duration</p>
                                <p className="text-custom-cream font-medium">
                                    {generation.duration > 0 ? `${generation.duration}s` : 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-custom-cream/60 mb-1">Session ID</p>
                                <p className="text-custom-cream font-medium font-mono text-xs">
                                    {generation.sessionId}
                                </p>
                            </div>
                            <div>
                                <p className="text-custom-cream/60 mb-1">Last Updated</p>
                                <p className="text-custom-cream font-medium">
                                    {formatDate(generation.updatedAt)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
