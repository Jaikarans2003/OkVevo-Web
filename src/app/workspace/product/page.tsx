'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { MuseoModerno } from 'next/font/google';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

const museoModerno = MuseoModerno({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
    variable: "--font-museo-moderno",
    display: "swap",
});
import { AILoader } from '@/components/ui/ai-loader';
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
    Scan,
    Camera,
    Focus,
    Upload,
    Crosshair,
    Box,
    Send
} from 'lucide-react';
import { runPlacementPipeline, runRefinementPipeline, PlacementJobStatus } from '@/services/ProductPlacementService';

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

    // Mode switching state
    const [mode, setMode] = useState<'product-ads' | 'product-placement' | 'product-shoots'>('product-ads');
    const [productImage, setProductImage] = useState<File | null>(null);
    const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
    const [placementPrompt, setPlacementPrompt] = useState('');

    // Dual-upload state for Product Placement
    const [sceneImage, setSceneImage] = useState<File | null>(null);
    const [sceneImagePreview, setSceneImagePreview] = useState<string | null>(null);

    // Placement pipeline state
    const [placementStatus, setPlacementStatus] = useState<PlacementJobStatus>('idle');
    const [placementStatusDetail, setPlacementStatusDetail] = useState('');
    const [compositeImageUrl, setCompositeImageUrl] = useState<string | null>(null);
    const [masterPrompt, setMasterPrompt] = useState<string | null>(null);

    // Chat refinement state
    const [isComposed, setIsComposed] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: "Welcome to Product Studio. Upload your images and describe your vision to get started!" }
    ]);

    const generatorRef = useRef<HTMLDivElement>(null);
    const { scrollY } = useScroll();
    const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
    const heroY = useTransform(scrollY, [0, 500], [0, 200]);
    const glassY = useTransform(scrollY, [0, 500], [0, -100]);

    const scrollToGenerator = () => {
        generatorRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleGenerate = () => {
        if (mode === 'product-ads' && !prompt) return;

        setIsGenerating(true);
        // Simulate generation delay
        setTimeout(() => {
            setIsGenerating(false);
            setGeneratedVideo('video_placeholder');
        }, 3000);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setProductImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProductImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSceneImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSceneImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setSceneImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePlacementGenerate = useCallback(async () => {
        if (!productImage || !sceneImage) return;

        setIsGenerating(true);
        setCompositeImageUrl(null);
        setMasterPrompt(null);
        setIsComposed(true); // Trigger resizing immediately

        const result = await runPlacementPipeline(
            productImage,
            sceneImage,
            (status, detail) => {
                setPlacementStatus(status);
                setPlacementStatusDetail(detail || '');
            },
            placementPrompt || undefined
        );

        setIsGenerating(false);

        if (result.status === 'complete' && result.compositeImageUrl) {
            setCompositeImageUrl(result.compositeImageUrl);
            setMasterPrompt(result.masterPrompt || null);
            setIsComposed(true);
            setChatMessages([{ role: 'assistant', content: "Initial composition complete. How would you like to refine the image?" }]);
        }
    }, [productImage, sceneImage, placementPrompt]);

    const handleSendChatMessage = async () => {
        if (!chatInput.trim() || !compositeImageUrl) return;

        const userMsg = chatInput.trim();
        setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatInput('');

        // Show processing state
        setIsGenerating(true);
        setChatMessages(prev => [...prev, { role: 'assistant', content: '🔄 Analyzing your request and generating a refined prompt...' }]);

        const result = await runRefinementPipeline(
            compositeImageUrl,
            userMsg,
            (status, detail) => {
                setPlacementStatus(status);
                setPlacementStatusDetail(detail || '');
            }
        );

        setIsGenerating(false);

        if (result.status === 'complete' && result.compositeImageUrl) {
            setCompositeImageUrl(result.compositeImageUrl);
            setMasterPrompt(result.masterPrompt || null);
            setChatMessages(prev => [...prev, { role: 'assistant', content: '✅ Composition updated based on your request.' }]);
        } else {
            setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Refinement failed: ${result.error || 'Unknown error'}` }]);
        }
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
                        { name: 'Product Studio', href: '/workspace/product' },
                        { name: 'Social Media', href: '/workspace/social' },
                        { name: 'Director', href: '/workspace/director' }
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
                    <div className="absolute inset-0 bg-black/30 z-10" />
                    <img
                        src="/images/orange-bg.png"
                        alt="Background"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] bg-orange-900/10 rounded-full blur-[150px] mix-blend-screen animate-pulse duration-[12s] z-20" />
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


            {/* --- GENERATOR SECTION --- */}
            <div ref={generatorRef} className="relative z-20 bg-[#050505] pt-24 h-screen overflow-hidden">
                <section className="h-full px-4 md:px-10 max-w-[1600px] mx-auto pb-6">
                    <div className="flex flex-col md:flex-row gap-8 h-full max-h-[calc(100vh-8rem)]">

                        {/* LEFT: Controls & Input (Fixed Width) */}
                        <div className={`w-full ${isComposed ? 'md:w-[375px]' : 'md:w-[475px]'} flex-shrink-0 transition-all duration-500 flex flex-col gap-5 h-full overflow-y-auto overflow-x-hidden pr-4 custom-scrollbar`} data-lenis-prevent>
                            <div className="space-y-3">
                                <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-white">
                                    {mode === 'product-ads' ? 'Campaign' : 'Product'} <span className="text-white/40">{mode === 'product-ads' ? 'Setup' : 'Placement'}</span>
                                </h2>
                                <p className="text-white/40 text-[11px] leading-relaxed">
                                    {mode === 'product-ads'
                                        ? 'Configure brand parameters and visual output.'
                                        : 'Upload assets and describe the environment.'}
                                </p>
                            </div>

                            {/* Mode Switcher */}
                            <div className="space-y-1.5">
                                <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest">Mode</label>
                                <div className="flex gap-1.5">
                                    {[
                                        { id: 'product-ads' as const, label: 'Ads', icon: <Film size={10} /> },
                                        { id: 'product-placement' as const, label: 'Placement', icon: <Crosshair size={10} /> },
                                        { id: 'product-shoots' as const, label: 'Shoots', icon: <Camera size={10} /> },
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setMode(m.id)}
                                            className={`flex-1 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1 ${mode === m.id ? 'bg-white text-black border-white' : 'bg-[#111] text-white/60 border-white/10 hover:border-white/20'}`}
                                        >
                                            {m.icon} {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Product Placement Mode Form */}
                            {mode === 'product-placement' && (
                                <div className="flex flex-col gap-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Zone A */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest flex items-center gap-1.5">
                                                <Box size={10} className="text-purple-400" /> Zone A
                                            </label>
                                            <div className="relative group bg-[#0A0A0A] border border-white/10 rounded-xl p-2.5 hover:border-purple-500/30 transition-colors">
                                                <input type="file" id="hero-product-image" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                                {productImagePreview ? (
                                                    <div className="space-y-2">
                                                        <div className="relative w-full h-20 bg-[#111] rounded-lg overflow-hidden border border-white/5">
                                                            <img src={productImagePreview} alt="Hero" className="w-full h-full object-contain" />
                                                        </div>
                                                        <button onClick={() => document.getElementById('hero-product-image')?.click()} className="w-full py-0.5 text-[8px] uppercase tracking-wider text-white/40 hover:text-white transition-colors">Change</button>
                                                    </div>
                                                ) : (
                                                    <label htmlFor="hero-product-image" className="cursor-pointer flex flex-col items-center justify-center py-4 space-y-1.5">
                                                        <Upload size={14} className="text-purple-400/40" />
                                                        <p className="text-[9px] text-white/50">Hero Product</p>
                                                    </label>
                                                )}
                                            </div>
                                        </div>

                                        {/* Zone B */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest flex items-center gap-1.5">
                                                <Focus size={10} className="text-cyan-400" /> Zone B
                                            </label>
                                            <div className="relative group bg-[#0A0A0A] border border-white/10 rounded-xl p-2.5 hover:border-cyan-500/30 transition-colors">
                                                <input type="file" id="scene-image" accept="image/*" onChange={handleSceneImageUpload} className="hidden" />
                                                {sceneImagePreview ? (
                                                    <div className="space-y-2">
                                                        <div className="relative w-full h-20 bg-[#111] rounded-lg overflow-hidden border border-white/5">
                                                            <img src={sceneImagePreview} alt="Scene" className="w-full h-full object-cover" />
                                                        </div>
                                                        <button onClick={() => document.getElementById('scene-image')?.click()} className="w-full py-0.5 text-[8px] uppercase tracking-wider text-white/40 hover:text-white transition-colors">Change</button>
                                                    </div>
                                                ) : (
                                                    <label htmlFor="scene-image" className="cursor-pointer flex flex-col items-center justify-center py-4 space-y-1.5">
                                                        <Upload size={14} className="text-cyan-400/40" />
                                                        <p className="text-[9px] text-white/50">Scene</p>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Initial Instructions Prompt */}
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest">Initial Instructions</label>
                                        <textarea
                                            value={placementPrompt}
                                            onChange={(e) => setPlacementPrompt(e.target.value)}
                                            placeholder="e.g. Place bottle on marble with soft light..."
                                            className="w-full h-20 bg-[#0A0A0A] border border-white/10 rounded-xl p-3 text-[11px] text-white focus:border-white/30 outline-none transition-colors placeholder-white/20 resize-none leading-relaxed"
                                        />
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handlePlacementGenerate}
                                        disabled={isGenerating || !productImage || !sceneImage}
                                        className={`w-full py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isGenerating ? 'bg-white/10 text-white/50' : !productImage || !sceneImage ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' : 'bg-white text-black hover:bg-[#e0e0e0] shadow-xl hover:scale-[1.01]'}`}
                                    >
                                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        {isGenerating ? 'Processing...' : 'Composite Image'}
                                    </button>

                                    {placementStatus !== 'idle' && placementStatus !== 'complete' && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                            <span className="text-[9px] uppercase tracking-widest text-purple-400 font-bold leading-none">{placementStatusDetail}</span>
                                        </div>
                                    )}

                                    {/* Neural Chat assistant - Moved and Resized */}
                                    {isComposed && (
                                        <div className="flex flex-col bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl h-[400px]">
                                            <div className="px-4 py-3 border-b border-white/5 bg-[#0F0F0F]/50 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <Sparkles size={12} className="text-purple-400" />
                                                        <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-green-500 rounded-full border border-black animate-pulse"></div>
                                                    </div>
                                                    <span className="text-[9px] uppercase font-bold text-white/70 tracking-widest whitespace-nowrap">Neural assistant</span>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#070707]" data-lenis-prevent>
                                                {chatMessages.map((msg, i) => (
                                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[90%] rounded-xl px-3 py-2 text-[10px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-purple-600 text-white font-medium' : 'bg-[#151515] text-white/80 border border-white/5'}`}>
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="p-3 bg-[#0F0F0F] border-t border-white/5">
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="text"
                                                        value={chatInput}
                                                        onChange={(e) => setChatInput(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                                                        placeholder="Refine vision..."
                                                        className="w-full bg-black/60 border border-white/10 rounded-full py-2 px-4 text-[10px] text-white focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all placeholder-white/20 shadow-inner"
                                                    />
                                                    <button
                                                        onClick={handleSendChatMessage}
                                                        className="absolute right-1 p-1.5 bg-white text-black rounded-full hover:bg-gray-200 transition-all hover:scale-105 active:scale-95 shadow-lg group"
                                                    >
                                                        <Send size={12} className="transition-transform" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}


                                </div>
                            )}

                            {/* Product Ads Form */}
                            {mode === 'product-ads' && (
                                <div className="flex flex-col gap-5">
                                    {/* Brand Name */}
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest flex items-center gap-1.5">
                                            <Type size={10} className="text-blue-400" /> Brand Name
                                        </label>
                                        <input
                                            type="text"
                                            value={brandName}
                                            onChange={(e) => setBrandName(e.target.value)}
                                            placeholder="Enter your brand name..."
                                            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white focus:border-white/30 outline-none transition-all placeholder-white/20"
                                        />
                                    </div>

                                    {/* Ad Description */}
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest flex items-center gap-1.5">
                                            <Sparkles size={10} className="text-purple-400" /> Ad Description
                                        </label>
                                        <textarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder="Describe your ad vision (e.g. A luxury perfume bottle floating in a dark, ethereal cloud of gold dust...)"
                                            className="w-full h-24 bg-[#0A0A0A] border border-white/10 rounded-xl p-4 text-[11px] text-white focus:border-white/30 outline-none transition-all placeholder-white/20 resize-none leading-relaxed"
                                        />
                                    </div>

                                    {/* Platform & Duration */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest flex items-center gap-1.5">
                                                <MonitorPlay size={10} className="text-cyan-400" /> Platform
                                            </label>
                                            <div className="relative group">
                                                <select
                                                    value={platform}
                                                    onChange={(e) => setPlatform(e.target.value)}
                                                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2.5 text-[10px] text-white/80 focus:border-white/30 outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="Instagram">Instagram</option>
                                                    <option value="YouTube">YouTube</option>
                                                    <option value="TikTok">TikTok</option>
                                                    <option value="Facebook">Facebook</option>
                                                </select>
                                                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest flex items-center gap-1.5">
                                                <Zap size={10} className="text-yellow-400" /> Duration
                                            </label>
                                            <div className="relative group">
                                                <select
                                                    value={duration}
                                                    onChange={(e) => setDuration(e.target.value)}
                                                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-3 py-2.5 text-[10px] text-white/80 focus:border-white/30 outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="15s">15 Seconds</option>
                                                    <option value="30s">30 Seconds</option>
                                                    <option value="60s">60 Seconds</option>
                                                </select>
                                                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual Style */}
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] uppercase font-bold text-white/30 tracking-widest flex items-center gap-1.5">
                                            <Palette size={10} className="text-pink-400" /> Visual Style
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Cinematic', 'Minimalist', 'Vibrant', 'Luxury'].map((style) => (
                                                <button
                                                    key={style}
                                                    onClick={() => setSelectedStyle(style)}
                                                    className={`py-2 rounded-lg text-[10px] font-medium transition-all border ${selectedStyle === style ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/10 hover:bg-white/5'}`}
                                                >
                                                    {style}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !prompt}
                                        className={`w-full mt-2 py-4 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isGenerating ? 'bg-white/10 text-white/50 cursor-wait' : !prompt ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' : 'bg-white text-black hover:bg-[#e0e0e0] shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:scale-[1.01]'}`}
                                    >
                                        {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                                        {isGenerating ? 'Synthesizing...' : 'Generate Campaign'}
                                    </button>
                                </div>
                            )}

                            {mode === 'product-shoots' && (
                                <div className="p-8 bg-[#0A0A0A] border border-white/5 border-dashed rounded-2xl text-center">
                                    <p className="text-white/20 text-[10px] uppercase tracking-widest font-bold">Coming Soon</p>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Preview & Chat Area */}
                        <div className="flex-1 flex flex-col gap-6 h-full min-w-0">

                            {/* Top row: Preview & Chat Side-by-Side if screen is wide enough */}
                            <div className="flex flex-col gap-6 h-full min-h-0">

                                {/* Preview Window */}
                                <div className={`${isComposed ? 'flex-1' : 'flex-1'} min-h-[400px] md:min-h-0 bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden relative group shadow-2xl`}>
                                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]"></div>

                                    <AnimatePresence mode='wait'>
                                        {isGenerating ? (
                                            <motion.div
                                                key="loader"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/60 backdrop-blur-sm"
                                            >
                                                <AILoader text="Synthesizing" />
                                            </motion.div>
                                        ) : compositeImageUrl ? (
                                            <motion.div
                                                key="result"
                                                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                                                className="absolute inset-0 flex items-center justify-center p-4"
                                            >
                                                <img src={compositeImageUrl} alt="Composite" className="w-full h-full object-contain rounded-lg" />
                                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="p-2.5 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition-all">
                                                        <Download size={16} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="empty"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 opacity-20"
                                            >
                                                <div className="w-20 h-20 rounded-3xl border border-dashed border-white/40 flex items-center justify-center mb-6">
                                                    <ImageIcon size={32} />
                                                </div>
                                                <h3 className="text-xl font-medium text-white mb-2">Monitor Output</h3>
                                                <p className="text-xs max-w-[240px]">Neural synthesis stream will appear here after assets are processed.</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="absolute top-4 left-4 flex gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-red-500/30"></div>
                                        <div className="w-2 h-2 rounded-full bg-yellow-500/30"></div>
                                        <div className="w-2 h-2 rounded-full bg-green-500/30"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* --- COMMUNITY SHOWCASE SECTION --- */}
            {/* Phase2 */}
            {/* <section className="relative py-32 bg-black overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(173,95,255,0.05),transparent_70%)]"></div>

                <div className="max-w-7xl mx-auto px-10 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40">Marketplace</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Community <span className="text-white/40 italic text-3xl md:text-4xl font-light">Showcase</span></h2>
                        </div>
                        <button className="px-8 py-3 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">
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
                            videoSrc="https://cdn.pixabay.com/video/2021/09/14/88566-605658091_large.mp4"
                            category="Cinematic"
                            title="Neon Rain Noir"
                            className="md:col-span-1 md:row-span-1"
                        />
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2021/11/04/96387-648431802_large.mp4"
                            category="Abstract"
                            title="Liquid Geometry"
                            className="md:col-span-1 md:row-span-1"
                        />
                        <ShowcaseCard
                            videoSrc="https://cdn.pixabay.com/video/2022/10/24/136284-763486008_large.mp4"
                            category="Nature"
                            title="Arctic Silence"
                            className="md:col-span-1 md:row-span-1"
                        />
                    </div>
                </div>
            </section> */}

            {/* --- CINEMATIC WORKFLOW SECTION --- */}
            {/* Phase2 */}
            {/* <section className="relative py-32 bg-[#050505] border-t border-white/5 overflow-hidden">
                <div className="max-w-7xl mx-auto px-10 relative z-10">
                    <div className="text-center space-y-4 mb-24">
                        <h2 className="text-5xl md:text-6xl font-medium tracking-tight text-white italic">
                            Cinematic <span className="text-white/40 not-italic">Workflow</span>
                        </h2>
                        <div className="flex items-center justify-center gap-2">
                            <div className="h-px w-12 bg-purple-500/50"></div>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-purple-400 font-bold">The Technical Synthesis</p>
                            <div className="h-px w-12 bg-purple-500/50"></div>
                        </div>
                    </div> */}

            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative"> */}
            {/* Connecting Line (Desktop) */}
            {/* <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 z-0" />

                        {[
                            { step: "01", title: "Direct Context", desc: "Upload your hero assets and define the artistic direction. Our neural models analyze lighting, texture, and form." },
                            { step: "02", title: "Neural Synthesis", desc: "Advanced diffusion models synthesize the background and product interaction, ensuring perfect global illumination." },
                            { step: "03", title: "Master Export", desc: "Generate campaign-ready videos in multiple aspect ratios. Ready for broadcast, social, or large-format digital displays." }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.2 }}
                                className="group relative p-10 bg-[#0A0A0A] border border-white/5 rounded-[2rem] hover:border-purple-500/30 transition-all duration-500"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem]" />
                                <div className="relative z-10 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                            {idx === 0 ? <Box size={20} className="text-purple-400" /> : idx === 1 ? <Cpu size={20} className="text-purple-400" /> : <Play size={20} className="text-purple-400" />}
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
                </div>
            </section> */}

            {/* --- FOOTER SECTION --- */}
            {/* Phase2 */}
            {/* <footer className="relative bg-black pt-32 pb-12 border-t border-white/5 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

                <div className="max-w-7xl mx-auto px-10 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
                        <div className="md:col-span-2 space-y-8">
                            <h2 className="text-2xl font-bold tracking-tighter text-white">OKVEVO<span className="text-purple-500">.</span></h2>
                            <p className="text-white/40 text-sm leading-relaxed max-w-sm">
                                The world's first generative video intelligence platform designed exclusively for
                                high-end commercial synthesis and luxury campaign production.
                            </p>
                            <div className="flex gap-4">
                                {[Instagram, Youtube, Twitter, Facebook].map((Icon, i) => (
                                    <Link key={i} href="#" className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-purple-400 hover:border-purple-400/30 transition-all">
                                        <Icon size={18} />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold text-white mb-8">Platform</h4>
                            <ul className="space-y-4">
                                {['Showcase', 'Model Library', 'API Access', 'Enterprise'].map((item) => (
                                    <li key={item}><Link href="#" className="text-xs text-white/30 hover:text-white transition-colors tracking-wide">{item}</Link></li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold text-white mb-8">Resources</h4>
                            <ul className="space-y-4">
                                {['Benchmarks', 'Documentation', 'Security', 'Status'].map((item) => (
                                    <li key={item}><Link href="#" className="text-xs text-white/30 hover:text-white transition-colors tracking-wide">{item}</Link></li>
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
            </footer> */}
        </div>
    );
}
