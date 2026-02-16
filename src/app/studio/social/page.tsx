'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    ChevronRight,
    Zap,
    TrendingUp,
    Sparkles,
    Upload,
    Play,
    Loader2,
    X,
    ImageIcon,
    CheckCircle2
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AILoader } from '@/components/ui/ai-loader';

const LIME_ACCENT = '#DFFF00';

interface Template {
    id: string;
    title: string;
    description: string;
    image: string;
    videoUrl?: string;
    trendType: string;
}

const TEMPLATES: Template[] = [
    {
        id: 'ai-expansion',
        title: 'AI Expansion',
        description: 'Expand your photos into immersive landscapes using neural fill.',
        image: 'https://i.pinimg.com/736x/8e/4a/0f/8e4a0f4a8eb9a7f33d7b30c4f8d29837.jpg',
        trendType: 'Expansion'
    },
    {
        id: 'neural-glow',
        title: 'Neural Glow',
        description: 'Dynamic lighting shifts and ethereal aura synthesis.',
        image: 'https://i.pinimg.com/736x/2b/8e/31/2b8e31780447d25e4f48419619198642.jpg',
        trendType: 'Aesthetic'
    },
    {
        id: 'cyberflow',
        title: 'CyberFlow',
        description: 'Transform portraits into high-end cyberpunk cinematics.',
        image: 'https://i.pinimg.com/736x/7d/d2/c1/7dd2c173e396bc75f34f1ff3acd07730.jpg',
        trendType: 'Sci-Fi'
    },
    {
        id: 'luxury-motion',
        title: 'Luxury Motion',
        description: 'Smooth, high-end transitions for fashion and product trends.',
        image: 'https://i.pinimg.com/736x/07/77/8e/07778e354a7c06207865239e24838637.jpg',
        trendType: 'Editorial'
    }
];

