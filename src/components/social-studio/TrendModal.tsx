'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, Download, Sparkles, ImageIcon, CheckCircle2, Play, Film, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef } from 'react';
import Image from 'next/image';
import type { TrendDefinition } from '@/data/trendDefinitions';
import { runTrendPipeline, type TrendGeneratedItem, type TrendJobStatus } from '@/services/TrendGenerationService';

const TrendModal = ({ trend, onClose }: { trend: TrendDefinition, onClose: () => void }) => {
    const [step, setStep] = useState<'upload' | 'generating' | 'result'>('upload');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [generatedImages, setGeneratedImages] = useState<TrendGeneratedItem[]>([]);
    const [generatedVideos, setGeneratedVideos] = useState<TrendGeneratedItem[]>([]);
    const [activeResultTab, setActiveResultTab] = useState<'images' | 'videos'>('images');
    const [selectedResultIndex, setSelectedResultIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const runGeneration = async () => {
        if (!uploadedFile) return;

        setStep('generating');
        setProgress(0);
        setStatusText('Uploading your photo...');

        try {
            await runTrendPipeline(
                uploadedFile,
                trend,
                // Status change callback
                (status: TrendJobStatus, detail?: string) => {
                    setStatusText(detail || status);

                    // Map status to progress percentage
                    const progressMap: Record<TrendJobStatus, number> = {
                        'idle': 0,
                        'uploading': 10,
                        'generating-images': 50,
                        'generating-videos': 80,
                        'complete': 100,
                        'error': 100,
                    };
                    setProgress(progressMap[status] || 0);

                    if (status === 'complete' || status === 'error') {
                        setStep('result');
                    }
                },
                // Image update callback
                (images) => {
                    setGeneratedImages(images);
                    // Update progress based on completed images
                    const completed = images.filter(i => i.status === 'complete').length;
                    const total = images.length;
                    if (total > 0) {
                        setProgress(10 + (completed / total) * 60);
                    }
                },
                // Video update callback
                (videos) => {
                    setGeneratedVideos(videos);
                    const completed = videos.filter(v => v.status === 'complete').length;
                    const total = videos.length;
                    if (total > 0) {
                        setProgress(70 + (completed / total) * 30);
                    }
                }
            );
        } catch (error) {
            console.error('Trend generation failed:', error);
            setStatusText('Generation failed. Please try again.');
            setStep('result');
        }
    };

    const completedImages = generatedImages.filter(i => i.status === 'complete');
    const completedVideos = generatedVideos.filter(v => v.status === 'complete');
    const activeResults = activeResultTab === 'images' ? completedImages : completedVideos;
    const activeResult = activeResults[selectedResultIndex];

    const handleDownload = (url: string, filename: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
                className="relative w-full max-w-6xl bg-[#111113] rounded-[3rem] border border-[#222] overflow-hidden flex flex-col md:flex-row shadow-2xl"
                style={{ aspectRatio: step === 'result' ? 'auto' : '21/9', maxHeight: '90vh' }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 z-50 w-12 h-12 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Left: Preview */}
                <div className="flex-1 relative bg-black/40 border-r border-white/5 overflow-hidden min-h-[300px]">
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
                        <div className="flex items-center gap-4 mt-4">
                            <div className="flex items-center gap-1.5 text-white/30">
                                <ImageIcon size={12} />
                                <span className="text-[9px] font-black">{trend.imagePrompts.length} Photos</span>
                            </div>
                            {trend.videoPrompts.length > 0 && (
                                <div className="flex items-center gap-1.5 text-[#FF0080]/60">
                                    <Film size={12} />
                                    <span className="text-[9px] font-black">{trend.videoPrompts.length} Videos</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white"
                        >
                            {trend.type === 'video' ? <Play size={28} fill="currentColor" /> : <ImageIcon size={28} />}
                        </motion.div>
                    </div>
                </div>

                {/* Right: Generation Flow */}
                <div className="flex-1 p-12 flex flex-col justify-center bg-[#0B0B0D] overflow-y-auto">
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
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Upload Your Photo</h3>
                                    <p className="text-xs text-white/40 font-medium">Upload a photo of yourself to apply this trend.</p>
                                </div>

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-video rounded-[2rem] border-2 border-dashed border-[#222] hover:border-[#FF0080]/30 hover:bg-[#FF0080]/5 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer group"
                                >
                                    {uploadedImage ? (
                                        <div className="relative w-full h-full overflow-hidden rounded-[1.8rem]">
                                            <Image src={uploadedImage} alt="upload" fill className="object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Change Photo</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="p-4 rounded-full bg-white/5 border border-white/5 text-white/20 group-hover:text-[#FF0080] transition-colors">
                                                <Upload size={24} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Drop your photo here</span>
                                        </>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />

                                {/* What will be generated */}
                                <div className="space-y-3 border-t border-white/5 pt-6">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20">This trend will generate</span>
                                    <div className="flex flex-wrap gap-2">
                                        {trend.imagePrompts.map((p, i) => (
                                            <div key={i} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                                                <span className="text-[8px] font-black uppercase tracking-wider text-white/40">{p.name}</span>
                                            </div>
                                        ))}
                                        {trend.videoPrompts.map((p, i) => (
                                            <div key={`v-${i}`} className="px-3 py-1.5 rounded-full bg-[#FF0080]/10 border border-[#FF0080]/20">
                                                <span className="text-[8px] font-black uppercase tracking-wider text-[#FF0080]/60">🎥 {p.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    disabled={!uploadedImage}
                                    onClick={runGeneration}
                                    className={`w-full h-16 rounded-full flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] transition-all ${uploadedImage ? 'bg-white text-black hover:scale-[1.02]' : 'bg-white/5 text-white/20 border border-white/5'}`}
                                >
                                    <Sparkles size={16} />
                                    Generate {trend.imagePrompts.length} Photos{trend.videoPrompts.length > 0 ? ` + ${trend.videoPrompts.length} Videos` : ''}
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
                                {/* Circular progress */}
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
                                    <h3 className="text-lg font-black text-white uppercase tracking-widest">{statusText}</h3>
                                    <p className="text-[10px] text-white/30 font-medium">{Math.round(progress)}% complete</p>
                                </div>

                                {/* Live progress grid */}
                                <div className="w-full space-y-3 max-h-[200px] overflow-y-auto">
                                    {generatedImages.map((img, idx) => (
                                        <div key={idx} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5">
                                            <div className={`w-2 h-2 rounded-full ${img.status === 'complete' ? 'bg-green-400' :
                                                    img.status === 'error' ? 'bg-red-400' :
                                                        img.status === 'polling' ? 'bg-yellow-400 animate-pulse' :
                                                            img.status === 'dispatched' ? 'bg-blue-400' :
                                                                'bg-white/20'
                                                }`} />
                                            <ImageIcon size={10} className="text-white/30" />
                                            <span className="text-[9px] font-bold text-white/50 flex-1 text-left">{img.name}</span>
                                            <span className="text-[8px] font-black uppercase tracking-wider text-white/30">{img.status}</span>
                                        </div>
                                    ))}
                                    {generatedVideos.map((vid, idx) => (
                                        <div key={`v-${idx}`} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#FF0080]/5">
                                            <div className={`w-2 h-2 rounded-full ${vid.status === 'complete' ? 'bg-green-400' :
                                                    vid.status === 'error' ? 'bg-red-400' :
                                                        vid.status === 'polling' ? 'bg-yellow-400 animate-pulse' :
                                                            vid.status === 'dispatched' ? 'bg-blue-400' :
                                                                'bg-white/20'
                                                }`} />
                                            <Film size={10} className="text-[#FF0080]/50" />
                                            <span className="text-[9px] font-bold text-white/50 flex-1 text-left">{vid.name}</span>
                                            <span className="text-[8px] font-black uppercase tracking-wider text-white/30">{vid.status}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {step === 'result' && (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center gap-3 text-[#FF0080]">
                                    <CheckCircle2 size={20} />
                                    <h3 className="text-2xl font-black uppercase tracking-tight">Generation Ready</h3>
                                </div>

                                {/* Tab switch for images / videos */}
                                {completedVideos.length > 0 && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setActiveResultTab('images'); setSelectedResultIndex(0); }}
                                            className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeResultTab === 'images' ? 'bg-white text-black' : 'bg-white/5 text-white/40 border border-white/10'
                                                }`}
                                        >
                                            <ImageIcon size={10} className="inline mr-1.5" />
                                            Photos ({completedImages.length})
                                        </button>
                                        <button
                                            onClick={() => { setActiveResultTab('videos'); setSelectedResultIndex(0); }}
                                            className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeResultTab === 'videos' ? 'bg-[#FF0080] text-white' : 'bg-[#FF0080]/10 text-[#FF0080]/60 border border-[#FF0080]/20'
                                                }`}
                                        >
                                            <Film size={10} className="inline mr-1.5" />
                                            Videos ({completedVideos.length})
                                        </button>
                                    </div>
                                )}

                                {/* Main result display */}
                                <div className="aspect-video rounded-[2rem] bg-black overflow-hidden relative group border border-white/10 shadow-2xl">
                                    {activeResult?.type === 'video' && activeResult?.url ? (
                                        <video
                                            src={activeResult.url}
                                            autoPlay loop muted playsInline
                                            className="w-full h-full object-cover"
                                        />
                                    ) : activeResult?.url ? (
                                        <Image
                                            src={activeResult.url}
                                            alt={activeResult.name}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                                            <span className="text-white/20 text-xs font-black uppercase tracking-widest">No results generated</span>
                                        </div>
                                    )}

                                    {/* Navigation arrows */}
                                    {activeResults.length > 1 && (
                                        <>
                                            <button
                                                onClick={() => setSelectedResultIndex(Math.max(0, selectedResultIndex - 1))}
                                                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <button
                                                onClick={() => setSelectedResultIndex(Math.min(activeResults.length - 1, selectedResultIndex + 1))}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </>
                                    )}

                                    {/* Shot name overlay */}
                                    {activeResult && (
                                        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">
                                                {activeResult.name} — {selectedResultIndex + 1}/{activeResults.length}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Thumbnail strip */}
                                {activeResults.length > 1 && (
                                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                        {activeResults.map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedResultIndex(idx)}
                                                className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${idx === selectedResultIndex ? 'border-[#FF0080] scale-105' : 'border-transparent opacity-50 hover:opacity-80'
                                                    }`}
                                            >
                                                {item.type === 'video' ? (
                                                    <div className="w-full h-full bg-[#FF0080]/20 flex items-center justify-center">
                                                        <Play size={12} fill="currentColor" className="text-[#FF0080]" />
                                                    </div>
                                                ) : item.url ? (
                                                    <Image src={item.url} alt={item.name} fill className="object-cover" />
                                                ) : null}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-4">
                                    {activeResult?.url && (
                                        <button
                                            onClick={() => handleDownload(activeResult.url!, `${trend.id}-${activeResult.name}.${activeResult.type === 'video' ? 'mp4' : 'png'}`)}
                                            className="flex-1 h-14 rounded-full bg-white text-black text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                                        >
                                            <Download size={14} />
                                            Download {activeResult.type === 'video' ? 'MP4' : 'Image'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setStep('upload'); setUploadedImage(null); setUploadedFile(null); setGeneratedImages([]); setGeneratedVideos([]); setSelectedResultIndex(0); }}
                                        className="h-14 px-8 rounded-full border border-white/10 bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors"
                                    >
                                        Generate New
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
