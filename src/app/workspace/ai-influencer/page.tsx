'use client';

import { useEffect, useState, useRef } from 'react';
import { auth, storage, db } from '../../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import StudioNavbar from '@/components/workspace/StudioNavbar';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { useTheme } from '../../../contexts/ThemeContext';
import {
    FileText, Move3d, MonitorPlay, Loader2, Sparkles, Clock,
    Upload, Video, Volume2, Edit3, Users, CheckCircle2, ChevronRight,
    RotateCcw, Play, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJobId } from '../../../services/AIInfluencerService';

// ─── Types ─────────────────────────────────────────────────
type ChatStep =
    | 'upload-script'        // 1. Upload / paste script
    | 'duration'             // 2. Select duration
    | 'generating-script'    // 3. AI generating narrative script
    | 'edit-script'          // 4. Show editable script
    | 'avatar-video'         // 5. Upload avatar video
    | 'generating-tts'       // 6. Generating TTS audio
    | 'preview-audio'        // 6b. Preview audio before lipsync
    | 'generating-lipsync'   // 7. LipSync via Fal AI
    | 'complete';            // 8. Final video ready

type ChatMessage = { role: 'user' | 'assistant'; content: string };

interface ImageMoment {
    time: string;
    start: number;
    end: number;
    topic: string;
    prompt?: string;
    imageUrl: string | null;
    layout: 'split' | 'fullscreen';
}

// ─── Step Metadata ─────────────────────────────────────────
const STEPS = [
    { id: 'upload-script', label: 'Script', icon: FileText },
    { id: 'duration', label: 'Duration', icon: Clock },
    { id: 'generating-script', label: 'Generate', icon: Sparkles },
    { id: 'edit-script', label: 'Edit', icon: Edit3 },
    { id: 'avatar-video', label: 'Avatar', icon: Video },
    { id: 'generating-tts', label: 'Voice', icon: Volume2 },
    { id: 'preview-audio', label: 'Preview', icon: Play },
    { id: 'generating-lipsync', 'label': 'LipSync', icon: Sparkles },
    { id: 'complete', label: 'Done', icon: CheckCircle2 },
] as const;

const STEP_ORDER: ChatStep[] = [
    'upload-script', 'duration', 'generating-script', 'edit-script',
    'avatar-video', 'generating-tts', 'preview-audio', 'generating-lipsync', 'complete',
];

function getStepIndex(step: ChatStep) {
    return STEP_ORDER.indexOf(step);
}

