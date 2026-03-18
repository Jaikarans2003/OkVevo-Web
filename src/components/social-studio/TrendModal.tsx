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
                className="relative w-full max-w-4xl bg-[#0d0d0f] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl"
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#FF6B35]/10 flex items-center justify-center text-[#FF6B35]">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{trend.title}</h2>
                            <p className="text-sm text-white/40">{trend.description}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-full hover:bg-white/10 transition-colors border border-white/5">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                <div className="p-8">

                    {/* ── UPLOAD STEP ── */}
                    {step === 'upload' && (
                        <div className="space-y-8">
                            {error && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Full Body Photo Upload */}
                                <div className="space-y-3">
                                    <label className="flex items-center justify-between text-sm font-bold text-white/80 tracking-wide uppercase">
                                        <span>Full Body Photo</span>
                                        <span className="text-[#FF6B35] font-black">*</span>
                                    </label>
                                    <div
                                        className={`relative w-full aspect-video border-2 border-dashed rounded-[1.5rem]
                                                   flex flex-col items-center justify-center cursor-pointer
                                                   transition-all duration-300 overflow-hidden group
                                                   ${bodyPreview ? 'border-[#FF6B35]/40 bg-[#FF6B35]/5' : 'border-white/10 bg-white/[0.02] hover:border-[#FF6B35]/50 hover:bg-[#FF6B35]/5'}`}
                                        onClick={() => bodyInputRef.current?.click()}
                                    >
                                        {bodyPreview ? (
                                            <Image src={bodyPreview} alt="Body Preview" fill className="object-cover" />
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                                    <Upload className="w-5 h-5 text-white/40 group-hover:text-[#FF6B35]" />
                                                </div>
                                                <p className="text-sm text-white/50 group-hover:text-white transition-colors">Upload reference photo</p>
                                                <p className="text-[10px] text-white/20 mt-1 uppercase tracking-widest font-bold">Required for outfit</p>
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
                                <div className="space-y-3">
                                    <label className="flex items-center justify-between text-sm font-bold text-white/40 tracking-wide uppercase">
                                        <span>Face Close-up</span>
                                        <span className="text-[10px] font-medium italic lowercase">(Optional)</span>
                                    </label>
                                    <div
                                        className={`relative w-full aspect-video border-2 border-dashed rounded-[1.5rem]
                                                   flex flex-col items-center justify-center cursor-pointer
                                                   transition-all duration-300 overflow-hidden group
                                                   ${facePreview ? 'border-[#7928CA]/40 bg-[#7928CA]/5' : 'border-white/10 bg-white/[0.02] hover:border-[#7928CA]/50 hover:bg-[#7928CA]/5'}`}
                                        onClick={() => faceInputRef.current?.click()}
                                    >
                                        {facePreview ? (
                                            <Image src={facePreview} alt="Face Preview" fill className="object-cover" />
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                                    <Upload className="w-5 h-5 text-white/40 group-hover:text-[#7928CA]" />
                                                </div>
                                                <p className="text-sm text-white/50 group-hover:text-white transition-colors">Upload face photo</p>
                                                <p className="text-[10px] text-white/20 mt-1 uppercase tracking-widest font-bold">For better accuracy</p>
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
                            </div>

                            <button
                                disabled={!bodyFile || !user?.uid}
                                onClick={handleGenerate}
                                className="w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all
                                           bg-[#FF6B35] text-black
                                           hover:bg-[#FF8C42] hover:shadow-[0_20px_40px_rgba(255,107,53,0.3)]
                                           disabled:opacity-20 disabled:cursor-not-allowed transform active:scale-[0.98]"
                            >
                                <Sparkles className="w-4 h-4 inline mr-2" />
                                Generate Trend
                            </button>
                        </div>
                    )}

                    {/* ── SUBMITTING STEP ── */}
                    {step === 'submitting' && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <Loader2 className="w-10 h-10 text-[#FF6B35] animate-spin" />
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
                                    Check <span className="text-[#FF6B35]">My Generations</span> below for results
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
