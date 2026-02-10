'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    Film,
    LayoutGrid,
    TrendingUp,
    Play,
    Zap,
    Clock,
    Type,
    CheckCircle2,
    Loader2,
    Image as ImageIcon,
    Video,
    ChevronRight,
    Sparkles,
    Clapperboard,
    Wand2,
    History,
    HelpCircle,
    Copy,
    Share2,
    Download,
    MonitorPlay,
    Smartphone,
    Package
} from 'lucide-react';

// --- Components ---
function HoverVideoCard({ step, index }: { step: any, index: number }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (!videoRef.current) return;

        if (isHovered) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Ignore autoplay errors
                });
            }
        } else {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, [isHovered]);

    return (
        <div
            className="bg-[#121212] border border-[#1A1A1A] p-8 rounded-2xl relative group hover:border-[#333] transition-all cursor-pointer overflow-hidden h-[280px] flex flex-col justify-end"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background Video */}
            <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 pointer-events-none ${isHovered ? 'opacity-40' : 'opacity-0'}`}
                src={step.video}
                muted
                loop
                playsInline
            />

            <div className="relative z-10 transition-transform duration-500 group-hover:translate-y-[-10px]">
                <div className="absolute -top-16 right-0 text-[#2A2A2A] font-bold text-6xl opacity-20">{index + 1}</div>
                <div className="w-12 h-12 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-white mb-6 group-hover:bg-[#8B5CF6] group-hover:text-white transition-all duration-500 shadow-xl group-hover:shadow-purple-500/20">
                    {step.icon}
                </div>
                <h3 className="text-white font-bold text-lg mb-2 group-hover:text-white transition-colors">{step.title}</h3>
                <p className="text-[#666] text-sm leading-relaxed group-hover:text-[#AAA] transition-colors">{step.desc}</p>
            </div>

            {/* Subtle Gradient Overlay on Hover */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
        </div>
    );
}

export default function DirectorWorkstation() {
    // --- State ---
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState<'trailer' | 'movie'>('trailer');

    // Trailer Inputs
    const [script, setScript] = useState('');
    const [duration, setDuration] = useState('30s');
    const [genre, setGenre] = useState('Sci-Fi');
    const [aspectRatio, setAspectRatio] = useState('16:9');

    // Generation State
    const [generationStep, setGenerationStep] = useState<'idle' | 'loading' | 'storyboard' | 'video'>('idle');
    const [selectedStoryboard, setSelectedStoryboard] = useState<number | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Mock Data
    const storyboards = Array.from({ length: 9 }).map((_, i) => i);

    const handleGenerate = () => {
        if (!script) return;
        setGenerationStep('loading');

        // Simulate Generation Delay
        setTimeout(() => {
            setGenerationStep('storyboard');
        }, 3000);
    };

    const handleStoryboardSelect = (index: number) => {
        setSelectedStoryboard(index);
        // Simulate Video Generation after selection
        setGenerationStep('loading');
        setTimeout(() => {
            setGenerationStep('video');
        }, 2000);
    };

    const resetFlow = () => {
        setGenerationStep('idle');
        setSelectedStoryboard(null);
        setScript('');
    };

    return (
        <div className="h-screen w-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans flex flex-col overflow-hidden selection:bg-purple-500/30 relative">

            {/* Cinematic Vignette Overlay */}
            <div className="fixed inset-0 pointer-events-none z-[60] bg-[radial-gradient(circle_at_center,transparent_10%,rgba(0,0,0,0.4)_100%)]" />
            <div className="fixed inset-0 pointer-events-none z-[60] bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(139,92,246,0.15)_100%)] mix-blend-screen" />

            {/* --- STUDIO NAVIGATION BAR --- */}
            <nav className="h-16 border-b border-[#2A2A2A] bg-[#121212]/50 backdrop-blur-xl flex items-center justify-between px-6 z-50">
                <Link href="/" className="flex items-center gap-1 group">
                    <Image
                        src="/OKVEVO WithOut BackGrounds/White.svg"
                        alt="OKVEVO Logo"
                        width={120}
                        height={40}
                        className="h-8 w-auto object-contain"
                    />
                </Link>

                <div className="hidden lg:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
                    {[
                        { name: 'Product Studio', href: '/studio/product' },
                        { name: 'Social Media', href: '/studio/social' },
                        { name: 'Director', href: '/studio/director' }
                    ].map((item) => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === item.href ? 'text-[#8B5CF6]' : 'text-white/40 hover:text-white'}`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] rounded-full border border-[#2A2A2A]">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] uppercase font-bold text-[#666] tracking-widest">System Online</span>
                    </div>
                    {/* User Profile Dropdown */}
                    <div className="relative z-50">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#222] to-[#111] border border-[#333] flex items-center justify-center text-[#888] hover:border-[#8B5CF6] hover:text-white transition-all overflow-hidden relative"
                        >
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Director" alt="User" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                        </button>

                        <AnimatePresence>
                            {isProfileOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute right-0 top-12 w-56 bg-[#121212] border border-[#2A2A2A] rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50 p-1"
                                >
                                    <div className="px-4 py-3 border-b border-[#222]">
                                        <p className="text-sm font-bold text-white">Aditya Manhas</p>
                                        <p className="text-xs text-[#666]">Director Account</p>
                                    </div>
                                    <div className="py-1">
                                        <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-[#888] hover:text-white hover:bg-[#1A1A1A] transition-colors rounded-lg mx-1">
                                            <div className="w-2 h-2 rounded-full bg-[#8B5CF6]"></div> Profile
                                        </Link>
                                        <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-[#888] hover:text-white hover:bg-[#1A1A1A] transition-colors rounded-lg mx-1">
                                            <div className="w-2 h-2 rounded-full bg-[#333]"></div> Settings
                                        </Link>
                                        <div className="h-px bg-[#222] my-1 mx-2"></div>
                                        <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors rounded-lg mx-1">
                                            Sign Out
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </nav>

            <div className="flex-1 flex overflow-hidden">
                {/* --- LEFT SIDEBAR (Controls) --- */}
                <aside className="w-[350px] bg-[#121212] border-r border-[#2A2A2A] flex flex-col z-20 shadow-2xl relative">
                    {/* Navigation Tabs */}
                    <div className="p-4 pt-6">
                        <div className="flex p-1 bg-[#1A1A1A] rounded-lg border border-[#2A2A2A]">
                            <button
                                onClick={() => { setActiveTab('trailer'); resetFlow(); }}
                                className={`flex-1 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'trailer' ? 'bg-[#2A2A2A] text-white shadow-sm' : 'text-[#666] hover:text-white'}`}
                            >
                                Trailer
                            </button>
                            <button
                                onClick={() => { setActiveTab('movie'); resetFlow(); }}
                                className={`flex-1 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'movie' ? 'bg-[#2A2A2A] text-white shadow-sm' : 'text-[#666] hover:text-white'}`}
                            >
                                Movie
                            </button>
                        </div>
                    </div>

                    {/* Input Form */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6 custom-scrollbar">
                        {activeTab === 'trailer' ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">

                                {/* Prompt Input */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-[#888] uppercase tracking-wide">Script / Prompt</label>
                                        <button className="text-[10px] flex items-center gap-1 text-[#8B5CF6] hover:underline">
                                            <Wand2 size={10} /> Enhance
                                        </button>
                                    </div>
                                    <textarea
                                        value={script}
                                        onChange={(e) => setScript(e.target.value)}
                                        placeholder="Describe your scene in detail... e.g., A cinematic drone shot of a futuristic neon city at night, rain falling, cybernetic pedestrians walking."
                                        className="w-full h-40 bg-[#1A1A1A] border border-[#333] rounded-xl p-4 text-sm text-white placeholder-[#444] focus:border-[#8B5CF6] outline-none transition-all resize-none leading-relaxed"
                                    />
                                </div>

                                {/* Settings Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[#888] uppercase tracking-wide">Duration</label>
                                        <select
                                            value={duration}
                                            onChange={(e) => setDuration(e.target.value)}
                                            className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg p-3 text-sm text-white outline-none focus:border-[#8B5CF6] appearance-none cursor-pointer hover:bg-[#222]"
                                        >
                                            <option value="5s">5 Seconds</option>
                                            <option value="10s">10 Seconds</option>
                                            <option value="30s">30 Seconds</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[#888] uppercase tracking-wide">Aspect Ratio</label>
                                        <select
                                            value={aspectRatio}
                                            onChange={(e) => setAspectRatio(e.target.value)}
                                            className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg p-3 text-sm text-white outline-none focus:border-[#8B5CF6] appearance-none cursor-pointer hover:bg-[#222]"
                                        >
                                            <option value="16:9">16:9 Landscape</option>
                                            <option value="9:16">9:16 Portrait</option>
                                            <option value="1:1">1:1 Square</option>
                                            <option value="2.39:1">2.39:1 Cinema</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-[#888] uppercase tracking-wide">Style / Genre</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Cinematic', 'Anime', '3D Render', 'Realistic', 'Cyberpunk', 'Fantasy'].map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setGenre(s)}
                                                className={`py-2 px-1 rounded-md text-[10px] font-medium border transition-all ${genre === s ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]' : 'bg-[#1A1A1A] border-[#333] text-[#666] hover:border-[#666]'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                                <Video size={48} className="text-[#333]" />
                                <p className="text-sm font-medium text-[#666]">Movie Mode Coming Soon</p>
                            </div>
                        )}
                    </div>

                    {/* Sticky Footer Action */}
                    <div className="p-4 border-t border-[#2A2A2A] bg-[#121212]">
                        <div className="flex items-center justify-between text-[10px] text-[#666] mb-3 px-1">
                            <span>Cost: <span className="text-white">10 Credits</span></span>
                            <span>Balance: <span className="text-white">450</span></span>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={!script || activeTab === 'movie' || generationStep !== 'idle'}
                            className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${!script || activeTab === 'movie' || generationStep !== 'idle' ? 'bg-[#2A2A2A] text-[#666] cursor-not-allowed' : 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-[0_0_20px_rgba(139,92,246,0.2)]'}`}
                        >
                            {generationStep === 'idle' ? 'Generate Video' : 'Processing...'}
                        </button>
                    </div>
                </aside>

                {/* --- MAIN CONTENT AREA --- */}
                <main className="flex-1 flex flex-col bg-[#0A0A0A] relative overflow-hidden">
                    {/* Header - Sub Navigation */}
                    <header className="h-14 border-b border-[#1A1A1A] flex items-center justify-between px-8 bg-[#0A0A0A]">
                        <nav className="flex gap-6">
                            <Link href="#" className="text-xs font-bold uppercase tracking-widest text-white border-b-2 border-[#8B5CF6] pb-4 translate-y-2">Workspace</Link>
                        </nav>
                        <div className="flex items-center gap-3">
                            <button className="p-2 rounded-lg hover:bg-[#1A1A1A] text-[#666] hover:text-white transition-colors">
                                <HelpCircle size={16} />
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 p-8 overflow-y-auto">
                        <AnimatePresence mode='wait'>
                            {generationStep === 'idle' ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className="h-full flex flex-col items-center justify-center max-w-5xl mx-auto"
                                >
                                    <div className="text-center space-y-4 mb-16">
                                        <div className="w-20 h-20 bg-[#1A1A1A] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-[#222]">
                                            <Clapperboard size={40} className="text-[#8B5CF6]" />
                                        </div>
                                        <h1 className="text-5xl font-bold text-white tracking-tight">Director Mode</h1>
                                        <p className="text-[#666] text-lg max-w-2xl mx-auto">Create broadcast-quality commercials, trailers, and scenes using our advanced cinematic model.</p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-8 w-full">
                                        {[
                                            {
                                                icon: <Type size={24} />,
                                                title: "Describe Scene",
                                                desc: "Enter a detailed prompt or upload a script.",
                                                video: "https://cdn.pixabay.com/video/2022/02/09/107240-678130070_large.mp4"
                                            },
                                            {
                                                icon: <LayoutGrid size={24} />,
                                                title: "Select Visuals",
                                                desc: "Choose from generated storyboards.",
                                                video: "https://cdn.pixabay.com/video/2022/05/25/118150-713900143_large.mp4"
                                            },
                                            {
                                                icon: <Film size={24} />,
                                                title: "Get Video",
                                                desc: "Render high-quality video output.",
                                                video: "https://cdn.pixabay.com/video/2025/06/01/283000_large.mp4"
                                            }
                                        ].map((step, i) => (
                                            <HoverVideoCard key={i} step={step} index={i} />
                                        ))}
                                    </div>
                                </motion.div>
                            ) : generationStep === 'loading' ? (
                                <motion.div
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="h-full flex flex-col items-center justify-center"
                                >
                                    <div className="relative">
                                        <div className="w-24 h-24 border-4 border-[#1A1A1A] border-t-[#8B5CF6] rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Sparkles size={24} className="text-white fill-white animate-pulse" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mt-8 animate-pulse">Generating Assets...</h3>
                                    <p className="text-[#666] text-sm mt-2">Putting pixels together</p>
                                </motion.div>
                            ) : generationStep === 'storyboard' ? (
                                <motion.div
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="h-full max-w-7xl mx-auto flex flex-col"
                                >
                                    <div className="flex justify-between items-end mb-8">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">Select a Version</h2>
                                            <p className="text-[#666] text-sm mt-1">Choose the best starting point for your video.</p>
                                        </div>
                                        <button onClick={resetFlow} className="text-sm text-[#8B5CF6] hover:underline">Cancel Generation</button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-6">
                                        {storyboards.map((idx) => (
                                            <motion.button
                                                key={idx}
                                                onClick={() => handleStoryboardSelect(idx)}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className="aspect-video bg-[#121212] border border-[#222] rounded-xl overflow-hidden hover:border-[#8B5CF6] transition-all relative group"
                                            >
                                                <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center text-[#333] group-hover:text-white transition-colors">
                                                    <ImageIcon size={32} />
                                                </div>
                                                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-white/70">
                                                    V{idx + 1}
                                                </div>
                                            </motion.button>
                                        ))}
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center max-w-6xl mx-auto"
                                >
                                    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-[#222]">
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#111]">
                                            <div className="text-center space-y-4">
                                                <Play size={48} className="text-white mx-auto opacity-50" />
                                                <p className="text-[#666]">Preview Render {selectedStoryboard !== null ? selectedStoryboard + 1 : 1}</p>
                                            </div>
                                        </div>

                                        {/* Overlay Actions */}
                                        <div className="absolute top-6 right-6 flex gap-2">
                                            <button className="p-2 bg-black/50 backdrop-blur rounded-lg hover:bg-white hover:text-black transition-colors">
                                                <Share2 size={18} />
                                            </button>
                                            <button className="p-2 bg-black/50 backdrop-blur rounded-lg hover:bg-white hover:text-black transition-colors">
                                                <Download size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 mt-8">
                                        <button onClick={resetFlow} className="px-8 py-3 bg-[#1A1A1A] text-white rounded-lg font-bold text-sm hover:bg-[#222] transition-colors border border-[#333]">
                                            Create New
                                        </button>
                                        <button className="px-8 py-3 bg-[#8B5CF6] text-white rounded-lg font-bold text-sm hover:bg-[#7C3AED] transition-colors shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                                            Upscale to 4K
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </main>

            </div>
        </div>
    );
}
