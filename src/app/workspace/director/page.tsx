'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
    Film,
    Clock,
    Loader2,
    Clapperboard,
    Send,
    RotateCcw,
    MonitorPlay,
    Smartphone,
    Square,
    Tv,
    Share2,
    Download,
    Volume2,
    CheckCircle2,
    CheckCircle,
    AlertCircle,
    Mic,
    Video,
    Scissors,
} from 'lucide-react';
import { useDirectorFlow } from '../../../hooks/useDirectorFlow';
import type { CharacterSheet } from '../../../hooks/useDirectorFlow';
import { UserCircle2, PlusCircle, XCircle, ImagePlus } from 'lucide-react';

// ── Pipeline progress component ────────────────────────────────────────────────
const PIPELINE_STEPS = [
    { key: 'generating_narration', label: 'Writing narration script', icon: Mic },
    { key: 'fetching_videos', label: 'Fetching scene footage', icon: Video },
    { key: 'generating_audio', label: 'Generating audio', icon: Volume2 },
    { key: 'stitching', label: 'Stitching final cut', icon: Scissors },
];
const PIPELINE_KEYS = PIPELINE_STEPS.map(s => s.key);

function PipelineProgress({ currentState }: { currentState: string }) {
    const currentIdx = PIPELINE_KEYS.indexOf(currentState);
    return (
        <div className="space-y-3 py-2">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-[#ff6d1f] mb-4">Cinematic Engine Running</p>
            {PIPELINE_STEPS.map((step, idx) => {
                const isDone = idx < currentIdx;
                const isActive = idx === currentIdx;
                const isPending = idx > currentIdx;
                const Icon = step.icon;
                return (
                    <div key={step.key} className={`flex items-center gap-3 transition-all duration-500 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-all ${isDone ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                            isActive ? 'bg-[#ff6d1f]/20 border-[#ff6d1f]/60 text-[#ff6d1f]' :
                                'bg-white/5 border-white/10 text-gray-600'
                            }`}>
                            {isDone ? <CheckCircle2 size={14} /> :
                                isActive ? <Loader2 size={14} className="animate-spin" /> :
                                    <Icon size={14} />}
                        </div>
                        <span className={`text-xs font-semibold ${isDone ? 'text-green-400' :
                            isActive ? 'text-white' :
                                'text-gray-600'
                            }`}>{step.label}</span>
                        {isDone && <div className="h-px flex-1 bg-green-500/20" />}
                        {isActive && <div className="h-px flex-1 bg-gradient-to-r from-[#ff6d1f]/60 to-transparent animate-pulse" />}
                    </div>
                );
            })}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DirectorWorkstation() {
    const {
        messages,
        currentState,
        project,
        analyzedScenes,
        pipelineStep,
        pipelineError,
        handleNext,
        handleSceneConfirmation,
        updateScene,
        resetFlow,
        submitCharacterSheets,
    } = useDirectorFlow();

    const [inputText, setInputText] = useState('');
    // Local character sheets — flushed into the hook on Continue
    const [pendingSheets, setPendingSheets] = useState<CharacterSheet[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    const isPipelineRunning = ['generating_narration', 'fetching_videos', 'generating_audio', 'stitching'].includes(currentState);
    const isGeneratingScenes = currentState === 'generating_scenes';

    useEffect(() => {
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
    }, [messages, currentState]);

    const onSend = () => {
        if (!inputText.trim()) return;
        handleNext(inputText);
        setInputText('');
    };

    const handleQuickChoice = (choice: string) => handleNext(choice);

    const isInputDisabled =
        isPipelineRunning ||
        isGeneratingScenes ||
        currentState === 'character_sheets' ||
        currentState === 'complete';

    // ── Character sheet helpers (local, flushed on Continue) ──────────────────
    const addPendingSheet = () => setPendingSheets(prev => [...prev, { name: '', description: '' }]);
    const removePendingSheet = (i: number) => setPendingSheets(prev => prev.filter((_, idx) => idx !== i));
    const updatePendingSheet = (i: number, field: keyof CharacterSheet, value: string) =>
        setPendingSheets(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

    const handleImageUpload = (i: number, file: File) => {
        const reader = new FileReader();
        reader.onload = e => {
            const dataUrl = e.target?.result as string;
            updatePendingSheet(i, 'imageDataUrl', dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleContinueSheets = () => {
        submitCharacterSheets(pendingSheets);
    };

    const handleSkipSheets = () => {
        submitCharacterSheets([]);
    };

    return (
        <div className="h-screen w-screen bg-[#2b2b2b] text-[#E0E0E0] font-sans flex flex-col overflow-hidden relative">
            {/* Cinematic Vignette */}
            <div className="fixed inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
            <div className="fixed inset-0 pointer-events-none z-10 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(255,109,31,0.05)_100%)] mix-blend-screen" />

            {/* Nav */}
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
                        { name: 'Product Studio', href: '/workspace/product' },
                        { name: 'Social Media', href: '/workspace/social' },
                        { name: 'Director', href: '/workspace/director' },
                    ].map(item => (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === item.href ? 'text-[#ff6d1f]' : 'text-white/40 hover:text-white'}`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isPipelineRunning || isGeneratingScenes ? 'bg-[#ff6d1f]' : 'bg-green-500'}`} />
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                        {isPipelineRunning ? 'Generating' : isGeneratingScenes ? 'Analyzing' : 'Active'}
                    </span>
                </div>
            </nav>

            {/* Chat */}
            <main className="flex-1 flex flex-col items-center relative z-20 overflow-hidden pt-10">
                <div className="w-full max-w-4xl flex-1 overflow-y-auto px-6 pb-72 space-y-8 scroll-smooth scrollbar-hide" data-lenis-prevent>
                    <AnimatePresence>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[86%] w-full ${msg.role === 'user' ? 'bg-[#ff6d1f] text-white max-w-[70%]' : 'bg-white/5 border border-white/10'} p-5 rounded-2xl shadow-2xl`}>

                                    {/* ── Character Sheet Upload Card ── */}
                                    {msg.type === 'character_sheets' ? (
                                        <div className="space-y-5">
                                            <p className="font-bold text-[#ff6d1f] uppercase tracking-widest text-xs flex items-center gap-2">
                                                <UserCircle2 size={14} /> Character Sheets <span className="text-white/30 normal-case font-normal">(optional)</span>
                                            </p>

                                            {/* Sheet list */}
                                            <div className="space-y-4">
                                                {pendingSheets.map((sheet, i) => (
                                                    <div key={i} className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3 hover:border-[#ff6d1f]/30 transition-colors">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-[10px] uppercase font-black text-[#ff6d1f] tracking-widest">Character {i + 1}</p>
                                                            <button onClick={() => removePendingSheet(i)} className="text-white/30 hover:text-red-400 transition-colors">
                                                                <XCircle size={16} />
                                                            </button>
                                                        </div>

                                                        {/* Image upload */}
                                                        <label className="flex items-center gap-3 cursor-pointer group">
                                                            <div className={`w-16 h-16 rounded-xl border ${sheet.imageDataUrl ? 'border-[#ff6d1f]/40' : 'border-white/10 border-dashed'} flex items-center justify-center overflow-hidden bg-white/5 shrink-0 transition-colors group-hover:border-[#ff6d1f]/50`}>
                                                                {sheet.imageDataUrl
                                                                    ? <img src={sheet.imageDataUrl} alt="char" className="w-full h-full object-cover" />
                                                                    : <ImagePlus size={20} className="text-white/30 group-hover:text-[#ff6d1f] transition-colors" />}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500">
                                                                <p className="font-bold uppercase tracking-wider text-white/50">Upload Image</p>
                                                                <p>JPG, JPEG or PNG</p>
                                                            </div>
                                                            <input
                                                                type="file"
                                                                accept=".jpg,.jpeg,.png"
                                                                className="hidden"
                                                                onChange={e => { if (e.target.files?.[0]) handleImageUpload(i, e.target.files[0]); }}
                                                            />
                                                        </label>

                                                        {/* Name */}
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Character Name</label>
                                                            <input
                                                                value={sheet.name}
                                                                onChange={e => updatePendingSheet(i, 'name', e.target.value)}
                                                                placeholder="e.g. Aria"
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-[#ff6d1f]/50 transition-colors placeholder:text-gray-600"
                                                            />
                                                        </div>

                                                        {/* Description */}
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Description</label>
                                                            <textarea
                                                                value={sheet.description}
                                                                onChange={e => updatePendingSheet(i, 'description', e.target.value)}
                                                                placeholder="Appearance, personality, role in the story…"
                                                                rows={2}
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none focus:border-[#ff6d1f]/50 transition-colors resize-none placeholder:text-gray-600"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Add character button */}
                                            <button
                                                onClick={addPendingSheet}
                                                className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-[#ff6d1f] hover:border-[#ff6d1f]/40 transition-all flex items-center justify-center gap-2"
                                            >
                                                <PlusCircle size={14} /> Add Character
                                            </button>

                                            {/* Action buttons */}
                                            <div className="flex gap-3 pt-1">
                                                <button
                                                    onClick={handleSkipSheets}
                                                    className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                                >
                                                    Skip
                                                </button>
                                                <button
                                                    onClick={handleContinueSheets}
                                                    className="flex-1 py-3 bg-[#ff6d1f] hover:bg-[#e05e1a] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95"
                                                >
                                                    <CheckCircle size={13} /> Continue
                                                </button>
                                            </div>
                                        </div>

                                        /* ── Scene Review Card ── */
                                    ) : msg.type === 'scene_review' && analyzedScenes ? (
                                        <div className="space-y-4">
                                            <p className="font-bold text-[#ff6d1f] uppercase tracking-widest text-xs flex items-center gap-2">
                                                <Film size={14} /> Scene Breakdown
                                            </p>
                                            <div className="space-y-3">
                                                {analyzedScenes.map((scene, idx) => (
                                                    <div key={idx} className="bg-black/40 rounded-xl p-4 border border-white/5 hover:border-[#ff6d1f]/30 transition-colors">
                                                        <p className="text-[#ff6d1f] font-bold text-xs mb-3">Scene {idx + 1}</p>
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Visuals</label>
                                                                <textarea
                                                                    value={scene.primary_visuals}
                                                                    onChange={e => updateScene(idx, 'primary_visuals', e.target.value)}
                                                                    disabled={isPipelineRunning}
                                                                    rows={3}
                                                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-[#ff6d1f]/50 transition-colors resize-none disabled:opacity-50"
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Objective</label>
                                                                    <input
                                                                        value={scene.scene_objective}
                                                                        onChange={e => updateScene(idx, 'scene_objective', e.target.value)}
                                                                        disabled={isPipelineRunning}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#ff6d1f]/50 disabled:opacity-50"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Mood</label>
                                                                    <input
                                                                        value={scene.emotional_tone}
                                                                        onChange={e => updateScene(idx, 'emotional_tone', e.target.value)}
                                                                        disabled={isPipelineRunning}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#ff6d1f]/50 disabled:opacity-50"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    onClick={handleSceneConfirmation}
                                                    disabled={isPipelineRunning}
                                                    className="px-6 py-3 bg-[#ff6d1f] hover:bg-[#e05e1a] text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                                >
                                                    {isPipelineRunning
                                                        ? <><Loader2 size={13} className="animate-spin" /> Generating...</>
                                                        : <><CheckCircle size={13} /> Confirm &amp; Generate</>}
                                                </button>
                                            </div>
                                        </div>

                                        /* ── Pipeline Progress Card ── */
                                    ) : msg.type === 'progress' ? (
                                        <div className="space-y-4 min-w-[300px]">
                                            <PipelineProgress currentState={currentState} />
                                            {isPipelineRunning && pipelineStep && (
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{pipelineStep}</p>
                                            )}
                                        </div>

                                        /* ── Result Card ── */
                                    ) : msg.type === 'result' ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 text-[#ff6d1f] mb-2">
                                                <div className="p-1 px-2.5 bg-[#ff6d1f]/20 rounded-full border border-[#ff6d1f]/30">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Final Cut Ready</span>
                                                </div>
                                                <div className="h-px flex-1 bg-gradient-to-r from-[#ff6d1f]/30 to-transparent" />
                                            </div>

                                            {/* Video player */}
                                            <div className="aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] relative border border-white/10 group">
                                                {project.stitchedVideoUrl ? (
                                                    <video src={project.stitchedVideoUrl} controls autoPlay playsInline className="w-full h-full object-contain bg-[#050505]" />
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-[#121212] to-black flex flex-col items-center justify-center space-y-4">
                                                        <Loader2 className="animate-spin text-[#ff6d1f]" size={40} />
                                                        <p className="text-xs font-bold uppercase tracking-widest text-[#ff6d1f]">Connecting Master Stream...</p>
                                                    </div>
                                                )}
                                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30 translate-y-2 group-hover:translate-y-0">
                                                    <a href={project.stitchedVideoUrl || '#'} download className="p-2.5 bg-black/60 backdrop-blur-xl rounded-xl hover:bg-white hover:text-black transition-all border border-white/5 shadow-2xl flex items-center" title="Download">
                                                        <Download size={16} />
                                                    </a>
                                                    <button className="p-2.5 bg-black/60 backdrop-blur-xl rounded-xl hover:bg-white hover:text-black transition-all border border-white/5 shadow-2xl" title="Share">
                                                        <Share2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Audio player */}
                                            {project.audioUrl && (
                                                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-[#ff6d1f]/10 rounded-2xl flex items-center justify-center text-[#ff6d1f] border border-[#ff6d1f]/20">
                                                                <Volume2 size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-0.5">Master Score</p>
                                                                <p className="text-xs font-bold text-white/90">AI Cinematic Narration</p>
                                                            </div>
                                                        </div>
                                                        <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                                                            <span className="text-[9px] font-black uppercase text-green-500 tracking-widest">OpenAI TTS</span>
                                                        </div>
                                                    </div>
                                                    <audio src={project.audioUrl} controls className="w-full h-10 accent-[#ff6d1f]" />
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-4 pt-2">
                                                <button onClick={resetFlow} className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-3 text-white/60 hover:text-white">
                                                    <RotateCcw size={14} /> Reset Console
                                                </button>
                                                <a href={project.stitchedVideoUrl || '#'} download className="flex-1 py-4 bg-[#ff6d1f] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#e05e1a] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-[0_20px_40px_-10px_rgba(255,109,31,0.3)]">
                                                    <Clapperboard size={14} /> Export Production
                                                </a>
                                            </div>
                                        </div>

                                        /* ── Regular Text ── */
                                    ) : (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Scene generation loading indicator (shown between genre step and scene_review message) */}
                    {isGeneratingScenes && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl shadow-2xl flex items-center gap-4">
                                <Loader2 size={20} className="animate-spin text-[#ff6d1f] shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-white">Generating scenes from your script…</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">Gemini AI is analyzing your vision</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Error card */}
                    {pipelineError && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                            <div className="max-w-[80%] bg-red-900/10 border border-red-500/30 p-5 rounded-2xl space-y-3">
                                <div className="flex items-center gap-2 text-red-400">
                                    <AlertCircle size={16} />
                                    <p className="text-xs font-bold uppercase tracking-widest">Generation Failed</p>
                                </div>
                                <p className="text-sm text-gray-400">{pipelineError}</p>
                                <button onClick={resetFlow} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 hover:text-white transition-colors">
                                    <RotateCcw size={12} /> Reset and try again
                                </button>
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="fixed bottom-0 left-0 w-full">
                    {/* Gradient backdrop — pointer-events-none so it never blocks clicks on messages */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2b2b2b] via-[#2b2b2b]/90 to-transparent pointer-events-none" />
                    {/* Interactive content layer */}
                    <div className="relative p-6 pt-4">
                        <div className="max-w-4xl mx-auto space-y-4">

                            {/* Quick chips */}
                            <AnimatePresence>
                                {currentState === 'character_sheets' && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
                                        <button onClick={handleSkipSheets} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-[#ff6d1f] hover:border-[#ff6d1f] transition-all flex items-center gap-2">
                                            <UserCircle2 size={14} /> Skip Character Sheets
                                        </button>
                                    </motion.div>
                                )}
                                {currentState === 'duration' && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
                                        {['5s', '10s', '30s', '60s'].map(d => (
                                            <button key={d} onClick={() => handleQuickChoice(d)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-[#ff6d1f] hover:border-[#ff6d1f] transition-all flex items-center gap-2">
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
                                            { label: '2.39:1 Cinema', icon: <MonitorPlay size={14} /> },
                                        ].map(r => (
                                            <button key={r.label} onClick={() => handleQuickChoice(r.label)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-[#ff6d1f] hover:border-[#ff6d1f] transition-all flex items-center gap-2">
                                                {r.icon} {r.label}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                                {currentState === 'genre' && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 flex-wrap">
                                        {['Cinematic', 'Anime', 'Cyberpunk', 'Realistic', 'Fantasy'].map(g => (
                                            <button key={g} onClick={() => handleQuickChoice(g)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-[#ff6d1f] hover:border-[#ff6d1f] transition-all flex items-center gap-2">
                                                <Film size={14} /> {g}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Text input */}
                            <div className="relative group">
                                <textarea
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
                                    }}
                                    disabled={isInputDisabled}
                                    placeholder={
                                        isGeneratingScenes ? 'Generating your scenes…' :
                                            isPipelineRunning ? 'Generating your film…' :
                                                currentState === 'naming' ? 'Enter project name…' :
                                                    currentState === 'scripting' ? 'Paste your script or scene description…' :
                                                        currentState === 'scene_review' ? 'Type "proceed" or click Confirm & Generate…' :
                                                            currentState === 'complete' ? 'Your film is ready.' :
                                                                'Your response…'
                                    }
                                    className="w-full bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-3xl p-5 pr-16 text-sm outline-none focus:border-[#ff6d1f]/50 transition-all resize-none shadow-2xl h-[70px] placeholder:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                />
                                <button
                                    onClick={onSend}
                                    disabled={!inputText.trim() || isInputDisabled}
                                    className="absolute right-4 bottom-4 w-9 h-9 bg-[#ff6d1f] text-white rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 shadow-lg shadow-orange-500/20"
                                >
                                    {isPipelineRunning || isGeneratingScenes
                                        ? <Loader2 size={16} className="animate-spin" />
                                        : <Send size={18} />}
                                </button>
                            </div>

                            <div className="flex items-center justify-center gap-4 text-[10px] uppercase font-black tracking-[0.2em] text-white/20">
                                <span>Director Console</span>
                                <div className="w-1 h-1 rounded-full bg-white/20" />
                                <span>{isPipelineRunning ? 'Pipeline Active' : isGeneratingScenes ? 'Scene Analysis' : 'System Primed'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
