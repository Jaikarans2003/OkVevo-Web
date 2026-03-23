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
    RotateCcw, Play, Download
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
            className="relative min-h-screen bg-[#FAFAFA] dark:bg-black text-black dark:text-white font-sans selection:bg-[#E2FF4D]/30 overflow-x-hidden transition-colors duration-500"
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
                className="relative min-h-screen pt-24"
            >
                {/* Background Video with Hue-Shift to Orange */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0"
                    style={{ filter: 'hue-rotate(140deg) saturate(1.4) brightness(0.9)' }}
                >
                    <source src="/videos/bg-blue.mp4" type="video/mp4" />
                </video>

                {/* Subtle Orange-tinted Overlay for Readability */}
                <div className="fixed inset-0 bg-[#050505]/40 backdrop-blur-[1px] pointer-events-none z-0" />

                {/* Body — history sidebar + main content */}
                <div className="flex relative z-10 min-h-screen">
                {/* Session History Sidebar */}
                {user?.uid && (
                    <div className="sticky top-16 h-[calc(100vh-4rem)] flex-shrink-0">
                        <SessionHistorySidebar
                            userId={user.uid}
                            feature="ai-influencer"
                            currentSessionId={sessionId}
                            onSelectSession={handleRestoreInfluencerSession}
                            onNewSession={handleNewInfluencerSession}
                            accentColor="orange"
                        />
                    </div>
                )}

                <main className="flex-1 relative z-10 pb-16 px-4 md:px-10 max-w-[1600px] mx-auto pt-4 backdrop-blur-xl bg-white/5 dark:bg-black/10 rounded-[3rem] border border-white/10 mx-6 mb-6 mt-2 shadow-2xl overflow-hidden">
                    {/* Header with Professional Status */}
                    <div className="mb-8 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-white tracking-tight">AI Influencer</h1>
                                <div className="mt-2 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-orange-500/80">Active Studio</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-white/40 font-medium">From script to social-ready cinema in minutes</p>
                        </div>
                        {chatStep !== 'upload-script' && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={resetFlow}
                                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-red-500 border border-gray-200 dark:border-white/10 rounded-xl hover:border-red-500/30 transition-all bg-white/5 backdrop-blur-md"
                            >
                                <RotateCcw size={11} /> Reset
                            </motion.button>
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

                                {/* Sleek Progress Bar */}
                                <div className="flex items-center gap-2 bg-white/5 dark:bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 overflow-x-auto shadow-2xl relative group">
                                    {STEPS.map((step, idx) => {
                                        const done = idx < currentStepIdx;
                                        const active = idx === currentStepIdx;
                                        const Icon = step.icon;
                                        return (
                                            <div key={step.id} className="flex items-center flex-shrink-0">
                                                <motion.div 
                                                    whileHover={{ scale: 1.1, y: -2 }}
                                                    className={`flex flex-col items-center gap-1 transition-opacity duration-500 ${active ? 'opacity-100' : done ? 'opacity-80' : 'opacity-20'}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-500 ${done
                                                        ? 'bg-orange-600 border-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]'
                                                        : active
                                                            ? 'bg-orange-600/20 border-orange-500 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                                                            : 'bg-white/5 border-white/10 text-white/40'
                                                        }`}>
                                                        {done ? <CheckCircle2 size={12} /> : <Icon size={12} />}
                                                    </div>
                                                    <span className={`text-[7px] font-black uppercase tracking-[0.14em] ${active ? 'text-orange-400' : 'text-white/30'}`}>
                                                        {step.label}
                                                    </span>
                                                </motion.div>
                                                {idx < STEPS.length - 1 && (
                                                    <div className={`w-6 md:w-8 h-[1px] mx-2 transition-all duration-700 ${done ? 'bg-orange-600' : 'bg-white/10'}`} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ── Chat Panel ── */}
                                <div className="flex flex-col bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl" style={{ height: '620px' }}>
                                    {/* Chat header */}
                                    <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0F0F0F]/50 flex items-center gap-2 shrink-0">
                                        <div className="relative">
                                            <Sparkles size={12} className="text-orange-400" />
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
                                                    className="w-full h-28 p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/40 text-[11px] text-black dark:text-white focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 outline-none resize-none placeholder-black/25 dark:placeholder-white/20 leading-relaxed"
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
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-white/20 bg-transparent hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-400/50 text-[9px] text-black/50 dark:text-white/40 transition-all"
                                                    >
                                                        <Upload size={10} /> Upload .txt file
                                                    </button>
                                                    <button
                                                        onClick={handleScriptSubmit}
                                                        disabled={!rawScript.trim()}
                                                        className="flex-1 py-2 rounded-lg bg-orange-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-orange-500 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
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
                                                            className="flex-1 py-3 rounded-xl font-bold text-[11px] tracking-wider border transition-all flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed bg-white/60 dark:bg-black/40 border-gray-200 dark:border-white/10 text-black/70 dark:text-white/70 hover:border-orange-500/40 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                                                        >
                                                            <Clock size={14} className="text-orange-400" />
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
                                                    className="w-full h-28 p-3 rounded-lg border border-orange-500/30 bg-white/70 dark:bg-black/40 text-[11px] text-black dark:text-white focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 outline-none resize-none leading-relaxed"
                                                />
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[8px] text-gray-400">{editableScript.trim().split(/\s+/).length} words</span>
                                                    <button
                                                        onClick={handleConfirmScript}
                                                        disabled={!editableScript.trim()}
                                                        className="py-2 px-5 rounded-lg bg-orange-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-orange-500 transition-all flex items-center gap-1.5 disabled:opacity-40"
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
                                                    className="w-full py-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/15 bg-white/50 dark:bg-black/30 hover:border-orange-400/60 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all flex flex-col items-center justify-center gap-2 group"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <Upload size={18} className="text-orange-500" />
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
                                                    <Users size={9} /> Step 6 — Voice Cloning & Audio
                                                </p>

                                                <div className="mb-3 space-y-2">
                                                    <p className="text-[10px] text-gray-500">Optional: Upload an audio sample (MP3/WAV) to clone your voice.</p>
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
                                                        className={`w-full py-3 rounded-lg border border-dashed flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${audioSampleFile
                                                            ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                                                            : 'border-gray-300 dark:border-white/20 bg-white/50 dark:bg-black/30 text-gray-500 hover:border-orange-400/60'
                                                            }`}
                                                    >
                                                        <Upload size={14} />
                                                        {audioSampleFile ? 'Reference Audio Attached' : 'Upload Audio Reference'}
                                                    </label>
                                                </div>

                                                <div className="flex items-center gap-3 my-2">
                                                    <div className="h-px bg-gray-200 dark:bg-white/10 flex-1"></div>
                                                    <span className="text-[9px] uppercase font-bold text-gray-400">OR SELECT VOICE</span>
                                                    <div className="h-px bg-gray-200 dark:bg-white/10 flex-1"></div>
                                                </div>

                                                <div className="flex gap-2 mb-3">
                                                    {(['male', 'female'] as const).map((g) => (
                                                        <button
                                                            key={g}
                                                            onClick={() => {
                                                                handleGenderSelect(g);
                                                                setAudioSampleFile(null); // Clear custom audio if preset is chosen
                                                            }}
                                                            disabled={isGenerating}
                                                            className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${selectedGender === g && !audioSampleFile
                                                                ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-600/20'
                                                                : 'bg-white/60 dark:bg-black/40 border-gray-200 dark:border-white/10 text-black/60 dark:text-white/60 hover:border-orange-400/40'
                                                                }`}
                                                        >
                                                            <Volume2 size={10} />
                                                            {g === 'male' ? 'Male (Richard)' : 'Female (Aurora)'}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={handleGenerateTTS}
                                                    disabled={(!selectedGender && !audioSampleFile) || isGenerating}
                                                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider hover:from-orange-500 hover:to-orange-400 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
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
                                                    className="w-full py-3 rounded-xl font-bold text-[10px] uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 via-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-xl hover:shadow-orange-500/30 hover:scale-[1.01]"
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
                                                    <div className="w-8 h-8 rounded-full bg-orange-600/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0">
                                                        <Loader2 size={14} className="text-orange-400 animate-spin" />
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
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white/5 dark:bg-[#070707]/80 backdrop-blur-3xl">
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                    {msg.role === 'assistant' && (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 mb-1">
                                                            <Sparkles size={8} className="text-orange-400" />
                                                            <span className="text-[7px] font-black uppercase tracking-widest text-white/40">Vevo AI Assistant</span>
                                                        </div>
                                                    )}
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        className={`max-w-[85%] rounded-[1.25rem] px-4 py-3 text-[11px] leading-relaxed shadow-xl ${msg.role === 'user'
                                                            ? 'bg-gradient-to-br from-orange-600 to-orange-500 text-white rounded-tr-none border border-orange-400/20'
                                                            : 'bg-white/5 dark:bg-[#151515] text-white/80 border border-white/5 rounded-tl-none backdrop-blur-md'
                                                            }`}
                                                    >
                                                        {msg.content}
                                                    </motion.div>
                                                </div>
                                            </div>
                                        ))}
                                        {isGenerating && (
                                            <div className="flex justify-start">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 mb-1">
                                                        <Sparkles size={8} className="text-orange-400" />
                                                        <span className="text-[7px] font-black uppercase tracking-widest text-white/40">Vevo AI Thinking</span>
                                                    </div>
                                                    <div className="bg-white/5 dark:bg-[#151515] rounded-[1.25rem] rounded-tl-none px-4 py-3 border border-white/5 backdrop-blur-md">
                                                        <div className="flex gap-1.5 items-center">
                                                            <div className="flex gap-1">
                                                                {[0, 1, 2].map((i) => (
                                                                    <motion.div
                                                                        key={i}
                                                                        animate={{ y: [0, -3, 0] }}
                                                                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                                                                        className="w-1 h-1 rounded-full bg-orange-400"
                                                                    />
                                                                ))}
                                                            </div>
                                                            <span className="text-[9px] text-white/20 ml-2 font-medium uppercase tracking-widest">Processing</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                </div>
                            </div>

                            {/* ── RIGHT: Monitor Output ── */}
                            <div className="flex-1 flex flex-col gap-4">
                                <div
                                    className="w-full max-w-[402px] mx-auto bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden relative shadow-2xl"
                                    style={{ 
                                        aspectRatio: '9/16', 
                                        maxHeight: '715px',
                                        backgroundImage: 'url("/output.png")',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}
                                >
                                    {/* Subdued Overlay for the monitor interior */}
                                    <div className="absolute inset-0 bg-black/20 z-0" />
                                    {/* Grid bg */}
                                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none z-0" />

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
                                                className="absolute inset-0 flex items-center justify-center bg-black group"
                                            >
                                                <video
                                                    src={finalVideoUrl}
                                                    controls
                                                    autoPlay
                                                    className="w-full h-full object-contain shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"
                                                />
                                                {/* Pro Overlay */}
                                                <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/60 border border-white/10 backdrop-blur-md text-[8px] font-bold text-white/60 uppercase tracking-widest z-10 pointer-events-none">
                                                    Master • 4K
                                                </div>
                                            </motion.div>
                                        ) : isGenerating ? (
                                            <motion.div
                                                key="loading"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#050505]/90 backdrop-blur-md z-20"
                                            >
                                                <div className="relative">
                                                    <div className="w-20 h-20 rounded-[2.5rem] bg-orange-600/20 border border-orange-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(234,88,12,0.1)]">
                                                        <motion.div
                                                            animate={{ rotate: 360 }}
                                                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                            className="absolute inset-0 rounded-[2.5rem] border-2 border-dashed border-orange-500/20"
                                                        />
                                                        <Sparkles size={28} className="text-orange-400" />
                                                    </div>
                                                    <div className="absolute -inset-4 rounded-full border border-orange-500/10 animate-[ping_3s_infinite]" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[12px] font-black uppercase tracking-[0.2em] text-white">Rendering Engine</p>
                                                    <p className="text-[9px] text-white/30 mt-2 font-medium uppercase tracking-widest">
                                                        {chatStep === 'generating-lipsync' ? 'Synthesizing LipSync…' : 'Processing Cinematic Frames…'}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="empty"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 transition-all group"
                                            >
                                                <div className="w-20 h-20 rounded-[2.5rem] border border-dashed border-white/10 flex items-center justify-center mb-6 group-hover:border-orange-500/30 transition-colors duration-700">
                                                    <MonitorPlay size={32} className="text-white/10 group-hover:text-orange-500/40 transition-all duration-700 group-hover:scale-110" />
                                                </div>
                                                <h3 className="text-xl font-bold text-white/20 mb-2  group-hover:text-white/40 transition-colors">Monitor Output</h3>
                                                <p className="text-[10px] mb-60 text-white/10 font-medium uppercase tracking-[0.2em] max-w-[200px] group-hover:text-white/20 transition-colors">
                                                    Awaiting video signal
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    
                                    {/* Scanline Effect Overlay */}
                                    <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-[1]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #000 0, #000 1px, transparent 1px, transparent 2px)', backgroundSize: '100% 2px' }} />
                                </div>

                                {/* Script quick-view panel (shown after step 4) */}
                                {editableScript && getStepIndex(chatStep) >= getStepIndex('avatar-video') && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="w-full bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-4"
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
                                        className="w-full bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-3"
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
                                            <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                                                {imageTimeline.map((item, i) => (
                                                    <div key={i} className="flex-shrink-0 snap-start w-[100px] space-y-1">
                                                        <div className="relative w-full h-[70px] rounded-lg overflow-hidden bg-gray-200/60 dark:bg-white/5">
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
                            {/* <div className="space-y-1.5">
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
                                </div> */}
                            {/* </div> */}
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