// ─── Component ─────────────────────────────────────────────
function AIInfluencerWorkstation() {
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'explainers' | 'motion-control'>('explainers');
    const [isGenerating, setIsGenerating] = useState(false);

    // Step state
    const [chatStep, setChatStep] = useState<ChatStep>('upload-script');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: "Hi! I'm your AI Influencer Assistant. Let's create a professional explainer video. Start by uploading or pasting your script below.",
        },
    ]);

    // Data state
    const [rawScript, setRawScript] = useState('');
    const [selectedDuration, setSelectedDuration] = useState<15 | 30 | 0>(0);
    const [generatedScript, setGeneratedScript] = useState('');
    const [editableScript, setEditableScript] = useState('');
    const [avatarVideo, setAvatarVideo] = useState<File | null>(null);
    const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
    const [selectedGender, setSelectedGender] = useState<'male' | 'female' | ''>('');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    // Photo asset state
    const [imageTimeline, setImageTimeline] = useState<ImageMoment[]>([]);
    const [isGeneratingPhotos, setIsGeneratingPhotos] = useState(false);

    const { resolvedTheme } = useTheme();
    const scriptFileInputRef = useRef<HTMLInputElement>(null);
    const avatarFileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // ── Auth ──────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
    }, []);

    // ── Auto-scroll chat ─────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isGenerating]);

    // ── Firestore polling ────────────────────────────────
    useEffect(() => {
        if (!jobId) return;
        const unsub = onSnapshot(doc(db, 'aiInfluencerJobs', jobId), (snap) => {
            const data = snap.data();
            if (data?.status === 'complete' && data?.finalVideoUrl) {
                setFinalVideoUrl(data.finalVideoUrl);
                setChatStep('complete');
                addAssistant('🎉 Your lip-synced video is ready! Watch it in the monitor on the right.');
                setIsGenerating(false);
            } else if (data?.status === 'error') {
                addAssistant(`❌ Error: ${data.errorMessage || 'Video generation failed. Please try again.'}`);
                setChatStep('preview-audio');
                setIsGenerating(false);
            }
        });
        return () => unsub();
    }, [jobId]);

    // ── Helpers ───────────────────────────────────────────
    const addAssistant = (content: string) =>
        setChatMessages((prev) => [...prev, { role: 'assistant', content }]);

    const addUser = (content: string) =>
        setChatMessages((prev) => [...prev, { role: 'user', content }]);

    const resetFlow = () => {
        setChatStep('upload-script');
        setChatMessages([{
            role: 'assistant',
            content: "Hi! Let's create a new explainer video. Upload or paste your script below to get started.",
        }]);
        setRawScript('');
        setSelectedDuration(0);
        setGeneratedScript('');
        setEditableScript('');
        setAvatarVideo(null);
        setAvatarVideoUrl(null);
        setSelectedGender('');
        setAudioUrl(null);
        setFinalVideoUrl(null);
        setJobId(null);
        setIsGenerating(false);
        setImageTimeline([]);
        setIsGeneratingPhotos(false);
    };

    // ── Background: Extract moments + generate photos ─────
    const generatePhotoAssets = async (script: string, duration: number) => {
        setIsGeneratingPhotos(true);
        try {
            // Step A: Extract visual moments
            const momentsRes = await fetch('/api/ai-influencer/extract-moments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script, duration }),
            });
            const momentsData = await momentsRes.json();
            if (!momentsData.success || !momentsData.moments?.length) {
                console.warn('Could not extract visual moments:', momentsData.error);
                return;
            }

            // Optimistically show placeholders
            const placeholders: ImageMoment[] = momentsData.moments.map((m: any) => ({
                ...m, imageUrl: null,
            }));
            setImageTimeline(placeholders);

            // Step B: Generate images
            const tempJobId = `photos-${Date.now()}`;
            const photosRes = await fetch('/api/ai-influencer/generate-photos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: tempJobId, moments: momentsData.moments }),
            });
            const photosData = await photosRes.json();
            if (photosData.success && photosData.photos?.length) {
                setImageTimeline(photosData.photos);
            }
        } catch (err) {
            console.warn('generatePhotoAssets failed (non-blocking):', err);
        } finally {
            setIsGeneratingPhotos(false);
        }
    };

    // ── Step 1: Script file upload ────────────────────────
    const handleScriptFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setRawScript(text || '');
        };
        reader.readAsText(file);
    };

    const handleScriptSubmit = () => {
        if (!rawScript.trim()) return;
        addUser(`[Script uploaded — ${rawScript.trim().split(/\s+/).length} words]`);
        addAssistant('Great! Now select how long your explainer video should be.');
        setChatStep('duration');
    };

    // ── Step 2: Duration ─────────────────────────────────
    const handleDurationSelect = async (duration: 15 | 30) => {
        setSelectedDuration(duration);
        addUser(`${duration} seconds`);
        setIsGenerating(true);
        setChatStep('generating-script');
        addAssistant(`Analysing your script and generating a ${duration}-second narrative explainer…`);
        await generateScript(duration);
    };

    // ── Step 3: Generate script ──────────────────────────
    const generateScript = async (duration: number) => {
        try {
            const response = await fetch('/api/ai-influencer/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script: rawScript, duration }),
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Script generation failed');

            setGeneratedScript(data.script);
            setEditableScript(data.script);
            addAssistant(
                `✅ Narrative script generated (${data.wordCount} words, ~${duration}s). ` +
                `Review and edit it below, then click Continue.`
            );
            setChatStep('edit-script');
        } catch (err: any) {
            addAssistant(`❌ Script generation failed: ${err.message}`);
            setChatStep('duration');
        }
        setIsGenerating(false);
    };

    // ── Step 4 → 5: Confirm script → avatar upload ───────
    const handleConfirmScript = () => {
        addUser('[Script confirmed]');
        addAssistant('Perfect! Now upload the avatar video that will present your explainer. MP4, MOV, or WebM supported.');
        // Kick off photo asset generation in background (non-blocking)
        if (editableScript && selectedDuration) {
            addAssistant('🖼️ Generating visual asset images in the background…');
            generatePhotoAssets(editableScript, selectedDuration);
        }
        setChatStep('avatar-video');
    };

    // ── Step 5: Avatar video upload ───────────────────────
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarVideo(file);
        addUser(`[Avatar video uploaded — ${(file.size / 1024 / 1024).toFixed(1)}MB]`);
        addAssistant('Avatar received! Now choose the voice gender for your narration.');
        setChatStep('generating-tts'); // show gender selector inline
    };

    // ── Step 6a: Gender → TTS ─────────────────────────────
    const handleGenderSelect = (gender: 'male' | 'female') => {
        setSelectedGender(gender);
        addUser(`${gender === 'male' ? 'Male' : 'Female'} voice`);
    };

    const handleGenerateTTS = async () => {
        if (!editableScript || !selectedGender || !avatarVideo) return;
        setIsGenerating(true);

        const newJobId = generateJobId();
        setJobId(newJobId);

        try {
            // Upload avatar to Firebase
            addAssistant('Uploading avatar video to storage…');
            const videoRef = ref(storage, `AIInfluencer/${newJobId}/avatar.mp4`);
            await uploadBytes(videoRef, avatarVideo);
            const videoUrl = await getDownloadURL(videoRef);
            setAvatarVideoUrl(videoUrl);

            // Generate TTS
            addAssistant('Generating voice-over with OpenAI TTS…');
            const res = await fetch('/api/ai-influencer/generate-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: newJobId, script: editableScript, gender: selectedGender }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'TTS generation failed');

            let finalAudioUrl: string = data.audioUrl;

            // If the API returned a base64 data URL (no Firebase Admin on server),
            // upload the audio using the client-side Firebase SDK so Lambda can access it.
            if (data.audioUrl?.startsWith('data:')) {
                addAssistant('Uploading audio to storage…');
                const base64Data = data.audioUrl.split(',')[1];
                const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
                const audioRef = ref(storage, `AIInfluencer/${newJobId}/audio.mp3`);
                await uploadBytes(audioRef, audioBlob);
                finalAudioUrl = await getDownloadURL(audioRef);
            }

            setAudioUrl(finalAudioUrl);
            addAssistant('🎙️ Voice-over generated! Listen to the preview below. When you\'re happy, click "Generate Lip-Synced Video".');
            setChatStep('preview-audio');
        } catch (err: any) {
            addAssistant(`❌ Error: ${err.message}`);
            setChatStep('generating-tts');
        }
        setIsGenerating(false);
    };

    // ── Step 7: LipSync ───────────────────────────────────
    const handleGenerateLipSync = async () => {
        if (!jobId || !avatarVideoUrl || !audioUrl) return;

        // Guard: data URLs can't be fetched by the Lambda — should never reach here now
        if (audioUrl.startsWith('data:')) {
            addAssistant('❌ Audio URL is not a remote URL. Please re-generate the voice-over.');
            setChatStep('generating-tts');
            return;
        }

        setIsGenerating(true);
        setChatStep('generating-lipsync');
        addAssistant('🎬 Generating lip-synced video with Fal AI… This can take 2–5 minutes. Sit tight!');

        try {
            // Only pass image timeline entries that have real (non-data-URL) image URLs
            const validTimeline = imageTimeline.filter(
                p => p.imageUrl && !p.imageUrl.startsWith('data:')
            );

            console.log('🖼️ DEBUG: imageTimeline length:', imageTimeline.length);
            console.log('🖼️ DEBUG: validTimeline length:', validTimeline.length);
            console.log('🖼️ DEBUG: validTimeline:', validTimeline);

            const res = await fetch('/api/sqs/ai-influencer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId,
                    userId: user?.uid,
                    avatarVideoUrl,
                    audioUrl,
                    script: editableScript,
                    duration: selectedDuration,
                    gender: selectedGender,
                    imageTimeline: validTimeline,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to dispatch job');
            addAssistant(`Job dispatched! ${validTimeline.length > 0 ? `${validTimeline.length} photo overlays included. ` : ''}Monitoring progress… (usually 2–5 min)`);
        } catch (err: any) {
            addAssistant(`❌ Error: ${err.message}`);
            setChatStep('preview-audio');
            setIsGenerating(false);
        }
    };

    // ─── Render ─────────────────────────────────────────────
    const currentStepIdx = getStepIndex(chatStep);

    return (
        <section
            data-section-theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            className="relative min-h-screen bg-[#FAFAFA] dark:bg-black text-black dark:text-white font-sans selection:bg-[#E2FF4D]/30 overflow-x-hidden transition-colors duration-500"
        >
            <StudioNavbar
                rightContent={
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isGenerating ? 'bg-[#ff6d1f]' : chatStep === 'complete' ? 'bg-green-500' : 'bg-purple-500'}`} />
                        <span className="text-[10px] uppercase font-medium text-gray-500 tracking-widest">
                            {isGenerating ? 'Generating' : chatStep === 'complete' ? 'Complete' : 'Active'}
                        </span>
                    </div>
                }
            />

            <main className="relative z-10 pt-24 pb-16 px-4 md:px-10 max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-black dark:text-white">AI Influencer</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">From script to lip-synced video in minutes</p>
                    </div>
                    {chatStep !== 'upload-script' && (
                        <button
                            onClick={resetFlow}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-red-500 border border-gray-200 dark:border-white/10 rounded-lg hover:border-red-500/30 transition-all"
                        >
                            <RotateCcw size={11} /> Reset
                        </button>
                    )}
                </div>

                {/* Mode Tabs */}
                <div className="flex gap-1.5 mb-6">
                    {[
                        { id: 'explainers', icon: FileText, label: 'Explainers' },
                        { id: 'motion-control', icon: Move3d, label: 'Motion Control' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-1.5 py-2 px-5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${activeTab === tab.id
                                ? 'bg-white dark:bg-white text-black border-white'
                                : 'bg-[#111] dark:bg-[#111] text-white/50 border-white/10 hover:border-white/20'
                                }`}
                        >
                            <tab.icon size={10} /> {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'explainers' ? (
                    <div className="flex flex-col md:flex-row gap-8 items-start">

                        {/* ── LEFT: Step Wizard ── */}
                        <div className="w-full md:w-[700px] flex-shrink-0 flex flex-col gap-4">

                            {/* Progress Bar */}
                            <div className="flex items-center gap-0 bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-3 overflow-x-auto">
                                {STEPS.map((step, idx) => {
                                    const done = idx < currentStepIdx;
                                    const active = idx === currentStepIdx;
                                    const Icon = step.icon;
                                    return (
                                        <div key={step.id} className="flex items-center flex-shrink-0">
                                            <div className={`flex flex-col items-center gap-0.5 ${active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-25'}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${done
                                                    ? 'bg-purple-600 border-purple-600 text-white'
                                                    : active
                                                        ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                                        : 'bg-transparent border-gray-300 dark:border-white/20 text-gray-400'
                                                    }`}>
                                                    {done
                                                        ? <CheckCircle2 size={11} />
                                                        : <Icon size={10} />
                                                    }
                                                </div>
                                                <span className={`text-[8px] font-bold uppercase tracking-wider ${active ? 'text-purple-400' : 'text-gray-400 dark:text-white/30'}`}>
                                                    {step.label}
                                                </span>
                                            </div>
                                            {idx < STEPS.length - 1 && (
                                                <div className={`w-4 md:w-6 h-px mx-1 transition-all ${done ? 'bg-purple-600' : 'bg-gray-200 dark:bg-white/10'}`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Chat Panel ── */}
                            <div className="flex flex-col bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl" style={{ height: '620px' }}>
                                {/* Chat header */}
                                <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0F0F0F]/50 flex items-center gap-2 shrink-0">
                                    <div className="relative">
                                        <Sparkles size={12} className="text-purple-400" />
                                        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-black animate-pulse" />
                                    </div>
                                    <span className="text-[9px] uppercase font-bold text-black/70 dark:text-white/70 tracking-widest">Vevo AI</span>
                                    <span className="ml-auto text-[8px] text-gray-400 dark:text-white/30 uppercase tracking-wider">
                                        Step {Math.min(currentStepIdx + 1, STEPS.length)} / {STEPS.length}
                                    </span>
                                </div>

                                {/* ── Inline Step Controls ── */}
                                <AnimatePresence mode="wait">

                                    {/* STEP 1: Script upload/paste */}
                                    {chatStep === 'upload-script' && (
                                        <motion.div
                                            key="upload-script"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0D0D0D] shrink-0 space-y-2"
                                        >
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest flex items-center gap-1.5">
                                                <FileText size={9} /> Step 1 — Upload or Paste Your Script
                                            </p>
                                            <textarea
                                                value={rawScript}
                                                onChange={(e) => setRawScript(e.target.value)}
                                                placeholder="Paste your script here, or upload a .txt file below…"
                                                className="w-full h-28 p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/40 text-[11px] text-black dark:text-white focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none resize-none placeholder-black/25 dark:placeholder-white/20 leading-relaxed"
                                            />
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="file"
                                                    ref={scriptFileInputRef}
                                                    onChange={handleScriptFileUpload}
                                                    accept=".txt,.md"
                                                    className="hidden"
                                                />
                                                <button
                                                    onClick={() => scriptFileInputRef.current?.click()}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-white/20 bg-transparent hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:border-purple-400/50 text-[9px] text-black/50 dark:text-white/40 transition-all"
                                                >
                                                    <Upload size={10} /> Upload .txt file
                                                </button>
                                                <button
                                                    onClick={handleScriptSubmit}
                                                    disabled={!rawScript.trim()}
                                                    className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-purple-500 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    Continue <ChevronRight size={11} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* STEP 2: Duration */}
                                    {chatStep === 'duration' && (
                                        <motion.div
                                            key="duration"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="px-4 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0D0D0D] shrink-0 space-y-2"
                                        >
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest flex items-center gap-1.5">
                                                <Clock size={9} /> Step 2 — Select Narration Duration
                                            </p>
                                            <div className="flex gap-2">
                                                {([15, 30] as const).map((d) => (
                                                    <button
                                                        key={d}
                                                        onClick={() => handleDurationSelect(d)}
                                                        disabled={isGenerating}
                                                        className="flex-1 py-3 rounded-xl font-bold text-[11px] tracking-wider border transition-all flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed bg-white/60 dark:bg-black/40 border-gray-200 dark:border-white/10 text-black/70 dark:text-white/70 hover:border-purple-500/40 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                                                    >
                                                        <Clock size={14} className="text-purple-400" />
                                                        <span>{d} seconds</span>
                                                        <span className="text-[8px] text-gray-400 font-normal">~{Math.floor(d * 2.5)} words</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* STEP 4: Edit Script */}
                                    {chatStep === 'edit-script' && (
                                        <motion.div
                                            key="edit-script"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="px-4 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0D0D0D] shrink-0 space-y-2"
                                        >
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest flex items-center gap-1.5">
                                                <Edit3 size={9} /> Step 4 — Review & Edit Script
                                            </p>
                                            <textarea
                                                value={editableScript}
                                                onChange={(e) => setEditableScript(e.target.value)}
                                                className="w-full h-28 p-3 rounded-lg border border-purple-500/30 bg-white/70 dark:bg-black/40 text-[11px] text-black dark:text-white focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 outline-none resize-none leading-relaxed"
                                            />
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[8px] text-gray-400">{editableScript.trim().split(/\s+/).length} words</span>
                                                <button
                                                    onClick={handleConfirmScript}
                                                    disabled={!editableScript.trim()}
                                                    className="py-2 px-5 rounded-lg bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-purple-500 transition-all flex items-center gap-1.5 disabled:opacity-40"
                                                >
                                                    Confirm Script <ChevronRight size={11} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* STEP 5: Avatar Video Upload */}
                                    {chatStep === 'avatar-video' && (
                                        <motion.div
                                            key="avatar-video"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="px-4 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0D0D0D] shrink-0 space-y-2"
                                        >
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest flex items-center gap-1.5">
                                                <Video size={9} /> Step 5 — Upload Avatar Video
                                            </p>
                                            <input
                                                type="file"
                                                ref={avatarFileInputRef}
                                                onChange={handleAvatarUpload}
                                                accept="video/mp4,video/mov,video/webm,video/quicktime"
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => avatarFileInputRef.current?.click()}
                                                className="w-full py-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/15 bg-white/50 dark:bg-black/30 hover:border-purple-400/60 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all flex flex-col items-center justify-center gap-2 group"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <Upload size={18} className="text-purple-500" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[11px] font-semibold text-black/70 dark:text-white/70">Click to upload avatar video</p>
                                                    <p className="text-[9px] text-gray-400 mt-0.5">MP4, MOV, WebM · Max 200MB</p>
                                                </div>
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* STEP 6: Voice & TTS */}
                                    {chatStep === 'generating-tts' && (
                                        <motion.div
                                            key="generating-tts"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="px-4 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0D0D0D] shrink-0 space-y-2"
                                        >
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest flex items-center gap-1.5">
                                                <Users size={9} /> Step 6 — Select Voice & Generate Audio
                                            </p>
                                            <div className="flex gap-2 mb-1">
                                                {(['male', 'female'] as const).map((g) => (
                                                    <button
                                                        key={g}
                                                        onClick={() => handleGenderSelect(g)}
                                                        disabled={isGenerating}
                                                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${selectedGender === g
                                                            ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-600/20'
                                                            : 'bg-white/60 dark:bg-black/40 border-gray-200 dark:border-white/10 text-black/60 dark:text-white/60 hover:border-purple-400/40'
                                                            }`}
                                                    >
                                                        <Volume2 size={10} />
                                                        {g === 'male' ? 'Male (Onyx)' : 'Female (Nova)'}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={handleGenerateTTS}
                                                disabled={!selectedGender || isGenerating}
                                                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-500 text-white text-[10px] font-bold uppercase tracking-wider hover:from-purple-500 hover:to-violet-400 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                                            >
                                                {isGenerating
                                                    ? <><Loader2 size={12} className="animate-spin" /> Generating Audio…</>
                                                    : <><Volume2 size={12} /> Generate Voice-Over</>
                                                }
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* STEP 7: Preview Audio + Trigger LipSync */}
                                    {chatStep === 'preview-audio' && audioUrl && (
                                        <motion.div
                                            key="preview-audio"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="px-4 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0D0D0D] shrink-0 space-y-2"
                                        >
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest flex items-center gap-1.5">
                                                <Volume2 size={9} /> Step 7 — Preview Audio
                                            </p>
                                            <audio controls src={audioUrl} className="w-full h-8 rounded-lg" />
                                            <button
                                                onClick={handleGenerateLipSync}
                                                className="w-full py-3 rounded-xl font-bold text-[10px] uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 via-violet-500 to-blue-500 text-white hover:from-purple-400 hover:to-blue-400 shadow-xl hover:shadow-purple-500/30 hover:scale-[1.01]"
                                            >
                                                <Sparkles size={13} /> Generate Lip-Synced Video
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* STEP 8: Generating LipSync (waiting) */}
                                    {chatStep === 'generating-lipsync' && (
                                        <motion.div
                                            key="generating-lipsync"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="px-4 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0D0D0D] shrink-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
                                                    <Loader2 size={14} className="text-purple-400 animate-spin" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-black/80 dark:text-white/80">Generating Lip-Synced Video</p>
                                                    <p className="text-[9px] text-gray-400 mt-0.5">Fal AI is processing… usually 2–5 minutes.</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* STEP COMPLETE */}
                                    {chatStep === 'complete' && (
                                        <motion.div
                                            key="complete"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                                            className="px-4 py-4 border-b border-gray-200 dark:border-white/5 bg-green-50/50 dark:bg-green-900/10 shrink-0 space-y-2"
                                        >
                                            <div className="flex items-center gap-2 text-green-500">
                                                <CheckCircle2 size={14} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Video Ready!</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {finalVideoUrl && (
                                                    <a
                                                        href={finalVideoUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        download
                                                        className="flex-1 py-2 rounded-lg bg-green-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-green-500 transition-all flex items-center justify-center gap-1.5"
                                                    >
                                                        <Download size={11} /> Download Video
                                                    </a>
                                                )}
                                                <button
                                                    onClick={resetFlow}
                                                    className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-black/60 dark:text-white/60 text-[10px] font-bold uppercase tracking-wider hover:border-purple-400/40 transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <RotateCcw size={11} /> New Video
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                </AnimatePresence>

                                {/* ── Chat Messages ── */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white/30 dark:bg-[#070707]">
                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-relaxed shadow-sm ${msg.role === 'user'
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-100 dark:bg-[#151515] text-black/80 dark:text-white/80 border border-gray-200 dark:border-white/5'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isGenerating && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-100 dark:bg-[#151515] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                                                <Loader2 size={10} className="animate-spin text-purple-400" />
                                                <span className="text-[10px] text-black/50 dark:text-white/50">Working…</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT: Monitor Output ── */}
                        <div className="flex-shrink-0 flex flex-col gap-4">
                            <div
                                className="w-[380px] bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden relative shadow-2xl"
                                style={{ aspectRatio: '9/16', maxHeight: '680px' }}
                            >
                                {/* Grid bg */}
                                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

                                {/* Traffic lights */}
                                <div className="absolute top-3 left-3 flex gap-1.5 z-10">
                                    <div className="w-2 h-2 rounded-full bg-red-500/40" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
                                    <div className="w-2 h-2 rounded-full bg-green-500/40" />
                                </div>

                                <AnimatePresence mode="wait">
                                    {finalVideoUrl ? (
                                        <motion.div
                                            key="video"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="absolute inset-0 flex items-center justify-center bg-black"
                                        >
                                            <video
                                                src={finalVideoUrl}
                                                controls
                                                autoPlay
                                                className="w-full h-full object-contain"
                                            />
                                        </motion.div>
                                    ) : isGenerating ? (
                                        <motion.div
                                            key="loading"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-sm"
                                        >
                                            <div className="relative">
                                                <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                                                    <Sparkles size={22} className="text-purple-400" />
                                                </div>
                                                <div className="absolute inset-0 rounded-2xl border-2 border-purple-500/30 animate-ping opacity-40" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Processing</p>
                                                <p className="text-[9px] text-white/40 mt-1">
                                                    {chatStep === 'generating-lipsync' ? 'LipSync via Fal AI…' : 'Please wait…'}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 opacity-20"
                                        >
                                            <div className="w-16 h-16 rounded-3xl border border-dashed border-black/40 dark:border-white/40 flex items-center justify-center mb-4">
                                                <MonitorPlay size={26} className="text-black dark:text-white" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-black dark:text-white mb-1">Monitor Output</h3>
                                            <p className="text-xs text-black/60 dark:text-white/60 max-w-[180px]">
                                                Your generated video will appear here
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Script quick-view panel (shown after step 4) */}
                            {editableScript && getStepIndex(chatStep) >= getStepIndex('avatar-video') && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-[380px] bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-4"
                                >
                                    <p className="text-[8px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest mb-2 flex items-center gap-1">
                                        <FileText size={8} /> Script Preview
                                    </p>
                                    <p className="text-[10px] text-black/60 dark:text-white/50 leading-relaxed line-clamp-5">
                                        {editableScript}
                                    </p>
                                </motion.div>
                            )}

                            {/* ── Photo Assets Panel ── */}
                            {(imageTimeline.length > 0 || isGeneratingPhotos) && getStepIndex(chatStep) >= getStepIndex('avatar-video') && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="w-[380px] bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-[8px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest flex items-center gap-1.5">
                                            <Sparkles size={8} /> Visual Assets
                                            {isGeneratingPhotos && (
                                                <span className="ml-1 text-purple-400 flex items-center gap-1">
                                                    <Loader2 size={7} className="animate-spin" /> Generating…
                                                </span>
                                            )}
                                        </p>
                                        <span className="text-[8px] text-gray-400">
                                            {imageTimeline.filter(p => p.imageUrl).length}/{imageTimeline.length} ready
                                        </span>
                                    </div>

                                    {/* Skeleton placeholders while generating */}
                                    {isGeneratingPhotos && imageTimeline.length === 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                            {Array.from({ length: selectedDuration === 15 ? 3 : 6 }).map((_, i) => (
                                                <div key={i} className="flex-shrink-0 w-[90px] h-[64px] rounded-lg bg-gray-200/60 dark:bg-white/5 animate-pulse" />
                                            ))}
                                        </div>
                                    )}

                                    {/* Image strip */}
                                    {imageTimeline.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                                            {imageTimeline.map((item, i) => (
                                                <div key={i} className="flex-shrink-0 snap-start w-[100px] space-y-1">
                                                    <div className="relative w-full h-[70px] rounded-lg overflow-hidden bg-gray-200/60 dark:bg-white/5">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt={item.topic} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Loader2 size={14} className="text-purple-400 animate-spin" />
                                                            </div>
                                                        )}
                                                        <div className={`absolute top-1 right-1 px-1 py-0.5 rounded text-[6px] font-bold uppercase ${item.layout === 'fullscreen' ? 'bg-orange-500 text-white' : 'bg-black/60 text-white/80'}`}>
                                                            {item.layout === 'fullscreen' ? 'Full' : 'Split'}
                                                        </div>
                                                    </div>
                                                    <p className="text-[7px] text-black/50 dark:text-white/40 truncate">{item.time}s</p>
                                                    <p className="text-[7px] text-black/70 dark:text-white/60 truncate font-medium">{item.topic}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Motion Control Tab */
                    <div className="max-w-[700px] space-y-4">
                        <div className="space-y-2">
                            <h2 className="text-xl font-semibold tracking-tight text-black dark:text-white">
                                Motion <span className="text-black/30 dark:text-white/30">Control</span>
                            </h2>
                            <p className="text-black/40 dark:text-white/40 text-[11px] leading-relaxed">
                                Control camera movements and animations with precision.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest">Camera Movement</label>
                            <textarea
                                placeholder="Describe camera path (e.g. slow dolly in, pan left to right…)"
                                className="w-full h-24 bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-[11px] text-black dark:text-white focus:border-purple-500/30 outline-none transition-colors placeholder-black/20 dark:placeholder-white/20 resize-none leading-relaxed"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest">Motion Presets</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['Camera Paths', 'Animation Control'].map((preset) => (
                                    <div key={preset} className="flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/5 rounded-lg">
                                        <div className="w-1 h-1 rounded-full bg-cyan-400/60" />
                                        <p className="text-[9px] font-bold text-black/50 dark:text-white/50 uppercase tracking-wider">{preset}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button className="w-full py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-xl">
                            <Move3d size={14} /> Apply Motion
                        </button>
                    </div>
                )}
            </main>
        </section>
    );
}

// Export wrapped with SubscriptionGuard
export default function AIInfluencerPage() {
    return (
        <SubscriptionGuard>
            <AIInfluencerWorkstation />
        </SubscriptionGuard>
    );
}
