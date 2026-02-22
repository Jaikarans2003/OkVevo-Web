'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Play, Loader2, Download, Zap, Sparkles, ImageIcon, CheckCircle2 } from 'lucide-react';
import { useState, useRef } from 'react';
import Image from 'next/image';

interface Trend {
    id: string;
    title: string;
    description: string;
    image: string;
    tags: string[];
}

const TrendModal = ({ trend, onClose }: { trend: Trend, onClose: () => void }) => {
    const [step, setStep] = useState<'upload' | 'generating' | 'result'>('upload');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const runGeneration = async () => {
        setStep('generating');
        const stages = [
            { text: "Analyzing trend patterns...", wait: 1500 },
            { text: "Applying motion effects...", wait: 2000 },
            { text: "Rendering final video...", wait: 1500 }
        ];

        for (let i = 0; i < stages.length; i++) {
            setStatusText(stages[i].text);
            setProgress(((i + 1) / stages.length) * 100);
            await new Promise(r => setTimeout(r, stages[i].wait));
        }

        setStep('result');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
        >
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-6xl aspect-video md:aspect-[21/9] bg-[#111113] rounded-[3rem] border border-[#222] overflow-hidden flex flex-col md:flex-row shadow-2xl"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 z-50 w-12 h-12 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Left: Preview */}
                <div className="flex-1 relative bg-black/40 border-r border-white/5 overflow-hidden">
                    <Image src={trend.image} alt={trend.title} fill className="object-cover opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                    <div className="absolute inset-0 p-12 flex flex-col justify-end">
                        <div className="flex gap-2 mb-4">
                            {trend.tags.map(tag => (
                                <span key={tag} className="text-[8px] font-black uppercase tracking-[0.2em] text-[#FF0080]">#{tag}</span>
                            ))}
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">{trend.title}</h2>
                        <p className="text-sm text-white/40 max-w-md font-medium leading-relaxed">
                            {trend.description}
                        </p>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white"
                        >
                            <Play size={28} fill="currentColor" />
                        </motion.button>
                    </div>
                </div>

                {/* Right: Generation Flow */}
                <div className="flex-1 p-12 flex flex-col justify-center bg-[#0B0B0D]">
                    <AnimatePresence mode="wait">
                        {step === 'upload' && (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Upload Asset</h3>
                                    <p className="text-xs text-white/40 font-medium">Select one primary image to start the synthesis.</p>
                                </div>

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-video rounded-[2rem] border-2 border-dashed border-[#222] hover:border-[#FF0080]/30 hover:bg-[#FF0080]/5 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer group"
                                >
                                    {uploadedImage ? (
                                        <div className="relative w-full h-full overflow-hidden rounded-[1.8rem]">
                                            <Image src={uploadedImage} alt="upload" fill className="object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Change Image</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="p-4 rounded-full bg-white/5 border border-white/5 text-white/20 group-hover:text-[#FF0080] transition-colors">
                                                <Upload size={24} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Drop your file here</span>
                                        </>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />

                                <button
                                    disabled={!uploadedImage}
                                    onClick={runGeneration}
                                    className={`w-full h-16 rounded-full flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] transition-all ${uploadedImage ? 'bg-white text-black hover:scale-[1.02]' : 'bg-white/5 text-white/20 border border-white/5'}`}
                                >
                                    <Sparkles size={16} />
                                    Synthesize Trend
                                </button>
                            </motion.div>
                        )}

                        {step === 'generating' && (
                            <motion.div
                                key="generating"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center text-center space-y-8"
                            >
                                <div className="relative w-24 h-24">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/5" />
                                        <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray={276} strokeDashoffset={276 - (276 * progress) / 100} className="text-[#FF0080] transition-all duration-300" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 size={24} className="text-white animate-spin" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-xl font-black text-white uppercase tracking-widest">{statusText}</h3>
                                    <div className="flex justify-center gap-1">
                                        {[0, 1, 2].map(i => (
                                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${progress > (i + 1) * 33 ? 'bg-[#FF0080]' : 'bg-white/10'}`} />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 'result' && (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <div className="flex items-center gap-3 text-[#FF0080]">
                                    <CheckCircle2 size={20} />
                                    <h3 className="text-2xl font-black uppercase tracking-tight">Generation Ready</h3>
                                </div>

                                <div className="aspect-video rounded-[2rem] bg-black overflow-hidden relative group border border-white/10 shadow-2xl">
                                    <video
                                        src="https://cdn.pixabay.com/video/2022/02/09/107240-678130070_large.mp4"
                                        autoPlay loop muted playsInline
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Play size={32} fill="white" />
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button className="flex-1 h-14 rounded-full bg-white text-black text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-transform">
                                        <Download size={14} />
                                        Download MP4
                                    </button>
                                    <button
                                        onClick={() => { setStep('upload'); setUploadedImage(null); }}
                                        className="h-14 px-8 rounded-full border border-white/10 bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors"
                                    >
                                        Synthesize Again
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default TrendModal;
