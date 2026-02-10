'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
    Settings,
    Play,
    Film,
    Layers,
    Cpu,
    Sparkles,
    Zap,
    Image as ImageIcon,
    Type,
    MousePointer,
    Move3d,
    Palette,
    CheckCircle2,
    Loader2,
    Instagram,
    Youtube,
    Twitter,
    Facebook,
    MonitorPlay,
    Share2,
    Download,
    ChevronDown,
    ArrowDown,
    Aperture,
    Maximize2,
    Scan
} from 'lucide-react';

// --- Components ---
function ShowcaseCard({ videoSrc, title, category, className = "" }: { videoSrc: string, title: string, category: string, className?: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (!videoRef.current) return;
        if (isHovered) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { });
            }
        } else {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, [isHovered]);

    return (
        <div
            className={`relative group rounded-3xl overflow-hidden bg-[#0A0A0A] border border-white/5 cursor-pointer ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <video
                ref={videoRef}
                src={videoSrc}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${isHovered ? 'opacity-100 scale-110 blur-0' : 'opacity-40 scale-100 blur-[2px]'}`}
                muted
                loop
                playsInline
            />
            <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent transition-opacity duration-700 ${isHovered ? 'opacity-90' : 'opacity-60'}`} />

            <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <div className="overflow-hidden">
                    <motion.p
                        initial={false}
                        animate={{ y: isHovered ? 0 : 20, opacity: isHovered ? 1 : 0.4 }}
                        className="text-[10px] uppercase tracking-[0.3em] text-purple-400 font-bold mb-2"
                    >
                        {category}
                    </motion.p>
                </div>
                <div className="overflow-hidden">
                    <motion.h4
                        initial={false}
                        animate={{ y: isHovered ? 0 : 10 }}
                        className="text-white font-medium text-2xl tracking-tighter"
                    >
                        {title}
                    </motion.h4>
                </div>

                <div className={`mt-6 flex items-center gap-3 transition-all duration-500 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="h-px w-8 bg-purple-500/50"></div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-medium">View Analysis</span>
                </div>
            </div>

            <div className={`absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/10 transition-all duration-500 ${isHovered ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-45'}`}>
                <Play size={18} className="text-white fill-white ml-1" />
            </div>

            <div className={`absolute inset-0 border-2 border-purple-500/0 group-hover:border-purple-500/20 transition-colors duration-700 rounded-3xl pointer-events-none`} />
        </div>
    );
}