export default function SocialStudio() {
    const pathname = usePathname();
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newImages: string[] = [];
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setUploadedImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const handleGenerate = () => {
        if (uploadedImages.length === 0) return;
        setIsGenerating(true);
        // Simulate generation delay
        setTimeout(() => {
            setIsGenerating(false);
            setGeneratedVideo('https://cdn.pixabay.com/video/2022/02/09/107240-678130070_large.mp4');
        }, 4000);
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#DFFF00]/30 selection:text-black pb-20">
            {/* Header Navigation */}
            <nav className="h-24 px-8 flex items-center justify-between border-b border-white/5 sticky top-0 bg-black/80 backdrop-blur-xl z-50">
                <div className="flex items-center gap-12">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO"
                            width={100}
                            height={32}
                            className="opacity-90"
                        />
                    </Link>
                    <div className="hidden lg:flex items-center gap-8">
                        {[
                            { name: 'Product Studio', href: '/studio/product' },
                            { name: 'Social Media', href: '/studio/social' },
                            { name: 'Director', href: '/studio/director' }
                        ].map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`relative text-xs font-black uppercase tracking-[0.2em] transition-all ${pathname === item.href ? 'text-[#DFFF00]' : 'text-white/40 hover:text-white'}`}
                            >
                                {item.name}
                                {pathname === item.href && (
                                    <motion.span
                                        layoutId="nav-glow"
                                        className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#DFFF00]/50 to-transparent"
                                    ></motion.span>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto p-4 md:p-12 space-y-16">
                {/* Hero / Introduction */}
                <header className="space-y-4 max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3"
                    >
                        <div className="w-2 h-2 rounded-full bg-[#DFFF00] animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#DFFF00]">Social Intelligence v5.0</span>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-6xl md:text-8xl font-black leading-[0.85] tracking-tighter uppercase"
                    >
                        AI trend <br />
                        <span className="text-white/20 italic-serif font-normal lowercase">Synthesis studio</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-lg text-white/40 max-w-xl font-medium"
                    >
                        Select a trending AI template, upload your photos, and let our neural engine synthesize
                        viral content ready for Instagram Reels and TikTok.
                    </motion.p>
                </header>

                {/* Template Library */}
                <section className="space-y-8">
                    <div className="flex items-end justify-between">
                        <h2 className="text-2xl font-black uppercase tracking-tight">Trending Templates</h2>
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest tabular-nums">Showing 4 of 48 Models</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {TEMPLATES.map((template, idx) => (
                            <motion.div
                                key={template.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                onClick={() => setSelectedTemplate(template)}
                                className={`group relative h-[500px] rounded-[3rem] overflow-hidden border border-white/5 cursor-pointer bg-[#0A0A0A] transition-all hover:border-[#DFFF00]/30 hover:shadow-[0_0_40px_rgba(223,255,0,0.05)] ${selectedTemplate?.id === template.id ? 'border-[#DFFF00] shadow-[0_0_60px_rgba(223,255,0,0.1)]' : ''}`}
                            >
                                <Image
                                    src={template.image}
                                    alt={template.title}
                                    fill
                                    className="object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-1000"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                                <div className="absolute inset-0 p-8 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-[9px] font-black uppercase tracking-widest">
                                            {template.trendType}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-[#DFFF00] text-black flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-500 shadow-xl">
                                            <Play size={18} fill="currentColor" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">{template.title}</h3>
                                        <p className="text-xs text-white/40 font-medium leading-relaxed max-w-[200px] group-hover:text-white/60 transition-colors">
                                            {template.description}
                                        </p>
                                    </div>
                                </div>

                                <div className={`absolute inset-0 border-2 transition-opacity duration-500 ${selectedTemplate?.id === template.id ? 'border-[#DFFF00] opacity-100' : 'border-[#DFFF00]/0 opacity-0'}`} />
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Workflow Activation Section */}
                <AnimatePresence mode='wait'>
                    {selectedTemplate ? (
                        <motion.section
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 40 }}
                            className="pt-10 scroll-mt-32"
                            id="generation-panel"
                        >
                            <div className="rounded-[4rem] bg-[#0A0A0A] border border-white/5 p-8 md:p-16 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8">
                                    <button
                                        onClick={() => setSelectedTemplate(null)}
                                        className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
                                    {/* Left: Input */}
                                    <div className="space-y-10">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <TrendingUp size={20} className="text-[#DFFF00]" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Synthesizing Trend</span>
                                            </div>
                                            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">{selectedTemplate.title}</h2>
                                        </div>

                                        <div className="space-y-6">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Upload Base Assets</label>
                                            <div className="flex flex-wrap gap-4">
                                                {uploadedImages.map((img, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="relative w-24 h-32 rounded-2xl overflow-hidden border border-white/10"
                                                    >
                                                        <Image src={img} alt="upload" fill className="object-cover" />
                                                        <button
                                                            onClick={() => setUploadedImages(prev => prev.filter((_, idx) => idx !== i))}
                                                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:bg-red-500 transition-colors"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </motion.div>
                                                ))}
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-24 h-32 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-[#DFFF00]/30 hover:bg-[#DFFF00]/5 transition-all text-white/20 hover:text-[#DFFF00]"
                                                >
                                                    <Plus size={20} />
                                                    <span className="text-[8px] font-bold uppercase">Add Photo</span>
                                                </button>
                                            </div>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                multiple
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                            />
                                        </div>

                                        <button
                                            onClick={handleGenerate}
                                            disabled={uploadedImages.length === 0 || isGenerating}
                                            className={`w-full h-20 rounded-full flex items-center justify-center gap-4 text-xs font-black uppercase tracking-[0.3em] transition-all ${uploadedImages.length === 0 || isGenerating ? 'bg-white/5 text-white/20 border border-white/5' : 'bg-[#DFFF00] text-black hover:scale-[1.02] shadow-[0_0_40px_rgba(223,255,0,0.2)]'}`}
                                        >
                                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                            {isGenerating ? 'Synthesizing...' : 'Generate AI Trend Video'}
                                        </button>
                                    </div>

                                    {/* Right: Preview / Result */}
                                    <div className="relative aspect-[9/16] max-h-[600px] h-full rounded-[3rem] overflow-hidden bg-black border border-white/10 group/preview">
                                        <AnimatePresence mode='wait'>
                                            {isGenerating ? (
                                                <motion.div
                                                    key="loading"
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-black/90 backdrop-blur-md z-20"
                                                >
                                                    <AILoader text="Processing Trend" />
                                                </motion.div>
                                            ) : generatedVideo ? (
                                                <motion.div
                                                    key="result"
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                    className="absolute inset-0 z-10"
                                                >
                                                    <video
                                                        src={generatedVideo}
                                                        autoPlay
                                                        loop
                                                        muted
                                                        playsInline
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute bottom-8 left-0 right-0 px-8 flex gap-3">
                                                        <button className="flex-1 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                                                            Download HD
                                                        </button>
                                                        <button
                                                            onClick={() => { setGeneratedVideo(null); setUploadedImages([]); }}
                                                            className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:bg-[#DFFF00] transition-colors"
                                                        >
                                                            <Zap size={20} fill="currentColor" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 space-y-6 opacity-30 group-hover/preview:opacity-50 transition-opacity">
                                                    <div className="w-20 h-20 rounded-full border border-dashed border-white/40 flex items-center justify-center">
                                                        <ImageIcon size={32} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h4 className="text-lg font-bold uppercase tracking-tight">Output Monitor</h4>
                                                        <p className="text-xs max-w-[200px] leading-relaxed">Synthesis pipeline will engage once assets are uploaded.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </AnimatePresence>

                                        {/* Status Strip */}
                                        <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full whitespace-nowrap z-30">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-[#DFFF00] animate-pulse' : 'bg-green-500'}`}></div>
                                                <span className="text-[8px] font-black uppercase tracking-widest text-white/60">System Ready: 9:16 Aspect</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Background Decor */}
                                <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] bg-[#DFFF00]/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-[#DFFF00]/10 transition-colors duration-1000" />
                            </div>
                        </motion.section>
                    ) : (
                        <motion.section
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-20 text-center space-y-8"
                        >
                            <div className="space-y-4">
                                <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none max-w-4xl mx-auto uppercase">
                                    Create viral moments <br />
                                    <span className="text-white/20 italic-serif font-normal lowercase">in seconds, not hours.</span>
                                </h2>
                                <p className="text-sm text-white/40 max-w-xl mx-auto font-medium">
                                    Our experts keep our template library updated with every trending IG/TikTok style.
                                    Just select, upload, and dominate the feed.
                                </p>
                            </div>
                            <div className="flex justify-center gap-6">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#DFFF00]">
                                    <CheckCircle2 size={12} /> Fresh Styles Weekly
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#DFFF00]">
                                    <CheckCircle2 size={12} /> 4K Neural Export
                                </div>
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>

                {/* Event Section (Moved to Bottom as Secondary) */}
                <div className="space-y-12 pt-10 px-4 md:px-0">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <h2 className="text-4xl font-black tracking-tighter uppercase leading-[0.8]">
                            Creator <br />
                            <span className="text-white/20 italic-serif font-normal lowercase">Insights 2026</span>
                        </h2>
                        <button className="h-12 px-8 rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
                            View All Events
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { title: "Viral Scaling", date: "12 Mar", desc: "Workshop on mastering the Instagram algorithm shifts." },
                            { title: "Neural Content", date: "29 May", desc: "Using AI to maintain consistent visual identity." },
                            { title: "Growth Forum", date: "06 Jun", desc: "Direct consultation with viral content strategists." }
                        ].map((event, i) => (
                            <div key={i} className="group p-8 rounded-[2.5rem] bg-[#0A0A0A] border border-white/5 hover:border-[#DFFF00]/20 transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="text-[10px] font-black text-[#DFFF00] tracking-widest uppercase tabular-nums">{event.date}</span>
                                    <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 group-hover:bg-[#DFFF00] group-hover:text-black transition-all shadow-lg">
                                        <ChevronRight size={14} />
                                    </div>
                                </div>
                                <h3 className="text-xl font-black uppercase tracking-tight mb-2">{event.title}</h3>
                                <p className="text-xs text-white/30 font-medium leading-relaxed group-hover:text-white/50 transition-colors">{event.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Noir Footer */}
            <footer className="mt-40 bg-[#0A0A0A] rounded-[40px] mx-4 md:mx-8 p-12 md:p-20 relative overflow-hidden border border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-start gap-12 relative z-10">
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#DFFF00]">Stay Connected</h3>
                        <p className="text-2xl md:text-3xl font-black tracking-tighter max-w-sm">
                            SUBSCRIBE TO LEARN MORE <br />
                            <span className="text-white/20 italic-serif font-normal lowercase">about our methods</span>
                        </p>
                    </div>
                    <div className="flex-1 max-w-md w-full flex flex-col sm:flex-row gap-3">
                        <input
                            type="email"
                            placeholder="Enter e-mail"
                            className="bg-white/5 border border-white/10 rounded-full px-8 h-14 text-sm focus:outline-none focus:border-[#DFFF00]/50 transition-colors flex-1"
                        />
                        <button className="h-14 px-8 rounded-full bg-[#DFFF00] text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all outline-none">
                            Subscribe
                        </button>
                    </div>
                </div>

                <div className="mt-20 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 relative z-10">
                    <p className="text-[10px] font-bold text-white/20 tracking-widest uppercase">© 2026 OKVEVO. All Rights Reserved.</p>
                    <div className="flex gap-12 font-bold text-[10px] text-white/20 uppercase tracking-widest">
                        <Link href="#" className="hover:text-white transition-colors">Telegram</Link>
                        <Link href="#" className="hover:text-white transition-colors">Instagram</Link>
                        <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
                    </div>
                </div>

                <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[50%] bg-[#DFFF00]/2 blur-[100px] rounded-full pointer-events-none" />
            </footer>
        </div>
    );
}
