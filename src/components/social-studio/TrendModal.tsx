'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import type { TrendDefinition } from '@/data/trendDefinitions';
import { submitTrendJob } from '@/services/TrendGenerationService';
import { useAuth } from '@/hooks/useAuth';

interface TrendModalProps {
    trend: TrendDefinition;
    onClose: () => void;
    onSubmitted?: () => void;
}

export default function TrendModal({ trend, onClose, onSubmitted }: TrendModalProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<'upload' | 'submitting' | 'submitted'>('upload');
    const [bodyPreview, setBodyPreview] = useState<string | null>(null);
    const [facePreview, setFacePreview] = useState<string | null>(null);
    const [bodyFile, setBodyFile] = useState<File | null>(null);
    const [faceFile, setFaceFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const bodyInputRef = useRef<HTMLInputElement>(null);
    const faceInputRef = useRef<HTMLInputElement>(null);

    const handleBodyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBodyFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setBodyPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleFaceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFaceFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setFacePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!bodyFile || !user?.uid) return;
        setStep('submitting');
        setError(null);

        const result = await submitTrendJob(bodyFile, faceFile, trend, user.uid);

        if (result.success) {
            setStep('submitted');
            onSubmitted?.();
            // Auto-close after 3 seconds
            setTimeout(() => onClose(), 3000);
        } else {
            setError(result.error || 'Something went wrong');
            setStep('upload');
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

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

                <div className="p-5">

                    {/* ── UPLOAD STEP ── */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Full Body Photo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    Full Body Photo <span className="text-red-400">*</span>
                                </label>
                                <div
                                    className="relative w-full aspect-[4/3] border-2 border-dashed border-white/20 rounded-xl
                                               flex flex-col items-center justify-center cursor-pointer
                                               hover:border-[#FF0080]/50 transition-colors overflow-hidden"
                                    onClick={() => bodyInputRef.current?.click()}
                                >
                                    {bodyPreview ? (
                                        <Image src={bodyPreview} alt="Body Preview" fill className="object-cover" />
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-white/30 mb-2" />
                                            <p className="text-sm text-white/40">Upload full body photo</p>
                                            <p className="text-xs text-white/30 mt-1">Required for outfit reference</p>
                                        </>
                                    )}
                                    <input
                                        ref={bodyInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleBodyFileSelect}
                                    />
                                </div>
                            </div>

                            {/* Face Photo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    Face Close-up Photo <span className="text-white/40">(Optional)</span>
                                </label>
                                <div
                                    className="relative w-full aspect-[4/3] border-2 border-dashed border-white/20 rounded-xl
                                               flex flex-col items-center justify-center cursor-pointer
                                               hover:border-[#7928CA]/50 transition-colors overflow-hidden"
                                    onClick={() => faceInputRef.current?.click()}
                                >
                                    {facePreview ? (
                                        <Image src={facePreview} alt="Face Preview" fill className="object-cover" />
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-white/30 mb-2" />
                                            <p className="text-sm text-white/40">Upload face close-up</p>
                                            <p className="text-xs text-white/30 mt-1">For better facial accuracy</p>
                                        </>
                                    )}
                                    <input
                                        ref={faceInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFaceFileSelect}
                                    />
                                </div>
                            </div>

                            <button
                                disabled={!bodyFile || !user?.uid}
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

                    {/* ── SUBMITTING STEP ── */}
                    {step === 'submitting' && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <Loader2 className="w-10 h-10 text-[#FF0080] animate-spin" />
                            <p className="text-sm text-white/50">Submitting your generation...</p>
                        </div>
                    )}

                    {/* ── SUBMITTED STEP ── */}
                    {step === 'submitted' && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            >
                                <CheckCircle2 className="w-16 h-16 text-green-400" />
                            </motion.div>
                            <div className="text-center">
                                <p className="text-white font-semibold">Generation Started!</p>
                                <p className="text-sm text-white/40 mt-1">
                                    Check <span className="text-[#FF0080]">My Generations</span> below for results
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/15 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
