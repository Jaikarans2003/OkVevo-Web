'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    X,
    Upload,
    Loader2,
    Download,
    Image as ImageIcon,
    Video,
    Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import type { TrendDefinition } from '@/data/trendDefinitions';
import { runTrendPipeline, type TrendJobStatus } from '@/services/TrendGenerationService';

interface TrendModalProps {
    trend: TrendDefinition;
    onClose: () => void;
}

export default function TrendModal({ trend, onClose }: TrendModalProps) {
    const [step, setStep] = useState<'upload' | 'generating' | 'result'>('upload');
    const [preview, setPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [status, setStatus] = useState<TrendJobStatus>('idle');
    const [statusDetail, setStatusDetail] = useState('');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!selectedFile) return;
        setStep('generating');

        const result = await runTrendPipeline(
            selectedFile,
            trend,
            (newStatus, detail) => {
                setStatus(newStatus);
                setStatusDetail(detail || '');
            },
        );

        if (result.status === 'complete') {
            setImageUrl(result.imageUrl || null);
            setVideoUrl(result.videoUrl || null);
            setStep('result');
        }
        // on error, stay on generating step — error detail shown via statusDetail
    };

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

    // ── Status icon & label ──

    const statusConfig: Record<TrendJobStatus, { icon: React.ReactNode; label: string; color: string }> = {
        idle: { icon: <Sparkles className="w-5 h-5" />, label: 'Ready', color: 'text-white/50' },
        uploading: { icon: <Upload className="w-5 h-5 animate-pulse" />, label: 'Uploading', color: 'text-blue-400' },
        'generating-image': { icon: <ImageIcon className="w-5 h-5 animate-pulse" />, label: 'Generating Image', color: 'text-purple-400' },
        'generating-video': { icon: <Video className="w-5 h-5 animate-pulse" />, label: 'Generating Video', color: 'text-pink-400' },
        complete: { icon: <Sparkles className="w-5 h-5" />, label: 'Complete', color: 'text-green-400' },
        error: { icon: <X className="w-5 h-5" />, label: 'Error', color: 'text-red-400' },
    };

    const currentStatus = statusConfig[status];

    return (
        <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <motion.div
                className="relative w-full max-w-lg bg-[#111113] border border-white/10 rounded-2xl overflow-hidden"
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-semibold text-white">{trend.title}</h2>
                        <p className="text-sm text-white/50">{trend.description}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">

                    {/* ── UPLOAD STEP ── */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <div
                                className="relative w-full aspect-[4/3] border-2 border-dashed border-white/20 rounded-xl
                                           flex flex-col items-center justify-center cursor-pointer
                                           hover:border-[#FF0080]/50 transition-colors overflow-hidden"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {preview ? (
                                    <Image src={preview} alt="Preview" fill className="object-cover" />
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 text-white/30 mb-2" />
                                        <p className="text-sm text-white/40">Upload your photo</p>
                                    </>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                            </div>

                            <button
                                disabled={!selectedFile}
                                onClick={handleGenerate}
                                className="w-full py-3 rounded-xl font-medium text-sm transition-all
                                           bg-gradient-to-r from-[#FF0080] to-[#7928CA] text-white
                                           hover:shadow-lg hover:shadow-[#FF0080]/25
                                           disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Sparkles className="w-4 h-4 inline mr-2" />
                                Generate
                            </button>
                        </div>
                    )}

                    {/* ── GENERATING STEP ── */}
                    {step === 'generating' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            {status === 'error' ? (
                                <>
                                    <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <X className="w-7 h-7 text-red-400" />
                                    </div>
                                    <p className="text-red-400 text-sm text-center">{statusDetail}</p>
                                    <button
                                        onClick={() => { setStep('upload'); setStatus('idle'); }}
                                        className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/15 transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Loader2 className="w-10 h-10 text-[#FF0080] animate-spin" />
                                    <div className="text-center">
                                        <p className={`text-sm font-medium ${currentStatus.color}`}>
                                            {currentStatus.label}
                                        </p>
                                        <p className="text-xs text-white/40 mt-1">{statusDetail}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── RESULT STEP ── */}
                    {step === 'result' && (
                        <div className="space-y-4">
                            {/* Generated Image */}
                            {imageUrl && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-white/50 flex items-center gap-1.5">
                                            <ImageIcon className="w-4 h-4" /> Generated Image
                                        </span>
                                        <button
                                            onClick={() => handleDownload(imageUrl, `${trend.id}-image.png`)}
                                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                        >
                                            <Download className="w-4 h-4 text-white/50" />
                                        </button>
                                    </div>
                                    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
                                        <Image src={imageUrl} alt="Generated" fill className="object-cover" />
                                    </div>
                                </div>
                            )}

                            {/* Generated Video */}
                            {videoUrl && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-white/50 flex items-center gap-1.5">
                                            <Video className="w-4 h-4" /> Generated Video
                                        </span>
                                        <button
                                            onClick={() => handleDownload(videoUrl, `${trend.id}-video.mp4`)}
                                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                        >
                                            <Download className="w-4 h-4 text-white/50" />
                                        </button>
                                    </div>
                                    <video
                                        src={videoUrl}
                                        controls
                                        autoPlay
                                        loop
                                        className="w-full rounded-xl"
                                    />
                                </div>
                            )}

                            {/* Generate Another */}
                            <button
                                onClick={() => {
                                    setStep('upload');
                                    setPreview(null);
                                    setSelectedFile(null);
                                    setImageUrl(null);
                                    setVideoUrl(null);
                                    setStatus('idle');
                                }}
                                className="w-full py-3 rounded-xl font-medium text-sm
                                           bg-white/10 text-white/70 hover:bg-white/15 transition-colors"
                            >
                                Generate Another
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
