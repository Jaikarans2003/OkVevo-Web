'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { auth, storage, db } from '../../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import StudioNavbar from '@/components/workspace/StudioNavbar';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { useTheme } from '../../../contexts/ThemeContext';
import {
    FileText, Move3d, MonitorPlay, Loader2, Sparkles, Clock,
    Upload, Video, Volume2, Edit3, Users, CheckCircle2, ChevronRight,
    RotateCcw, Play, Download, Mic2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJobId } from '../../../services/AIInfluencerService';
import SessionHistorySidebar from '@/components/workspace/SessionHistorySidebar';
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession';
import type { WorkspaceSession } from '@/services/WorkspaceSessionService';

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
    { id: 'Giving a Voice', label: 'Voice', icon: Volume2 },
    { id: 'preview-audio', label: 'Preview', icon: Play },
    { id: 'generating-lipsync', 'label': 'Animating', icon: Sparkles },
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
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // Step state
    const [chatStep, setChatStep] = useState<ChatStep>('upload-script');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: "Hi! I'm VEVO your creative Assistant. Let's create a professional explainer video. Start by uploading or pasting your script below.",
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
    const [audioSampleFile, setAudioSampleFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [waitTaskToken, setWaitTaskToken] = useState<string | null>(null);
    // Photo asset state
    const [imageTimeline, setImageTimeline] = useState<ImageMoment[]>([]);

    const { resolvedTheme } = useTheme();
    const scriptFileInputRef = useRef<HTMLInputElement>(null);
    const avatarFileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // ── Auth ──────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
    }, []);

    // ── Session history ───────────────────────────────────────
    const { sessionId, initSession, saveSession, resetSession } = useWorkspaceSession('ai-influencer', user?.uid ?? null);

    // Auto-create session when script is first submitted
    useEffect(() => {
        if (sessionId || !user?.uid || !rawScript || chatStep === 'upload-script') return;
        initSession(
            rawScript.substring(0, 60) || 'AI Influencer Session',
            { chatStep },
            chatMessages.map(m => ({ role: m.role, content: m.content })),
        );
    }, [chatStep]);

    // Auto-save messages & step whenever they change
    useEffect(() => {
        if (!sessionId || chatMessages.length === 0) return;
        const state: Record<string, any> = { chatStep };
        if (finalVideoUrl) state.finalVideoUrl = finalVideoUrl;
        if (audioUrl) state.audioUrl = audioUrl;
        saveSession(state, chatMessages);
    }, [chatMessages, chatStep]);

    // ── Auto-scroll chat ─────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isGenerating]);

    // ── Auto-resume pipeline when token arrives ───────────
    useEffect(() => {
        if (waitTaskToken && avatarVideoUrl && jobId && user?.uid) {
            console.log('🚀 Auto-resuming pipeline with received token...');
            handleResumePipeline(waitTaskToken, avatarVideoUrl);
        }
    }, [waitTaskToken, avatarVideoUrl]);

    const handleResumePipeline = async (token: string, videoUrl: string) => {
        try {
            const res = await fetch('/api/sqs/ai-influencer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'resume',
                    jobId,
                    userId: user.uid,
                    taskToken: token,
                    avatarVideoUrl: videoUrl,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to resume pipeline');
            console.log('✅ Pipeline resumed successfully');
            setWaitTaskToken(null);
            addAssistant('🎬 Preparation complete! Moving to Lip-Sync stage...');
        } catch (err: any) {
            console.error('Failed to resume pipeline:', err);
        }
    };

    // ── Firestore polling ────────────────────────────────
    useEffect(() => {
        if (!jobId || !user?.uid) return;
        // Poll from user-specific subcollection: users/{userId}/aiInfluencerJobs/{jobId}
        const unsub = onSnapshot(doc(db, 'users', user.uid, 'aiInfluencerJobs', jobId), (snap) => {
            const data = snap.data();
            if (!data) return;

            // 1. Check for generated script
            if (data.script && chatStep === 'generating-script') {
                setGeneratedScript(data.script);
                setEditableScript(data.script);
                setChatStep('edit-script');
                addAssistant(`✅ Narrative script generated (~${selectedDuration}s). Review and edit it below, then click Continue.`);
            }

            // 2. Check for visual assets (images)
            if (data.assetResults || data.imageTimeline) {
                const results = data.assetResults || [];
                const timeline = data.imageTimeline || [];

                // If we have a timeline from Gemini but no images yet, show placeholders
                if (timeline.length > 0 && imageTimeline.length === 0) {
                    setImageTimeline(timeline);
                }

                // If images are arriving from webhook, update the timeline
                if (results.length > 0) {
                    const images = results
                        .filter((r: any) => r.type === 'image')
                        .map((r: any) => r.output.images?.[0]?.url)
                        .filter(Boolean);

                    if (images.length > 0) {
                        setImageTimeline(prev => prev.map((item, idx) => ({
                            ...item,
                            imageUrl: images[idx] || item.imageUrl
                        })));
                    }

                    const audioResult = results.find((r: any) => r.type === 'audio');
                    if (audioResult?.output?.audio_file?.url && !audioUrl) {
                        setAudioUrl(audioResult.output.audio_file.url);
                    }
                }
            }

            // 3. Check for wait token (human-in-the-loop pause)
            if (data.waitTaskToken && !waitTaskToken) {
                console.log('⏳ Human wait token received:', data.waitTaskToken);
                setWaitTaskToken(data.waitTaskToken);
            }

            // 4. Check for final completion
            if (data.status === 'complete' && data.finalVideoUrl) {
                setFinalVideoUrl(data.finalVideoUrl);
                setChatStep('complete');
                addAssistant('🎉 Your lip-synced video is ready! Watch it in the monitor on the right.');
                setIsGenerating(false);
            } else if (data.status === 'error') {
                addAssistant(`❌ Error: ${data.errorMessage || 'Video generation failed. Please try again.'}`);
                setChatStep('preview-audio');
                setIsGenerating(false);
            }
        });
        return () => unsub();
    }, [jobId, user?.uid]);

    // ── Helpers ───────────────────────────────────────────
    const addAssistant = (content: string) =>
        setChatMessages((prev) => [...prev, { role: 'assistant', content }]);

    const addUser = (content: string) =>
        setChatMessages((prev) => [...prev, { role: 'user', content }]);

    const resetFlow = () => {
        setChatStep('upload-script');
        setChatMessages([{
            role: 'assistant',
            content: "Hi! I'm VEVO Let's create a new explainer video. Upload or paste your script below to get started.",
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
        setWaitTaskToken(null);
        setIsGenerating(false);
        setImageTimeline([]);
    };

    const handleRestoreInfluencerSession = useCallback((session: WorkspaceSession) => {
        resetFlow();
        resetSession();
        // Restore visible state from session
        if (session.messages?.length) {
            setChatMessages(session.messages);
        }
        if (session.state?.chatStep) {
            setChatStep(session.state.chatStep as ChatStep);
        }
        if (session.state?.finalVideoUrl) setFinalVideoUrl(session.state.finalVideoUrl);
        if (session.state?.audioUrl) setAudioUrl(session.state.audioUrl);
    }, [resetSession]);

    const handleNewInfluencerSession = useCallback(() => {
        resetFlow();
        resetSession();
    }, [resetSession]);


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

    // ── Step 2: Duration → Phase 1 Script Generation ─────
    const handleDurationSelect = async (duration: 15 | 30) => {
        if (!user?.uid) {
            addAssistant('❌ Please sign in to generate videos.');
            return;
        }

        setSelectedDuration(duration);
        addUser(`${duration} seconds`);

        setIsGenerating(true);
        setChatStep('generating-script');
        addAssistant(`Analyzing your script and generating a ${duration}-second narrative explainer with Gemini...`);

        try {
            // Phase 1: Generate script + moments synchronously via Next.js API
            const res = await fetch('/api/ai-influencer/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: rawScript,
                    duration: duration,
                }),
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.error || 'Failed to generate script');

            console.log('✅ Script generated:', data.wordCount, 'words');
            console.log('✅ Visual moments extracted:', data.moments?.length || 0);

            setGeneratedScript(data.script);
            setEditableScript(data.script);

            // Store moments for later use
            if (data.moments && Array.isArray(data.moments)) {
                const momentsWithLayout: ImageMoment[] = data.moments.map((m: any) => ({
                    time: `${m.start}-${m.end}s`,
                    start: m.start,
                    end: m.end,
                    topic: m.topic || 'Visual moment',
                    prompt: m.prompt || m.topic,
                    imageUrl: null,
                    layout: 'split' as const,
                }));
                setImageTimeline(momentsWithLayout);
            }

            addAssistant(`✨ Script generated! (~${data.wordCount} words)\n🖼️ ${data.moments?.length || 0} visual moments extracted.\n\nReview and edit your script below. When ready, click "Confirm Script" to proceed with video generation.`);
            setChatStep('edit-script');
            setIsGenerating(false);
        } catch (err: any) {
            addAssistant(`❌ Failed to generate script: ${err.message}`);
            setIsGenerating(false);
            setChatStep('duration');
        }
    };

    // ── Step 3: Generate script ──────────────────────────
    // REDUNDANT - Now handled by Step Function
    const generateScript = async (duration: number, scriptToSend: string) => {
        console.log('Skipping client-side script generation, Step Function is taking over.');
    };

    // ── Step 4: Confirm script → Phase 2 Start Step Function ───────
    const handleConfirmScript = async () => {
        if (!user?.uid || !editableScript || !selectedDuration) {
            addAssistant('❌ Missing required data to start video generation.');
            return;
        }

        const newJobId = generateJobId();
        setJobId(newJobId);

        addUser('[Script confirmed]');
        addAssistant('Perfect! Your script is ready.');
        addAssistant('Now, please upload the avatar video that will present your explainer. MP4, MOV, or WebM supported.');

        try {
            // Save initial job state to Firestore
            const jobRef = doc(db, 'users', user.uid, 'aiInfluencerJobs', newJobId);
            await setDoc(jobRef, {
                jobId: newJobId,
                userId: user.uid,
                script: editableScript,
                moments: imageTimeline.map(m => ({
                    start: m.start,
                    end: m.end,
                    topic: m.topic,
                    prompt: m.prompt,
                })),
                duration: selectedDuration,
                status: 'awaiting-avatar',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            console.log('✅ Script and moments saved to Firestore');
            setChatStep('avatar-video');
        } catch (err: any) {
            addAssistant(`❌ Failed to save script: ${err.message}`);
        }
    };

    // ── Step 5: Avatar video upload ───────────────────────
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid || !jobId) return;

        setAvatarVideo(file);
        addUser(`[Avatar video uploaded — ${(file.size / 1024 / 1024).toFixed(1)}MB]`);
        addAssistant('Uploading avatar video to storage…');
        setIsGenerating(true);

        try {
            // Upload avatar to Firebase Storage
            const videoRef = ref(storage, `AIInfluencer/${jobId}/avatar.mp4`);
            await uploadBytes(videoRef, file);
            const videoUrl = await getDownloadURL(videoRef);
            setAvatarVideoUrl(videoUrl);

            // Update Firestore with avatar URL
            const jobRef = doc(db, 'users', user.uid, 'aiInfluencerJobs', jobId);
            await setDoc(jobRef, {
                avatarVideoUrl: videoUrl,
                status: 'awaiting-voice',
                updatedAt: new Date().toISOString(),
            }, { merge: true });

            addAssistant('✅ Avatar uploaded! Now choose the voice for your narration.');
            addAssistant('You can either select a preset voice (Male/Female) or upload your own voice sample for cloning.');
            setChatStep('generating-tts');
            setIsGenerating(false);
        } catch (err: any) {
            addAssistant(`❌ Failed to upload avatar: ${err.message}`);
            setIsGenerating(false);
        }
    };

    // ── Step 6a: Gender → TTS ─────────────────────────────
    const handleGenderSelect = (gender: 'male' | 'female') => {
        setSelectedGender(gender);
        addUser(`${gender === 'male' ? 'Male' : 'Female'} voice`);
    };

    const handleGenerateTTS = async () => {
        if (!editableScript || (!selectedGender && !audioSampleFile) || !avatarVideoUrl || !user?.uid || !jobId) return;
        setIsGenerating(true);

        try {
            // Get audioSampleUrl from Firestore if voice sample was uploaded
            let audioSampleUrl = null;
            if (audioSampleFile) {
                const jobRef = doc(db, 'users', user.uid, 'aiInfluencerJobs', jobId);
                const jobDoc = await getDoc(jobRef);
                if (jobDoc.exists()) {
                    audioSampleUrl = jobDoc.data()?.audioSampleUrl || null;
                }
            }

            // Update Firestore with final voice selection
            const jobRef = doc(db, 'users', user.uid, 'aiInfluencerJobs', jobId);
            await setDoc(jobRef, {
                gender: selectedGender,
                status: 'starting-pipeline',
                updatedAt: new Date().toISOString(),
            }, { merge: true });

            addAssistant('🚀 Starting AI Influencer Pipeline...');
            addAssistant('This will generate images, audio, and create your final video. This may take 2-5 minutes.');

            // Start Step Function with all data
            const res = await fetch('/api/sqs/ai-influencer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId: jobId,
                    userId: user.uid,
                    script: editableScript,
                    duration: selectedDuration,
                    avatarVideoUrl: avatarVideoUrl,
                    gender: selectedGender || 'female',
                    audioSampleUrl: audioSampleUrl,
                    moments: imageTimeline.map(m => ({
                        start: m.start,
                        end: m.end,
                        topic: m.topic,
                        prompt: m.prompt,
                    })),
                }),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to start pipeline');

            console.log('✅ Step Function started:', data.executionArn);
            addAssistant('✅ Pipeline started! Generating your AI Influencer video...');

            setChatStep('generating-lipsync');
            setIsGenerating(false);
        } catch (err: any) {
            addAssistant(`❌ Failed to start pipeline: ${err.message}`);
            setIsGenerating(false);
        }
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

        // Require authentication
        if (!user?.uid) {
            addAssistant('❌ Authentication required. Please sign in to generate AI influencer videos.');
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

            console.log('🎬 Attempting to resume Step Function with Avatar...');

            const res = await fetch('/api/sqs/ai-influencer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId,
                    userId: user.uid,
                    action: 'resume',
                    taskToken: waitTaskToken, // The token from the Human_Wait state
                    avatarVideoUrl: avatarVideoUrl,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to resume pipeline');
            addAssistant(`Pipeline resumed with your avatar video! Monitoring progress… (usually 1–3 min)`);
        } catch (err: any) {
            addAssistant(`❌ Failed to progress: ${err.message}. You might need to wait a few seconds for the system to be ready for the avatar.`);
            setChatStep('preview-audio');
            setIsGenerating(false);
        }
    };

    // ─── Render ─────────────────────────────────────────────
    const currentStepIdx = getStepIndex(chatStep);

    return (
        <section
            data-section-theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            className="relative h-screen bg-[#FAFAFA] dark:bg-black text-black dark:text-white font-sans selection:bg-[#E2FF4D]/30 overflow-hidden transition-colors duration-500"
        >
            <StudioNavbar
                rightContent={
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isGenerating ? 'bg-[#ff6d1f]' : chatStep === 'complete' ? 'bg-green-500' : 'bg-orange-500'}`} />
                        <span className="text-[10px] uppercase font-medium text-gray-500 tracking-widest">
                            {isGenerating ? 'Generating' : chatStep === 'complete' ? 'Complete' : 'Active'}
                        </span>
                    </div>
                }
            />

            {/* Workstation Area with Video Background */}
            <div
                id="workstation"
                className="relative h-screen flex flex-col pt-20"
            >
                {/* Background Video with Hue-Shift to Orange */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-100 hue-rotate-[15deg] saturate-[1.2] brightness-[1.05]"
                    style={{ filter: 'hue-rotate(140deg) saturate(1.4) brightness(0.9)' }}
                >
                    <source src="/videos/bg-blue.mp4" type="video/mp4" />
                </video>

                {/* Removed Global Overlay as requested */}

                {/* ── Body — history sidebar + main content ── */}
                <div className="flex-1 flex relative z-10 overflow-hidden">
                    {/* Session History Sidebar Overlay */}
                    {user?.uid && (
                        <div className={`absolute top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} rounded-r-[2rem] overflow-hidden shadow-2xl border-y border-r border-white/10`}>
                            <div className="relative h-full">
                                <SessionHistorySidebar
                                    userId={user.uid}
                                    feature="ai-influencer"
                                    currentSessionId={sessionId}
                                    onSelectSession={(session) => {
                                        handleRestoreInfluencerSession(session);
                                        setIsHistoryOpen(false);
                                    }}
                                    onNewSession={() => {
                                        handleNewInfluencerSession();
                                        setIsHistoryOpen(false);
                                    }}
                                    accentColor="orange"
                                />
                            </div>
                        </div>
                    )}

                    {/* Open/Close History Button */}
                    {user?.uid && (
                        <button
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            className={`fixed left-0 top-1/2 -translate-y-1/2 z-[60] p-3 bg-orange-600/90 backdrop-blur-md text-white rounded-r-2xl shadow-[0_0_20px_rgba(234,88,12,0.3)] transition-all duration-500 hover:pr-5 group ${isHistoryOpen ? 'translate-x-[288px]' : 'translate-x-0'}`}
                        >
                            {isHistoryOpen ? <ChevronRight size={18} className="rotate-180 transition-transform duration-500" /> : <Clock size={18} className="group-hover:rotate-12 transition-transform" />}
                        </button>
                    )}

                    <main className="flex-1 relative z-10 px-4 md:px-10 max-w-[1700px] mx-auto pt-8 backdrop-blur-[40px] bg-black/40 rounded-[3rem] border border-white/10 mx-6 mb-6 mt-2 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
                        {/* Header with Professional Status */}
                        {activeTab === 'explainers' ? (
                            <div className="flex flex-col md:flex-row gap-8 items-stretch justify-center flex-1 overflow-hidden pb-8">

                                {/* ── LEFT: Step Wizard ── */}
                                <div className="w-full md:w-[700px] pl-10 flex-shrink-0 flex flex-col gap-6 overflow-hidden">
                                    {/* Page Title & Status */}
                                    <div className="flex items-center gap-4 px-2 mb-2">
                                        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-[0_0_20px_rgba(234,88,12,0.15)] backdrop-blur-3xl shrink-0">
                                            <Sparkles size={20} className="text-orange-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-white">AI Influencer Studio</h1>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                                                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-orange-500/80">Neural Synthesis Protocol Active</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Chat Panel ── */}
                                    <div className="flex flex-col flex-1 min-h-0 bg-white/[0.03] backdrop-blur-[80px] border border-orange-500/40 rounded-[2.5rem] overflow-hidden shadow-[0_0_30px_rgba(234,88,12,0.15),0_30px_100px_rgba(0,0,0,0.5)] ring-1 ring-orange-500/20">
                                        {/* Chat header */}
                                        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">Neural Assistant</span>
                                            </div>
                                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                                <span className="text-[9px] text-white/40 font-black uppercase tracking-[0.1em]">
                                                    Protocol Phase {Math.min(currentStepIdx + 1, STEPS.length)} <span className="text-white/10 mx-1">/</span> {STEPS.length}
                                                </span>
                                            </div>
                                        </div>

                                        {/* ── Inline Step Controls ── */}
                                        <AnimatePresence mode="wait">

                                            {/* STEP 1: Script upload/paste */}
                                            {chatStep === 'upload-script' && (
                                                <motion.div
                                                    key="upload-script"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-5 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-4"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                            <div className="w-1 h-1 rounded-full bg-orange-500" /> Initial Narrative Script
                                                        </p>
                                                    </div>
                                                    <textarea
                                                        value={rawScript}
                                                        onChange={(e) => setRawScript(e.target.value)}
                                                        placeholder="Synthesize your story here..."
                                                        className="w-full h-32 p-5 rounded-2xl border border-white/5 bg-black/40 text-[13px] text-white/90 focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/10 outline-none resize-none placeholder-white/10 leading-relaxed transition-all shadow-inner"
                                                    />
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="file"
                                                            ref={scriptFileInputRef}
                                                            onChange={handleScriptFileUpload}
                                                            accept=".txt,.md"
                                                            className="hidden"
                                                        />
                                                        <button
                                                            onClick={() => scriptFileInputRef.current?.click()}
                                                            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] text-[10px] font-black uppercase tracking-[0.15em] text-white/50 transition-all active:scale-95"
                                                        >
                                                            <Upload size={12} strokeWidth={2.5} /> Import Source
                                                        </button>
                                                        <button
                                                            onClick={handleScriptSubmit}
                                                            disabled={!rawScript.trim()}
                                                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:from-orange-500 hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-20 disabled:cursor-not-allowed shadow-xl active:scale-95"
                                                        >
                                                            Initialise Protocol <ChevronRight size={14} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* STEP 2: Duration */}
                                            {chatStep === 'duration' && (
                                                <motion.div
                                                    key="duration"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-4"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                        <div className="w-1 h-1 rounded-full bg-orange-500" /> Temporal Calibration
                                                    </p>
                                                    <div className="flex gap-3">
                                                        {([15, 30] as const).map((d) => (
                                                            <button
                                                                key={d}
                                                                onClick={() => handleDurationSelect(d)}
                                                                disabled={isGenerating}
                                                                className="flex-1 py-4 rounded-2xl font-black text-[12px] tracking-[0.1em] border transition-all flex flex-col items-center gap-2 disabled:opacity-20 bg-white/[0.02] border-white/5 text-white/60 hover:border-orange-500/50 hover:bg-orange-600/10 hover:text-white hover:shadow-[0_0_20px_rgba(234,88,12,0.1)] active:scale-95"
                                                            >
                                                                <Clock size={16} className="text-orange-500" strokeWidth={2.5} />
                                                                <span>{d} Seconds</span>
                                                                <span className="text-[8px] text-white/20 font-black tracking-widest uppercase">~{Math.floor(d * 2.5)} Tokens</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* STEP 4: Edit Script */}
                                            {chatStep === 'edit-script' && (
                                                <motion.div
                                                    key="edit-script"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-4"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                            <div className="w-1 h-1 rounded-full bg-orange-500" /> Refined Narrative
                                                        </p>
                                                        <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{editableScript.trim().split(/\s+/).length} Words</span>
                                                    </div>
                                                    <textarea
                                                        value={editableScript}
                                                        onChange={(e) => setEditableScript(e.target.value)}
                                                        className="w-full h-32 p-5 rounded-2xl border border-orange-500/30 bg-black/40 text-[13px] text-white leading-relaxed focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 outline-none resize-none shadow-inner"
                                                    />
                                                    <button
                                                        onClick={handleConfirmScript}
                                                        disabled={!editableScript.trim()}
                                                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:from-orange-500 hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-20 active:scale-95 shadow-xl"
                                                    >
                                                        Finalise Script <ChevronRight size={14} strokeWidth={3} />
                                                    </button>
                                                </motion.div>
                                            )}

                                            {/* STEP 5: Avatar Video Upload */}
                                            {chatStep === 'avatar-video' && (
                                                <motion.div
                                                    key="avatar-video"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-4"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                        <div className="w-1 h-1 rounded-full bg-orange-500" /> Visual Identity Mapping
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
                                                        className="w-full py-8 rounded-[2rem] border-2 border-dashed border-white/10 bg-white/[0.02] hover:border-orange-500/50 hover:bg-orange-600/5 transition-all flex flex-col items-center justify-center gap-3 group active:scale-[0.98]"
                                                    >
                                                        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-orange-500/20 transition-all duration-500 shadow-2xl">
                                                            <Upload size={24} className="text-orange-500" strokeWidth={2.5} />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-[12px] font-black uppercase tracking-[0.1em] text-white/80">Upload Avatar Media</p>
                                                            <p className="text-[9px] text-white/20 mt-1 uppercase font-bold tracking-widest">MP4 / MOV / WEBM · Standard HD</p>
                                                        </div>
                                                    </button>
                                                </motion.div>
                                            )}

                                            {/* STEP 6: Voice & TTS */}
                                            {chatStep === 'generating-tts' && (
                                                <motion.div
                                                    key="generating-tts"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-5"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                        <div className="w-1 h-1 rounded-full bg-orange-500" /> Acoustic Synthesis
                                                    </p>
                                                    
                                                    <div className="space-y-3">
                                                        <input
                                                            type="file"
                                                            accept="audio/mpeg,audio/wav,audio/*"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file && user?.uid && jobId) {
                                                                    setAudioSampleFile(file);
                                                                    addUser(`[Audio Reference Uploaded — ${(file.size / 1024 / 1024).toFixed(1)}MB]`);
                                                                    addAssistant('Uploading voice sample to storage…');
                                                                    setIsGenerating(true);

                                                                    try {
                                                                        const sampleRef = ref(storage, `AIInfluencer/${jobId}/sample_audio${file.name.endsWith('.wav') ? '.wav' : '.mp3'}`);
                                                                        await uploadBytes(sampleRef, file);
                                                                        const sampleUrl = await getDownloadURL(sampleRef);

                                                                        // Update Firestore with voice sample URL
                                                                        const jobRef = doc(db, 'users', user.uid, 'aiInfluencerJobs', jobId);
                                                                        await setDoc(jobRef, {
                                                                            audioSampleUrl: sampleUrl,
                                                                            updatedAt: new Date().toISOString(),
                                                                        }, { merge: true });

                                                                        addAssistant('✅ Voice sample uploaded! Click "Generate Voice-Over" to start.');
                                                                        setSelectedGender('');
                                                                        setIsGenerating(false);
                                                                    } catch (err: any) {
                                                                        addAssistant(`❌ Failed to upload voice sample: ${err.message}`);
                                                                        setIsGenerating(false);
                                                                    }
                                                                }
                                                            }}
                                                            className="hidden"
                                                            id="audio-sample-upload"
                                                        />
                                                        <label
                                                            htmlFor="audio-sample-upload"
                                                            className={`w-full py-4 rounded-xl border border-dashed flex justify-center items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer transition-all active:scale-[0.98] ${audioSampleFile
                                                                ? 'border-orange-500 bg-orange-500/10 text-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.1)]'
                                                                : 'border-white/10 bg-white/[0.02] text-white/40 hover:border-orange-500/40 hover:bg-orange-600/5'
                                                                }`}
                                                        >
                                                            <Mic2 size={16} strokeWidth={2.5} />
                                                            {audioSampleFile ? 'Reference DNA Linked' : 'Clone Unique Voice'}
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center gap-4 py-2">
                                                        <div className="h-px bg-white/5 flex-1" />
                                                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/10 italic">Neural Presets</span>
                                                        <div className="h-px bg-white/5 flex-1" />
                                                    </div>

                                                    <div className="flex gap-3">
                                                        {(['male', 'female'] as const).map((g) => (
                                                            <button
                                                                key={g}
                                                                onClick={() => {
                                                                    handleGenderSelect(g);
                                                                    setAudioSampleFile(null);
                                                                }}
                                                                disabled={isGenerating}
                                                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border transition-all flex items-center justify-center gap-2 active:scale-95 ${selectedGender === g && !audioSampleFile
                                                                    ? 'bg-orange-600 border-orange-500 text-white shadow-[0_5px_20px_rgba(234,88,12,0.3)]'
                                                                    : 'bg-white/[0.02] border-white/5 text-white/40 hover:border-white/20'
                                                                    }`}
                                                            >
                                                                <Volume2 size={12} strokeWidth={2.5} />
                                                                {g === 'male' ? 'Richard' : 'Aurora'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={handleGenerateTTS}
                                                        disabled={(!selectedGender && !audioSampleFile) || isGenerating}
                                                        className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:shadow-[0_0_30px_rgba(234,88,12,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-20 active:scale-95 shadow-xl"
                                                    >
                                                        {isGenerating
                                                            ? <><Loader2 size={14} className="animate-spin" /> Synthesizing Voice…</>
                                                            : <><Sparkles size={14} /> Commit Audio Layer</>
                                                        }
                                                    </button>
                                                </motion.div>
                                            )}

                                            {/* STEP 7: Preview Audio + Trigger LipSync */}
                                            {chatStep === 'preview-audio' && audioUrl && (
                                                <motion.div
                                                    key="preview-audio"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-5"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                        <div className="w-1 h-1 rounded-full bg-orange-500" /> Audio Verification
                                                    </p>
                                                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5 shadow-inner">
                                                        <audio controls src={audioUrl} className="w-full h-10 accent-orange-500" />
                                                    </div>
                                                    <button
                                                        onClick={handleGenerateLipSync}
                                                        className="w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 text-white hover:from-orange-500 hover:shadow-[0_0_30px_rgba(234,88,12,0.4)] shadow-xl active:scale-[0.98]"
                                                    >
                                                        <Sparkles size={14} /> Synchronize Media Engine
                                                    </button>
                                                </motion.div>
                                            )}

                                            {/* STEP 8: Generating LipSync (waiting) */}
                                            {chatStep === 'generating-lipsync' && (
                                                <motion.div
                                                    key="generating-lipsync"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                                            <div className="absolute inset-0 bg-orange-500/10 animate-pulse" />
                                                            <Loader2 size={20} className="text-orange-500 animate-spin" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white">Media Synthesis Active</p>
                                                            <p className="text-[9px] text-white/30 mt-1 uppercase font-bold tracking-widest">Fal AI Neural Mapping · 2-5 Min Transit</p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* STEP COMPLETE */}
                                            {chatStep === 'complete' && (
                                                <motion.div
                                                    key="complete"
                                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                                    className="px-6 py-8 border-b border-white/5 bg-green-500/5 shrink-0 space-y-5 flex flex-col items-center text-center"
                                                >
                                                    <div className="w-16 h-16 rounded-[2rem] bg-green-500/10 border border-green-500/30 flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.1)]">
                                                        <CheckCircle2 size={32} className="text-green-500" strokeWidth={2.5} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-white">Generation Successful</h4>
                                                        <p className="text-[9px] text-white/20 uppercase font-black tracking-widest">Protocol terminated with exit code 0</p>
                                                    </div>
                                                    <div className="flex w-full gap-3">
                                                        {finalVideoUrl && (
                                                            <a
                                                                href={finalVideoUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                download
                                                                className="flex-1 py-4 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-500 transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95"
                                                            >
                                                                <Download size={14} strokeWidth={3} /> Secure Download
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={resetFlow}
                                                            className="flex-1 py-4 rounded-xl border border-white/5 bg-white/[0.02] text-white/60 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/[0.05] transition-all flex items-center justify-center gap-2 active:scale-95"
                                                        >
                                                            <RotateCcw size={14} strokeWidth={3} /> Purge & Reset
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* ── Chat Messages ── */}
                                        <div className="flex-1 overflow-y-auto min-h-0 p-8 space-y-8 bg-black/40 backdrop-blur-[60px] no-scrollbar overflow-x-hidden rounded-[2.5rem]">
                                            {chatMessages.map((msg, i) => (
                                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`flex flex-col gap-2.5 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                        {msg.role === 'assistant' && (
                                                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 mb-1 backdrop-blur-md">
                                                                <Sparkles size={10} className="text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Intelligence Synthesis</span>
                                                            </div>
                                                        )}
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            className={`rounded-[2rem] px-7 py-5 text-[15px] leading-relaxed shadow-2xl transition-all ${msg.role === 'user'
                                                                ? 'bg-gradient-to-br from-orange-600 to-orange-500 text-white rounded-tr-none border border-white/10 shadow-[0_10px_40px_rgba(234,88,12,0.2)]'
                                                                : 'bg-white/[0.02] text-white/80 border border-white/5 rounded-tl-none backdrop-blur-2xl ring-1 ring-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.3)]'
                                                                }`}
                                                        >
                                                            {msg.content}
                                                        </motion.div>
                                                    </div>
                                                </div>
                                            ))}
                                            {isGenerating && (
                                                <div className="flex justify-start">
                                                    <div className="flex flex-col gap-2.5 items-start">
                                                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 mb-1 backdrop-blur-md">
                                                            <Loader2 size={10} className="text-orange-500 animate-spin" />
                                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Processing Protocol</span>
                                                        </div>
                                                        <div className="bg-white/[0.01] rounded-[2rem] rounded-tl-none px-6 py-4 border border-white/5 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
                                                            <div className="flex gap-2 items-center">
                                                                <div className="flex gap-1.5">
                                                                    {[0, 1, 2].map((i) => (
                                                                        <motion.div
                                                                            key={i}
                                                                            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 1, 0.2] }}
                                                                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                                                            className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"
                                                                        />
                                                                    ))}
                                                                </div>
                                                                <span className="text-[10px] text-white/30 ml-3 font-black uppercase tracking-[0.2em]">Executing...</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>
                                    </div>
                                    {/* Sleek Progress Bar */}
                                    <div className="flex items-center gap-1 bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-3 overflow-x-auto shadow-2xl relative group">
                                        {STEPS.map((step, idx) => {
                                            const done = idx < currentStepIdx;
                                            const active = idx === currentStepIdx;
                                            const Icon = step.icon;
                                            return (
                                                <div key={step.id} className="flex items-center flex-shrink-0">
                                                    <motion.div
                                                        whileHover={{ scale: 1.05, y: -2 }}
                                                        className={`flex flex-col items-center gap-2 transition-all duration-700 ${active ? 'opacity-100' : done ? 'opacity-90' : 'opacity-20'}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-700 ${done
                                                            ? 'bg-orange-600 border-orange-500/50 text-white shadow-[0_0_25px_rgba(234,88,12,0.4)]'
                                                            : active
                                                                ? 'bg-white/10 border-orange-500 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                                                                : 'bg-white/5 border-white/5 text-white/30'
                                                            }`}>
                                                            {done ? <CheckCircle2 size={16} strokeWidth={3} /> : <Icon size={16} strokeWidth={2.5} />}
                                                        </div>
                                                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${active ? 'text-orange-400' : 'text-white/20'}`}>
                                                            {step.label}
                                                        </span>
                                                    </motion.div>
                                                    {idx < STEPS.length - 1 && (
                                                        <div className={`w-8 md:w-12 h-[2px] mx-3 rounded-full transition-all duration-1000 ${done ? 'bg-gradient-to-r from-orange-600 to-orange-400' : 'bg-white/10'}`} />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                

                                {/* ── RIGHT: Monitor Output ── */}
                                <div className="flex-1 flex gap-6 items-stretch overflow-hidden">
                                    {/* Monitor Column */}
                                    <div
                                        className="h-full w-full max-w-[420px] shrink-0 bg-black rounded-[2.5rem] border-[12px] border-orange-500/20 overflow-hidden relative shadow-[0_0_40px_rgba(234,88,12,0.2),0_40px_100px_rgba(0,0,0,0.8)] group/monitor transition-all duration-700 hover:border-orange-500/40"
                                        style={{
                                            aspectRatio: '9/16',
                                            maxHeight: 'calc(100vh - 12rem)'
                                        }}
                                    >
                                        {/* Cinematic Glass Glare */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-30 pointer-events-none z-10" />
                                        
                                        {/* Subdued Overlay for the monitor interior */}
                                        <div className="absolute inset-0 bg-black/40 z-0 rounded-[2.5rem]" />
                                        
                                        {/* High-Tech Grid bg */}
                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />

                                        {/* Traffic lights / OS buttons */}
                                        <div className="absolute top-6 left-6 flex gap-2 z-20">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/30 border border-red-500/20" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30 border border-yellow-500/20" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/30 border border-green-500/20" />
                                        </div>

                                        <AnimatePresence mode="wait">
                                            {finalVideoUrl ? (
                                                <motion.div
                                                    key="video"
                                                    initial={{ opacity: 0, scale: 1.1 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="absolute inset-0 flex items-center justify-center bg-black group"
                                                >
                                                    <video
                                                        src={finalVideoUrl}
                                                        controls
                                                        autoPlay
                                                        className="w-full h-full object-contain shadow-[inset_0_0_150px_rgba(0,0,0,0.9)]"
                                                    />
                                                    {/* Pro Status Overlay */}
                                                    <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-black/80 border border-white/10 backdrop-blur-xl text-[9px] font-black text-white/40 uppercase tracking-[0.2em] z-20 pointer-events-none flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                                        Cinema Mode • 4K
                                                    </div>
                                                </motion.div>
                                            ) : isGenerating ? (
                                                <motion.div
                                                    key="loading"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-black/80 backdrop-blur-3xl z-20"
                                                >
                                                    <div className="relative">
                                                        <div className="w-24 h-24 rounded-[3rem] bg-orange-600/10 border border-orange-500/20 flex items-center justify-center shadow-[0_0_60px_rgba(234,88,12,0.1)]">
                                                            <motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                                                                className="absolute inset-0 rounded-[3rem] border-2 border-dashed border-orange-500/10"
                                                            />
                                                            <Sparkles size={32} className="text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                        </div>
                                                        <div className="absolute -inset-6 rounded-full border border-orange-500/5 animate-[ping_4s_infinite]" />
                                                    </div>
                                                    <div className="text-center space-y-3">
                                                        <p className="text-sm font-black uppercase tracking-[0.3em] text-white/80">Neural Synthesis</p>
                                                        <div className="flex justify-center gap-1.5">
                                                            {[0,1,2].map(i => (
                                                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500/20 animate-pulse" />
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">
                                                            {chatStep === 'generating-lipsync' ? 'Phase: Lipschitz Mapping…' : 'Phase: Lighting Protocol…'}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="empty"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 transition-all"
                                                >
                                                    <div className="relative group/icon mb-8">
                                                        <div className="absolute -inset-8 bg-orange-500/5 rounded-full blur-3xl opacity-0 group-hover/monitor:opacity-100 transition-opacity duration-1000" />
                                                        <div className="w-24 h-24 rounded-[3rem] border border-dashed border-white/10 flex items-center justify-center group-hover/monitor:border-orange-500/30 transition-all duration-700 bg-white/[0.01]">
                                                            <MonitorPlay size={36} className="text-white/[0.05] group-hover/monitor:text-orange-500/50 transition-all duration-1000 group-hover/monitor:scale-110" />
                                                        </div>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-white/10 mb-3 tracking-tighter group-hover/monitor:text-white/40 transition-colors duration-700">Studio Downlink</h3>
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="w-2 h-2 rounded-full bg-white/5 animate-pulse" />
                                                        <p className="text-[10px] text-white/10 font-black uppercase tracking-[0.3em] group-hover/monitor:text-white/20 transition-colors">
                                                            Standby Protocol
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Scanline Effect Overlay */}
                                        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-[1] rounded-[2.5rem]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #000 0, #000 1px, transparent 1px, transparent 2px)', backgroundSize: '100% 2px' }} />
                                    </div>

                                    {/* Right Side Sidebar (Script + Assets) */}
                                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                                        {/* Script quick-view panel (shown after step 4) */}
                                        {editableScript && getStepIndex(chatStep) >= getStepIndex('avatar-video') && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="w-full bg-white/50 dark:bg-[#0A0A0A] border border-orange-500/30 rounded-xl p-4 shadow-[0_0_15px_rgba(234,88,12,0.15)] ring-1 ring-orange-500/10"
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
                                        {imageTimeline.length > 0 && getStepIndex(chatStep) >= getStepIndex('avatar-video') && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="w-full bg-white/50 dark:bg-[#0A0A0A] border border-orange-500/30 rounded-xl p-4 space-y-3 shadow-[0_0_15px_rgba(234,88,12,0.15)] ring-1 ring-orange-500/10"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[8px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest flex items-center gap-1.5">
                                                        <Sparkles size={8} /> Visual Assets
                                                    </p>
                                                    <span className="text-[8px] text-gray-400">
                                                        {imageTimeline.filter(p => p.imageUrl).length}/{imageTimeline.length} ready
                                                    </span>
                                                </div>


                                                {/* Image strip */}
                                                {imageTimeline.length > 0 && (
                                                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto pb-1 pr-1 no-scrollbar">
                                                        {imageTimeline.map((item, i) => (
                                                            <div key={i} className="flex-shrink-0 w-full space-y-1">
                                                                <div className="relative w-full h-[120px] rounded-lg overflow-hidden bg-gray-200/60 dark:bg-white/5">
                                                                    {item.imageUrl ? (
                                                                        <img src={item.imageUrl} alt={item.topic} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center">
                                                                            <Loader2 size={14} className="text-orange-400 animate-spin" />
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
                                <button className="w-full py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-xl">
                                    <Move3d size={14} /> Coming Soon.
                                </button>
                            </div>
                        )}
                    </main>
                </div>
            </div>
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