export default function ProductStudio() {
    const pathname = usePathname();
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
    const [selectedStyle, setSelectedStyle] = useState('Cinematic');
    const [platform, setPlatform] = useState('Instagram');
    const [duration, setDuration] = useState('15s');
    const [brandName, setBrandName] = useState('');

    const generatorRef = useRef<HTMLDivElement>(null);
    const { scrollY } = useScroll();
    const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
    const heroY = useTransform(scrollY, [0, 500], [0, 200]);
    const glassY = useTransform(scrollY, [0, 500], [0, -100]);

    const scrollToGenerator = () => {
        generatorRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleGenerate = () => {
        if (!prompt) return;
        setIsGenerating(true);
        // Simulate generation delay
        setTimeout(() => {
            setIsGenerating(false);
            setGeneratedVideo('video_placeholder'); // In a real app, this would be the URL
        }, 3000);
    };

    return (
        <div className="min-h-screen w-full bg-[#050505] text-[#E0E0E0] font-sans selection:bg-purple-500/30 overflow-x-hidden">

            {/* --- NAVBAR --- */}
            <header className="fixed top-0 left-0 right-0 h-24 flex items-center justify-between px-6 md:px-10 z-50 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
                <Link href="/" className="flex items-center gap-3 pointer-events-auto cursor-pointer group">
                    <Image
                        src="/OKVEVO WithOut BackGrounds/White.svg"
                        alt="OKVEVO"
                        width={120}
                        height={40}
                        className="h-8 w-auto object-contain opacity-90 transition-opacity group-hover:opacity-100"
                    />
                </Link>

                <nav className="flex items-center gap-8 pointer-events-auto absolute left-1/2 -translate-x-1/2">
                    {[
                        { name: 'Product Studio', href: '/studio/product' },
                        { name: 'Social Media', href: '/studio/social' },
                        { name: 'Director', href: '/studio/director' }
                    ].map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === item.href ? 'text-white' : 'text-white/40 hover:text-white'}`}
                        >
                            {item.name}
                            {pathname === item.href && (
                                <span className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></span>
                            )}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="px-3 py-1 bg-white/5 rounded-full border border-white/5 flex items-center gap-2 backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgb(34,197,94)]"></div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-white/60">System Online</span>
                    </div>
                </div>
            </header>

            {/* --- LUXURY HERO SECTION --- */}
            <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
                {/* Background Atmosphere */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-black/60 z-10" />
                    <img
                        src="https://i.pinimg.com/736x/7d/d2/c1/7dd2c173e396bc75f34f1ff3acd07730.jpg"
                        alt="Background"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] bg-purple-900/10 rounded-full blur-[150px] mix-blend-screen animate-pulse duration-[12s] z-20" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] bg-blue-900/10 rounded-full blur-[150px] mix-blend-screen animate-pulse duration-[15s] delay-1000 z-20" />
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.04] mix-blend-overlay z-30"></div>
                </div>

                {/* Floating Glass Artifacts */}
                <motion.div style={{ y: glassY }} className="absolute z-0 inset-0 pointer-events-none">
                    {/* Left Card */}
                    <div className="absolute top-1/3 left-[10%] w-64 h-80 bg-gradient-to-br from-white/5 to-transparent border border-white/5 rounded-2xl backdrop-blur-sm -rotate-6 opacity-40">
                        <div className="p-6 space-y-4">
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Aperture size={20} /></div>
                            <div className="space-y-2">
                                <div className="h-2 w-20 bg-white/10 rounded"></div>
                                <div className="h-2 w-full bg-white/5 rounded"></div>
                            </div>
                        </div>
                    </div>
                    {/* Right Card */}
                    <div className="absolute bottom-1/3 right-[10%] w-72 h-64 bg-gradient-to-bl from-white/5 to-transparent border border-white/5 rounded-2xl backdrop-blur-sm rotate-12 opacity-40 flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full border border-white/10 border-t-purple-500/50 animate-spin"></div>
                    </div>
                </motion.div>

                <motion.div
                    style={{ y: heroY, opacity: heroOpacity }}
                    className="relative z-10 text-center space-y-8 max-w-5xl px-6"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-center gap-4 opacity-50">
                            <div className="h-px w-12 bg-gradient-to-r from-transparent to-white"></div>
                            <h2 className="text-xs md:text-sm font-light tracking-[0.4em] text-white uppercase">The New Standard</h2>
                            <div className="h-px w-12 bg-gradient-to-l from-transparent to-white"></div>
                        </div>
                        <h1 className="text-6xl md:text-[9vw] leading-[0.85] font-serif font-medium tracking-tight text-white mix-blend-difference drop-shadow-2xl">
                            Art of <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-blue-200">Promotion</span>
                        </h1>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 1 }}
                        className="max-w-xl mx-auto text-base font-light text-white/50 leading-relaxed"
                    >
                        Generative video synthesis for high-end campaigns. <br />
                        Create broadcast-quality commercials with a simple prompt.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="pt-10"
                    >
                        <button
                            onClick={scrollToGenerator}
                            className="group relative px-12 py-5 bg-white/5 border border-white/10 rounded-full overflow-hidden hover:border-white/30 hover:bg-white/10 transition-all backdrop-blur-md"
                        >
                            <span className="relative z-10 text-xs font-bold uppercase tracking-[0.25em] text-white flex items-center gap-3">
                                Start Creating <ArrowDown size={14} className="animate-bounce" />
                            </span>
                        </button>
                    </motion.div>
                </motion.div>

                {/* Bottom Tech Specs Strip */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2, duration: 1 }}
                    className="absolute bottom-0 left-0 right-0 h-24 border-t border-white/5 bg-black/40 backdrop-blur-md flex items-center"
                >
                    <div className="max-w-7xl mx-auto w-full px-10 flex justify-between items-center text-white/70 text-[10px] uppercase tracking-widest font-mono">
                        <div className="flex items-center gap-2">
                            <Cpu size={14} /> <span>Neural Engine v4.0</span>
                        </div>
                        <div className="hidden md:flex items-center gap-2">
                            <Maximize2 size={14} /> <span>8K Resolution Output</span>
                        </div>
                        <div className="hidden md:flex items-center gap-2">
                            <Scan size={14} /> <span>Dolby Vision HDR</span>
                        </div>
                        <div className="hidden md:flex items-center gap-2">
                            <Zap size={14} /> <span>Real-time Rendering</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> <span>Servers Operational</span>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* --- GENERATOR SECTION (Anchored) --- */}
            <div ref={generatorRef} className="relative z-20 bg-[#050505] border-t border-white/5 shadow-[0_-50px_100px_rgba(0,0,0,1)]">
                <section className="py-32 px-4 md:px-10 max-w-7xl mx-auto flex flex-col md:flex-row gap-12 min-h-screen">

                    {/* LEFT: Controls & Input */}
                    <div className="w-full md:w-1/3 space-y-8 sticky top-32 h-fit">
                        <div className="space-y-4">
                            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-white">
                                Campaign <span className="text-white/40">Setup</span>
                            </h2>
                            <p className="text-white/40 text-sm leading-relaxed">
                                Configure your brand parameters and describe the visual output.
                            </p>
                        </div>

                        {/* Step 1: Brand & Config */}
                        <div className="space-y-4 p-6 bg-[#0A0A0A] border border-white/5 rounded-2xl">
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <label className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Brand Name</label>
                                    <input
                                        type="text"
                                        value={brandName}
                                        onChange={(e) => setBrandName(e.target.value)}
                                        placeholder="e.g. Vogue"
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-white/20 outline-none transition-colors placeholder-white/20"
                                    />
                                </div>
                                <div className="w-1/3 space-y-2">
                                    <label className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Duration</label>
                                    <select
                                        value={duration}
                                        onChange={(e) => setDuration(e.target.value)}
                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-white/20 outline-none transition-colors appearance-none"
                                    >
                                        <option>15s</option>
                                        <option>30s</option>
                                        <option>60s</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Platform</label>
                                <div className="flex gap-2">
                                    {['Instagram', 'YouTube', 'TikTok'].map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPlatform(p)}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${platform === p ? 'bg-white text-black border-white' : 'bg-[#111] text-white/60 border-white/10 hover:border-white/20'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Prompt */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Creative Prompt</label>
                            <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition duration-500 blur-sm"></div>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe your ad concept... (e.g. A cinematic slow-motion shot of a luxury perfume bottle shattering into diamonds in a dark void)"
                                    className="relative w-full h-48 bg-[#0A0A0A] border border-white/10 rounded-xl p-5 text-sm text-white focus:border-white/30 outline-none transition-colors placeholder-white/20 resize-none leading-relaxed"
                                />
                                <div className="absolute bottom-3 right-3 text-[10px] text-white/20 font-mono">
                                    {prompt.length}/500
                                </div>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt}
                            className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isGenerating ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-white text-black hover:bg-[#e0e0e0] shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-[1.02]'}`}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Rendering...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} /> Generate Campaign
                                </>
                            )}
                        </button>
                    </div>

                    {/* RIGHT: Live Preview & Style Selection */}
                    <div className="w-full md:w-2/3 flex flex-col gap-8">

                        {/* Preview Window */}
                        <div className="flex-grow bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden relative min-h-[500px] flex items-center justify-center group shadow-2xl">

                            {/* Background Grid */}
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

                            <AnimatePresence mode='wait'>
                                {isGenerating ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="text-center space-y-6 relative z-10"
                                    >
                                        <div className="relative">
                                            <div className="w-20 h-20 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-12 h-12 bg-white/5 rounded-full blur-xl animate-pulse"></div>
                                            </div>
                                        </div>
                                        <p className="text-xs font-mono text-purple-400 animate-pulse">Init_Neural_Render_Engine...</p>
                                    </motion.div>
                                ) : generatedVideo ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="relative w-full h-full flex items-center justify-center bg-black"
                                    >
                                        {/* Simulated Video Result */}
                                        <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex flex-col items-center justify-center relative overflow-hidden group/video">
                                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-60 mix-blend-overlay transition-transform duration-1000 group-hover/video:scale-105"></div>
                                            <div className="z-10 text-center space-y-4">
                                                <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 cursor-pointer hover:scale-110 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                                    <Play size={40} fill="white" className="ml-1 text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-white font-serif text-2xl tracking-wide">{brandName || "Luxury Brand"}</p>
                                                    <p className="text-white/40 text-[10px] uppercase tracking-widest">Campaign Ready • {duration}</p>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="absolute bottom-8 right-8 flex gap-3 opacity-0 group-hover/video:opacity-100 transition-opacity translate-y-2 group-hover/video:translate-y-0 duration-300">
                                                <button className="p-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-full hover:bg-white hover:text-black transition-all">
                                                    <Download size={18} />
                                                </button>
                                                <button className="p-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-full hover:bg-white hover:text-black transition-all">
                                                    <Share2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center space-y-6"
                                    >
                                        <div className="w-24 h-24 bg-[#0F0F0F] rounded-2xl border border-dashed border-white/10 flex items-center justify-center mx-auto transform rotate-6 hover:rotate-0 transition-transform duration-500 shadow-xl">
                                            <MonitorPlay size={40} className="text-white/10" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium text-white/80">Workspace Empty</h3>
                                            <p className="text-white/30 text-xs mt-2">Configure your campaign to see the preview</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Top Bar Decoration */}
                            <div className="absolute top-6 left-6 flex gap-2 opacity-20">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                        </div>

                        {/* Style Selectors (Bento Grid) */}
                        <div>
                            <div className="flex justify-between items-end mb-6">
                                <label className="text-[10px] uppercase font-bold text-white/30 tracking-widest block">Select Aesthetic</label>
                                <span className="text-[10px] text-white/20">4 Presets Available</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { name: 'Cinematic', color: 'from-purple-900 to-blue-900', icon: <Film size={16} /> },
                                    { name: 'Minimalist', color: 'from-gray-800 to-gray-900', icon: <Type size={16} /> },
                                    { name: 'Cyberpunk', color: 'from-pink-900 to-cyan-900', icon: <Zap size={16} /> },
                                    { name: 'Nature', color: 'from-green-900 to-emerald-950', icon: <Sparkles size={16} /> },
                                ].map((style) => (
                                    <button
                                        key={style.name}
                                        onClick={() => setSelectedStyle(style.name)}
                                        className={`relative h-28 rounded-xl border overflow-hidden group transition-all text-left p-4 flex flex-col justify-between ${selectedStyle === style.name ? 'border-purple-500/50 ring-1 ring-purple-500/20 bg-[#0F0F0F]' : 'bg-[#0A0A0A] border-white/5 hover:border-white/20'}`}
                                    >
                                        <div className={`absolute inset-0 bg-gradient-to-br ${style.color} opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>

                                        <div className={`p-2 w-fit rounded-lg ${selectedStyle === style.name ? 'bg-white text-black' : 'bg-white/5 text-white/40 group-hover:text-white group-hover:bg-white/10'} transition-colors`}>
                                            {style.icon}
                                        </div>

                                        <div className="relative z-10 flex justify-between items-center w-full">
                                            <span className={`text-xs font-medium ${selectedStyle === style.name ? 'text-white' : 'text-white/40 group-hover:text-white'}`}>{style.name}</span>
                                            {selectedStyle === style.name && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 box-shadow-[0_0_10px_rgb(168,85,247)]"></div>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- COMMUNITY SHOWCASE SECTION --- */}
                <section className="py-32 px-4 md:px-10 max-w-7xl mx-auto border-t border-white/5">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
                        <div className="space-y-4">
                            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-white italic">
                                Community <span className="text-white/40 not-italic">Showcase</span>
                            </h2>
                            <p className="text-white/40 text-sm max-w-md leading-relaxed">
                                Explore the next generation of marketing visuals created by our users worldwide. Pure synthesis, no cameras.
                            </p>
                        </div>
                        <button className="px-8 py-3 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-white hover:text-black transition-all">
                            View All Generations
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-6 h-[1000px] md:h-[800px]">
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2022/02/09/107240-678130070_large.mp4"
                            category="Luxury Goods"
                            title="The Essence of Time"
                            className="md:col-span-2 md:row-span-2"
                        />
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2022/05/25/118150-713900143_large.mp4"
                            category="Tech & Futurist"
                            title="Neural Interface Alpha"
                            className="md:col-span-1 md:row-span-1"
                        />
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2021/04/12/70860-537381481_large.mp4"
                            category="Auto & Motion"
                            title="Electric Velocity"
                            className="md:col-span-1 md:row-span-1"
                        />
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2025/06/01/283000_large.mp4"
                            category="Fashion"
                            title="Neon Couture 2077"
                            className="md:col-span-2 md:row-span-1"
                        />
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 h-[400px]">
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2023/10/24/186358-877712399_large.mp4"
                            category="Architecture"
                            title="Sustainable Vistas"
                        />
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2024/02/09/199738-911142279_large.mp4"
                            category="Cosmetics"
                            title="Luminous Glow"
                        />
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2021/08/04/83901-584346061_large.mp4"
                            category="Cinema"
                            title="Desolation Orbit"
                        />
                    </div>
                </section>

                {/* --- CINEMATIC WORKFLOW SECTION --- */}
                <section className="py-32 px-4 md:px-10 max-w-7xl mx-auto border-t border-white/5 bg-gradient-to-b from-transparent to-purple-950/5">
                    <div className="text-center mb-20 space-y-4">
                        <h2 className="text-5xl md:text-6xl font-medium tracking-tight text-white italic">
                            Cinematic <span className="text-white/40 not-italic">Workflow</span>
                        </h2>
                        <div className="flex items-center justify-center gap-2">
                            <div className="h-px w-12 bg-purple-500/50"></div>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-purple-400 font-bold">The Technical Synthesis</p>
                            <div className="h-px w-12 bg-purple-500/50"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 z-0" />

                        {[
                            {
                                icon: <Cpu size={32} />,
                                step: "01",
                                title: "Neural Synthesis",
                                desc: "Proprietary models generate base geometry and texture with sub-pixel precision.",
                                color: "from-purple-500/20 to-transparent"
                            },
                            {
                                icon: <Aperture size={32} />,
                                step: "02",
                                title: "Ray-Traced Optics",
                                desc: "Physically based rendering engine calculates secondary bounces and global illumination.",
                                color: "from-blue-500/20 to-transparent"
                            },
                            {
                                icon: <Zap size={32} />,
                                step: "03",
                                title: "Spectral Grading",
                                desc: "Final output undergoes deep color calibration and cinematic grain integration.",
                                color: "from-emerald-500/20 to-transparent"
                            }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.2 }}
                                className="relative z-10 group"
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                                <div className="relative p-10 rounded-3xl bg-[#0A0A0A] border border-white/5 backdrop-blur-xl hover:border-white/20 transition-all duration-500 overflow-hidden">
                                    {/* Background Animated Pulse */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-1000" />

                                    <div className="flex justify-between items-start mb-8">
                                        <div className="p-4 rounded-2xl bg-white/5 text-white/80 group-hover:text-white group-hover:bg-white/10 transition-all">
                                            {item.icon}
                                        </div>
                                        <span className="text-4xl font-bold text-white/5 group-hover:text-white/10 transition-colors uppercase italic">{item.step}</span>
                                    </div>
                                    <h3 className="text-xl font-medium text-white mb-4 tracking-tight">{item.title}</h3>
                                    <p className="text-white/40 text-sm leading-relaxed group-hover:text-white/60 transition-colors">{item.desc}</p>

                                    <div className="mt-8 pt-8 border-t border-white/5 flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                        <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold group-hover:text-purple-400 transition-colors">System Active</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* --- FOOTER SECTION --- */}
                <footer className="pt-24 pb-12 px-4 md:px-10 border-t border-white/5 bg-[#020202]">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
                            {/* Brand Column */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                                        <Play size={16} className="text-black fill-black" />
                                    </div>
                                    <span className="text-xl font-bold tracking-tighter text-white font-museo">OKVEVO</span>
                                </div>
                                <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                                    Redefining the boundaries of digital production through autonomous synthesis. The future of motion is here.
                                </p>
                                <div className="flex gap-4">
                                    <button className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
                                        <Instagram size={18} />
                                    </button>
                                    <button className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
                                        <Twitter size={18} />
                                    </button>
                                    <button className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
                                        <Youtube size={18} />
                                    </button>
                                    <button className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
                                        <Facebook size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Product Column */}
                            <div className="space-y-6">
                                <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">Product</h4>
                                <ul className="space-y-4">
                                    {['Director Studio', 'Product Studio', 'Instant Avatar', 'Voice Lab', 'Cloud Render'].map((link) => (
                                        <li key={link}>
                                            <Link href="#" className="text-sm text-white/40 hover:text-purple-400 transition-colors">{link}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Resources Column */}
                            <div className="space-y-6">
                                <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">Resources</h4>
                                <ul className="space-y-4">
                                    {['Documentation', 'API Reference', 'Community Showcases', 'Cinematic Presets', 'Affiliate Program'].map((link) => (
                                        <li key={link}>
                                            <Link href="#" className="text-sm text-white/40 hover:text-purple-400 transition-colors">{link}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Newsletter Column */}
                            <div className="space-y-6">
                                <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">Legal</h4>
                                <ul className="space-y-4">
                                    {['Privacy Policy', 'Terms of Service', 'Cookie Settings', 'Security', 'Enterprise Agreement'].map((link) => (
                                        <li key={link}>
                                            <Link href="#" className="text-sm text-white/40 hover:text-purple-400 transition-colors">{link}</Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-white/20">© 2024 OKVEVO Intelligence Systems. All Rights Reserved.</p>
                            <div className="flex gap-8">
                                <Link href="#" className="text-[10px] uppercase tracking-[0.2em] text-white/20 hover:text-white transition-colors">Status: Operational</Link>
                                <Link href="#" className="text-[10px] uppercase tracking-[0.2em] text-white/20 hover:text-white transition-colors">v2.4.0-Stable</Link>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
