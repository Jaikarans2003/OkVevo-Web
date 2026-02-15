'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    Film,
    Play,
    Zap,
    Clock,
    Type,
    CheckCircle2,
    Loader2,
    Sparkles,
    Clapperboard,
    Send,
    RotateCcw,
    MonitorPlay,
    Smartphone,
    Square,
    Tv,
    Share2,
    Download,
    Volume2
} from 'lucide-react';
import { useDirectorFlow, Message } from '../../../hooks/useDirectorFlow';

export default function DirectorWorkstation() {
    const { messages, currentState, project, handleNext, resetFlow } = useDirectorFlow();
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToBottom();
        }, 100);
        return () => clearTimeout(timer);
    }, [messages]);

    const onSend = () => {
        if (!inputText.trim()) return;
        handleNext(inputText);
        setInputText('');
    };

    const handleQuickChoice = (choice: string) => {
        handleNext(choice);
    };

    return (
        <div className="h-screen w-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans flex flex-col overflow-hidden relative">
            {/* Cinematic Vignette Overlays */}
            <div className="fixed inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
            <div className="fixed inset-0 pointer-events-none z-10 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(139,92,246,0.05)_100%)] mix-blend-screen" />

            {/* --- STUDIO NAVIGATION BAR --- */}
            <nav className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-2xl flex items-center justify-between px-6 z-50">
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
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Active</span>
                    </div>
                </div>
            </nav>

            {/* --- MAIN CHAT AREA --- */}
            <main className="flex-1 flex flex-col items-center relative z-20 overflow-hidden pt-10">
                <div className="w-full max-w-4xl flex-1 overflow-y-auto px-6 pb-32 space-y-8 scroll-smooth">
                    <AnimatePresence>
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-[#8B5CF6] text-white' : 'bg-white/5 border border-white/10'} p-5 rounded-2xl shadow-2xl`}>
                                    {msg.type === 'review' ? (
                                        <div className="space-y-4">
                                            <p className="font-bold text-[#8B5CF6] uppercase tracking-widest text-xs">Project Summary</p>
                                            <div className="grid grid-cols-2 gap-4 text-sm bg-black/40 p-4 rounded-xl border border-white/5">
                                                <div>
                                                    <p className="text-gray-500 text-[10px] uppercase font-bold">Project Name</p>
                                                    <p className="text-white font-medium">{project.name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-[10px] uppercase font-bold">Duration</p>
                                                    <p className="text-white font-medium">{project.duration}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-gray-500 text-[10px] uppercase font-bold">Script / Prompt</p>
                                                    <p className="text-white font-medium line-clamp-3">{project.script}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-[10px] uppercase font-bold">Style</p>
                                                    <p className="text-white font-medium">{project.genre}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-[10px] uppercase font-bold">Aspect Ratio</p>
                                                    <p className="text-white font-medium">{project.aspectRatio}</p>
                                                </div>
                                            </div>
                                            <p className="text-sm">Ready to bring this to life? Type <span className="text-[#8B5CF6] font-bold italic">"YES"</span> to proceed.</p>
                                        </div>
                                    ) : msg.type === 'result' ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 text-[#8B5CF6] mb-2">
                                                <div className="p-1 px-2.5 bg-[#8B5CF6]/20 rounded-full border border-[#8B5CF6]/30">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Final Cut Ready</span>
                                                </div>
                                                <div className="h-px flex-1 bg-gradient-to-r from-[#8B5CF6]/30 to-transparent" />
                                            </div>

                                            <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] relative border border-white/10 group">
                                                {/* Interactive Video Player */}
                                                {project.videoUrl ? (
                                                    <video
                                                        src={project.videoUrl}
                                                        controls
                                                        autoPlay
                                                        playsInline
                                                        className="w-full h-full object-contain bg-[#050505]"
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-[#121212] to-black flex flex-col items-center justify-center p-8 text-center space-y-4">
                                                        <Loader2 className="animate-spin text-[#8B5CF6]" size={40} />
                                                        <p className="text-xs font-bold uppercase tracking-widest text-[#8B5CF6]">Connecting Master Stream...</p>
                                                    </div>
                                                )}

                                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 translate-y-2 group-hover:translate-y-0">
                                                    <button className="p-2.5 bg-black/60 backdrop-blur-xl rounded-xl hover:bg-white hover:text-black transition-all border border-white/5 shadow-2xl" title="Share Production">
                                                        <Share2 size={16} />
                                                    </button>
                                                    <button className="p-2.5 bg-black/60 backdrop-blur-xl rounded-xl hover:bg-white hover:text-black transition-all border border-white/5 shadow-2xl" title="Download Master">
                                                        <Download size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Interactive Audio Player - Enhanced UI */}
                                            {project.audioUrl && (
                                                <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-[#8B5CF6]/10 rounded-2xl flex items-center justify-center text-[#8B5CF6] border border-[#8B5CF6]/20">
                                                                <Volume2 size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-0.5">Master Score</p>
                                                                <p className="text-xs font-bold text-white/90">Cinematic Ambience Vol. 1</p>
                                                            </div>
                                                        </div>
                                                        <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                                                            <span className="text-[9px] font-black uppercase text-green-500 tracking-widest">Dolby Atmos</span>
                                                        </div>
                                                    </div>
                                                    <audio
                                                        src={project.audioUrl}
                                                        controls
                                                        className="w-full h-10 accent-[#8B5CF6] transition-all opacity-80 hover:opacity-100"
                                                    />
                                                </div>
                                            )}

                                            {/* Final Action Hub */}
                                            <div className="flex gap-4 pt-4">
                                                <button
                                                    onClick={resetFlow}
                                                    className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-3 text-white/60 hover:text-white"
                                                >
                                                    <RotateCcw size={14} /> Reset Console
                                                </button>
                                                <button className="flex-2 py-4 bg-[#8B5CF6] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#7C3AED] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_20px_40px_-10px_rgba(139,92,246,0.3)]">
                                                    <Clapperboard size={14} /> Export Production
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>

                {/* --- INPUT AREA --- */}
                <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/90 to-transparent pt-10">
                    <div className="max-w-4xl mx-auto space-y-4">
                        {/* Quick Choices */}
                        <AnimatePresence>
                            {currentState === 'duration' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
                                    {['5s', '10s', '30s'].map(d => (
                                        <button key={d} onClick={() => handleQuickChoice(d)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-[#8B5CF6] hover:border-[#8B5CF6] transition-all flex items-center gap-2">
                                            <Clock size={14} /> {d}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                            {currentState === 'aspect_ratio' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
                                    {[
                                        { label: '16:9 Landscape', icon: <Tv size={14} /> },
                                        { label: '9:16 Portrait', icon: <Smartphone size={14} /> },
                                        { label: '1:1 Square', icon: <Square size={14} /> },
                                        { label: '2.39:1 Cinema', icon: <MonitorPlay size={14} /> }
                                    ].map(r => (
                                        <button key={r.label} onClick={() => handleQuickChoice(r.label)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-[#8B5CF6] hover:border-[#8B5CF6] transition-all flex items-center gap-2">
                                            {r.icon} {r.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                            {currentState === 'genre' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
                                    {['Cinematic', 'Anime', 'Cyberpunk', 'Realistic', 'Fantasy'].map(g => (
                                        <button key={g} onClick={() => handleQuickChoice(g)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-[#8B5CF6] hover:border-[#8B5CF6] transition-all flex items-center gap-2">
                                            <Film size={14} /> {g}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Text Input */}
                        <div className="relative group">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        onSend();
                                    }
                                }}
                                disabled={currentState === 'generating' || currentState === 'complete'}
                                placeholder={
                                    currentState === 'naming' ? "Enter project name..." :
                                        currentState === 'scripting' ? "Paste your script or scene description..." :
                                            currentState === 'review' ? "Type 'YES' to proceed..." :
                                                "Your response..."
                                }
                                className="w-full bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-3xl p-5 pr-16 text-sm outline-none focus:border-[#8B5CF6]/50 transition-all resize-none shadow-2xl h-[70px] placeholder:text-gray-600"
                            />
                            <button
                                onClick={onSend}
                                disabled={!inputText.trim() || currentState === 'generating' || currentState === 'complete'}
                                className="absolute right-4 bottom-4 w-9 h-9 bg-[#8B5CF6] text-white rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 shadow-lg shadow-purple-500/20"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                        <div className="flex items-center justify-center gap-4 text-[10px] uppercase font-black tracking-[0.2em] text-white/20">
                            <span>Director Console v2.0</span>
                            <div className="w-1 h-1 rounded-full bg-white/20" />
                            <span>System Primed</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
