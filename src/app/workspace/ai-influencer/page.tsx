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
    RotateCcw, Play, Download, Mic2, Image, ArrowDown, ArrowUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJobId } from '../../../services/AIInfluencerService';
import SessionHistorySidebar from '@/components/workspace/SessionHistorySidebar';
import { useWorkspaceSession } from '@/hooks/useWorkspaceSession';
import type { WorkspaceSession } from '@/services/WorkspaceSessionService';
import { getUserWorkspaceSessions } from '@/services/WorkspaceSessionService';
import { checkCredits, deductCredits } from '@/services/CreditsService';

// ─── Types ─────────────────────────────────────────────────
type ChatStep =
    | 'upload-script'        // 1. Upload / paste script
    | 'duration'             // 2. Select duration
    | 'tts-pacing'           // 2b. Select pacing
    | 'generating-script'    // 3. AI generating narrative script
    | 'edit-script'          // 4. Show editable script
    | 'avatar-video'         // 5. Upload avatar video
    | 'generating-tts'       // 6. Generating TTS audio
    | 'preview-audio'        // 6b. Preview audio before lipsync
    | 'generating-lipsync'   // 7. LipSync via Fal AI
    | 'complete';            // 8. Final video ready

type ChatMessage = { role: 'user' | 'assistant'; content: string | React.ReactNode };

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
    { id: 'tts-pacing', label: 'Pacing', icon: Sparkles },
    { id: 'generating-script', label: 'Generate', icon: Sparkles },
    { id: 'edit-script', label: 'Edit', icon: Edit3 },
    { id: 'avatar-video', label: 'Avatar', icon: Video },
    { id: 'Giving a Voice', label: 'Voice', icon: Volume2 },
    { id: 'preview-audio', label: 'Preview', icon: Play },
    { id: 'generating-lipsync', 'label': 'Animating', icon: Sparkles },
    { id: 'complete', label: 'Done', icon: CheckCircle2 },
] as const;

const STEP_ORDER: ChatStep[] = [
    'upload-script', 'duration', 'tts-pacing', 'generating-script', 'edit-script',
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
    const [activeMobileTab, setActiveMobileTab] = useState<'workstation' | 'monitor' | 'assets'>('workstation');

    // Step state
    const [chatStep, setChatStep] = useState<ChatStep>('upload-script');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: "Yo! VEVO here. Drop your script and watch the magic unfold. We don't do boring — we do VEVO. Paste it below or upload the file. Let's get weird.",
        },
    ]);

    // Data state
    const [rawScript, setRawScript] = useState('');
    const [selectedDuration, setSelectedDuration] = useState<15 | 30 | 60 | 0>(0);
    const [ttsPacing, setTtsPacing] = useState<'calm' | 'fast' | ''>('');
    const [generatedScript, setGeneratedScript] = useState('');
    const [editableScript, setEditableScript] = useState('');
    const [avatarVideo, setAvatarVideo] = useState<File | null>(null);
    const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
    const [selectedGender, setSelectedGender] = useState<'male' | 'female' | ''>('');
    const [audioSampleFile, setAudioSampleFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [waitTaskToken, setWaitTaskToken] = useState<string | null>(null);
    // Photo asset state
    const [imageTimeline, setImageTimeline] = useState<ImageMoment[]>([]);
    const [scriptMood, setScriptMood] = useState<string>('Chill');
    
    // Ref to track if script delivery message has been shown
    const scriptMessageShownRef = useRef(false);

    // ── Branding state (optional post-process — does NOT affect the pipeline) ──
    const [brandingOpen,      setBrandingOpen]      = useState(true);
    const [brandLogoFile,     setBrandLogoFile]     = useState<File | null>(null);
    const [brandMarqueeText,  setBrandMarqueeText]  = useState('');
    const [brandMarqueePos,   setBrandMarqueePos]   = useState<'top' | 'bottom'>('bottom');
    const [brandLogoPos,      setBrandLogoPos]      = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');
    const [brandNeedThumbnail, setBrandNeedThumbnail] = useState(false);
    const [brandThumbnailPrompt, setBrandThumbnailPrompt] = useState('');
    const [brandThumbnailPhotoFile, setBrandThumbnailPhotoFile] = useState<File | null>(null);
    const [customThumbnailUrl, setCustomThumbnailUrl] = useState<string | null>(null);
    const [thumbnailAlreadyGenerated, setThumbnailAlreadyGenerated] = useState(false);
    const [isBranding,        setIsBranding]        = useState(false);
    const [brandedVideoUrl,   setBrandedVideoUrl]   = useState<string | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

    const { resolvedTheme } = useTheme();
    const scriptFileInputRef = useRef<HTMLInputElement>(null);
    const avatarFileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const stepsRef = useRef<HTMLDivElement>(null);

    // ── Auth ──────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
    }, []);

    // ── Session history ───────────────────────────────────────
    const { sessionId, initSession, saveSession, resetSession, restoreSession } = useWorkspaceSession('ai-influencer', user?.uid ?? null);
    const isRestoringRef = useRef(false);
    const activeSessionIdRef = useRef<string | null>(null);

    // ── Session restoration handler ───────────────────────────
    const handleRestoreSession = useCallback(async (session: WorkspaceSession) => {
        isRestoringRef.current = true;
        
        // Update sessionId in the hook to highlight the selected session
        await restoreSession(session.id);
        
        // Update the active session ref immediately for proper highlighting
        activeSessionIdRef.current = session.id;
        
        // Use setTimeout to ensure state updates happen after sessionId is set
        setTimeout(() => {
            // First, reset all state to defaults to prevent pollution from previous session
            setChatStep('upload-script');
            setJobId(null);
            setRawScript('');
            setEditableScript('');
            setGeneratedScript('');
            setSelectedDuration(0);
            setSelectedGender('');
            setTtsPacing('');
            setScriptMood('');
            setImageTimeline([]);
            setAudioUrl(null);
            setAvatarVideoUrl(null);
            setAvatarVideo(null);
            setWaitTaskToken(null);
            setFinalVideoUrl(null);
            setBrandedVideoUrl(null);
            setCustomThumbnailUrl(null);
            setThumbnailAlreadyGenerated(false);
            setIsGenerating(false);
            setBrandingOpen(true);
            setBrandLogoFile(null);
            setBrandMarqueeText('');
            setBrandMarqueePos('bottom');
            setBrandLogoPos('top-right');
            setBrandNeedThumbnail(false);
            setBrandThumbnailPrompt('');
            setBrandThumbnailPhotoFile(null);
            setIsBranding(false);
            
            // Now restore all state from session
            const s = session.state;
            if (s.chatStep) setChatStep(s.chatStep as ChatStep);
            if (s.jobId) setJobId(s.jobId);
            if (s.rawScript) setRawScript(s.rawScript);
            if (s.editableScript) setEditableScript(s.editableScript);
            if (s.generatedScript) setGeneratedScript(s.generatedScript);
            if (s.selectedDuration) setSelectedDuration(s.selectedDuration);
            if (s.selectedGender) setSelectedGender(s.selectedGender);
            if (s.ttsPacing) setTtsPacing(s.ttsPacing);
            if (s.scriptMood) setScriptMood(s.scriptMood);
            if (s.imageTimeline) setImageTimeline(s.imageTimeline);
            if (s.audioUrl) setAudioUrl(s.audioUrl);
            if (s.avatarVideoUrl) setAvatarVideoUrl(s.avatarVideoUrl);
            if (s.waitTaskToken) setWaitTaskToken(s.waitTaskToken);
            if (s.finalVideoUrl) setFinalVideoUrl(s.finalVideoUrl);
            if (s.brandedVideoUrl) setBrandedVideoUrl(s.brandedVideoUrl);
            if (s.customThumbnailUrl) setCustomThumbnailUrl(s.customThumbnailUrl);
            if (s.thumbnailGeneratedBy === 'nano-banana-2' || s.thumbnailGeneratedBy === 'flux-2/turbo') {
                setThumbnailAlreadyGenerated(true);
            }
            if (s.isGenerating !== undefined) setIsGenerating(s.isGenerating);
            
            // Restore chat messages
            setChatMessages(session.messages.map(m => ({ role: m.role, content: m.content })));
            
            // The Firestore job listener will automatically reconnect when jobId changes
            console.log('Loaded your Previous Chat'); //✅ Session restored:', session.id, 'JobId:', s.jobId
            
            // Allow new sessions to be created after restoration
            // Delay longer to ensure all state updates complete before auto-save can run
            setTimeout(() => {
                isRestoringRef.current = false;
            }, 1500);
        }, 100);
    }, [restoreSession]);

    // ── Auto-restore session on mount ─────────────────────────
    useEffect(() => {
        if (!user?.uid || sessionId) return;
        
        const autoRestore = async () => {
            // Check URL params for sessionId
            const params = new URLSearchParams(window.location.search);
            const urlSessionId = params.get('sessionId');
            
            if (urlSessionId) {
                // Check if this is a page reload (type 1) or navigation (type 0)
                const navigationType = typeof window !== 'undefined' && window.performance?.getEntriesByType 
                    ? (window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type 
                    : null;
                
                // Only restore if NOT a reload (i.e., user clicked from history)
                if (navigationType !== 'reload') {
                    const session = await restoreSession(urlSessionId);
                    if (session) {
                        await handleRestoreSession(session);
                        return;
                    }
                }
                
                // Clear sessionId from URL if it was a reload
                const url = new URL(window.location.href);
                url.searchParams.delete('sessionId');
                window.history.replaceState({}, '', url.toString());
            }
        };
        
        autoRestore();
    }, [user?.uid]);

    // Auto-create session when script is first submitted
    useEffect(() => {
        if (sessionId || !user?.uid || !rawScript || chatStep === 'upload-script' || isRestoringRef.current) return;
        initSession(
            rawScript.substring(0, 60) || 'AI Influencer Session',
            { chatStep },
            chatMessages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '[Rich content]' })),
        );
    }, [chatStep]);

    // ── Sync sessionId to URL and track active session ───────
    useEffect(() => {
        if (sessionId && typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('sessionId', sessionId);
            window.history.replaceState({}, '', url.toString());
        }
        // Track the active session ID
        activeSessionIdRef.current = sessionId;
    }, [sessionId]);

    // Auto-save messages & step whenever they change
    useEffect(() => {
        // Don't auto-save during session restoration
        if (!sessionId || chatMessages.length === 0 || isRestoringRef.current) return;
        const state: Record<string, any> = {
            chatStep,
            jobId,
            rawScript,
            editableScript,
            generatedScript,
            selectedDuration,
            selectedGender,
            ttsPacing,
            scriptMood,
            imageTimeline,
            audioUrl,
            avatarVideoUrl,
            waitTaskToken,
            finalVideoUrl,
            brandedVideoUrl,
            customThumbnailUrl,
            isGenerating,
        };
        // Remove null/undefined values to keep Firestore clean
        Object.keys(state).forEach(key => {
            if (state[key] === null || state[key] === undefined || state[key] === '' || state[key] === 0) {
                delete state[key];
            }
        });
        // Convert chat messages to strings for session storage
        const messagesForStorage = chatMessages.map(msg => {
            let content: string;
            if (typeof msg.content === 'string') {
                content = msg.content;
            } else {
                // For rich content, check if it's a script upload message
                // Use the current rawScript state if available
                const contentStr = JSON.stringify(msg.content);
                if (contentStr.includes('Script Uploaded') && rawScript) {
                    content = `Script Uploaded:\n${rawScript}`;
                } else {
                    content = '[Rich content]';
                }
            }
            return { role: msg.role, content };
        });
        saveSession(state, messagesForStorage);
    }, [chatMessages, chatStep, jobId, imageTimeline, audioUrl, avatarVideoUrl, finalVideoUrl, brandedVideoUrl, isGenerating, rawScript, isRestoringRef.current]);

    // ── Cooldown timer ───────────────────────────────────
    useEffect(() => {
        if (!user?.uid) return;
        
        const updateCooldown = async () => {
            try {
                const sessions = await getUserWorkspaceSessions(user.uid, 'ai-influencer');
                if (sessions.length === 0) return;
                
                // Get the most recent session's createdAt
                const mostRecent = sessions[0];
                const createdAtMs = mostRecent.createdAt?.toMillis ? mostRecent.createdAt.toMillis() : 
                                   mostRecent.createdAt?.seconds ? mostRecent.createdAt.seconds * 1000 : null;
                
                if (!createdAtMs) return;
                
                const timeSinceCreation = Date.now() - createdAtMs;
                const cooldownMs = 60000; // 1 minute
                const remaining = Math.max(0, cooldownMs - timeSinceCreation);
                setCooldownRemaining(Math.ceil(remaining / 1000));
            } catch (error) {
                console.error('Error updating cooldown:', error);
            }
        };
        
        updateCooldown();
        const interval = setInterval(updateCooldown, 1000);
        
        return () => clearInterval(interval);
    }, [user?.uid, sessionId]);

    // ── Auto-scroll chat ─────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [chatMessages, isGenerating, chatStep]);

    // ── Auto-scroll process bar ───────────────────────────
    useEffect(() => {
        if (stepsRef.current) {
            const activeStepEl = stepsRef.current.children[currentStepIndex] as HTMLElement;
            if (activeStepEl) {
                activeStepEl.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' 
                });
            }
        }
    }, [chatStep]);

    const currentStepIndex = getStepIndex(chatStep);

    // ── Auto-resume pipeline when token arrives ───────────
    useEffect(() => {
        if (waitTaskToken && avatarVideoUrl && jobId && user?.uid) {
            console.log('🚀 Auto-resuming pipeline with received token...');
            handleResumePipeline(waitTaskToken, avatarVideoUrl);
        }
    }, [waitTaskToken, avatarVideoUrl]);

    // ── Real-time Job Listener ────────────────────────────
    useEffect(() => {
        if (!jobId || !user?.uid) return;

        const jobRef = doc(db, 'users', user.uid, 'aiInfluencerJobs', jobId);
        const unsub = onSnapshot(jobRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                
                // Track Status
                if (data.status === 'completed' && data.finalVideoUrl) {
                    setFinalVideoUrl(data.finalVideoUrl);
                    setChatStep('complete');
                    setIsGenerating(false);
                } else if (data.status === 'error') {
                    setErrorMessage(data.errorMessage || 'Unknown Error occurred');
                    setErrorCode(data.errorCode || '500');
                    
                    // Preserve partial assets that were generated before failure
                    if (data.assetResults && Array.isArray(data.assetResults)) {
                        const images = data.assetResults
                            .filter((r: any) => r.type === 'image')
                            .map((r: any) => r.output.images?.[0]?.url)
                            .filter(Boolean);
                        
                        if (images.length > 0) {
                            setImageTimeline(prev => prev.map((item, idx) => ({
                                ...item,
                                imageUrl: images[idx] || item.imageUrl
                            })));
                        }
                    }
                    
                    if (data.audioUrl) {
                        setAudioUrl(data.audioUrl);
                    }
                    
                    setIsGenerating(false);
                    
                    // Check if we have partial assets to show
                    const hasPartialAssets = (data.assetResults && data.assetResults.length > 0) || data.audioUrl;
                    const partialMessage = hasPartialAssets 
                        ? `💀 Pipeline Error ${data.errorCode || '500'} — But we saved what we generated! Check the assets panel below.`
                        : `💀 VEVO Major Error ${data.errorCode || '500'} — We might need to restart this run.`;
                    
                    addAssistant(partialMessage);
                }

                // Update assets in real-time
                if (data.assetResults && Array.isArray(data.assetResults)) {
                    const images = data.assetResults
                        .filter((r: any) => r.type === 'image')
                        .map((r: any) => r.output.images?.[0]?.url)
                        .filter(Boolean);
                    
                    if (images.length > 0) {
                        setImageTimeline(prev => prev.map((item, idx) => ({
                            ...item,
                            imageUrl: images[idx] || item.imageUrl
                        })));
                    }
                }
            }
        });

        return () => unsub();
    }, [jobId, user?.uid]);

    const handleResumePipeline = async (token: string, videoUrl: string) => {
        try {
            const authToken = await user.getIdToken();
            const res = await fetch('/api/sqs/ai-influencer', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    action: 'resume',
                    jobId,
                    taskToken: token,
                    avatarVideoUrl: videoUrl,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to resume pipeline');
            console.log('✅ Pipeline resumed successfully');
            setWaitTaskToken(null);
            addAssistant('🎬 Avatar locked and loaded! VEVO is bringing your masterpiece to life. Hold tight.');
        } catch (err: any) {
            console.error('Failed to resume pipeline:', err);
        }
    };

    // ── Firestore polling ────────────────────────────────
    useEffect(() => {
        if (!jobId || !user?.uid) return;
        
        // Store the current jobId to prevent race conditions
        const currentJobId = jobId;
        
        // Poll from user-specific subcollection: users/{userId}/aiInfluencerJobs/{jobId}
        const unsub = onSnapshot(doc(db, 'users', user.uid, 'aiInfluencerJobs', jobId), (snap) => {
            const data = snap.data();
            if (!data) return;
            
            // Don't update UI if we're restoring a different session
            if (isRestoringRef.current) return;
            
            // Don't update UI if this job doesn't belong to the currently active session
            // This prevents background jobs from updating the wrong session's UI
            if (data.sessionId && data.sessionId !== activeSessionIdRef.current) return;

            // 1. Check for generated script
            if (data.script && chatStep === 'generating-script' && !scriptMessageShownRef.current) {
                setGeneratedScript(data.script);
                setEditableScript(data.script);
                setChatStep('edit-script');
                addAssistant(`VEVO brain just delivered a fresh ~${selectedDuration}s script. Edit it below, then keep it moving.`);
                scriptMessageShownRef.current = true;
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
                addAssistant('🎉 OKVEVO DROP! Your video just landed. Watch the monitor — you are about to be iconic.');
                setIsGenerating(false);
            } else if (data.status === 'error') {
                addAssistant('💀 OKVEVO system fault: Video generation failed — something broke in the pipeline. Try again.'); //: ${data.errorMessage 
                setChatStep('preview-audio');
                setIsGenerating(false);
            }

            // 5. Track post-processing results
            if (data.customThumbnailUrl) {
                setCustomThumbnailUrl(data.customThumbnailUrl);
                
                // Check if generated by Fal AI models (not Gemini)
                if (data.thumbnailGeneratedBy === 'nano-banana-2' || data.thumbnailGeneratedBy === 'flux-2/turbo') {
                    setThumbnailAlreadyGenerated(true);
                }
            }
            if (data.brandedVideoUrl) {
                setBrandedVideoUrl(data.brandedVideoUrl);
            }
        });
        return () => unsub();
    }, [jobId, user?.uid]);

    // ── Helpers ───────────────────────────────────────────
    const addAssistant = (content: string | React.ReactNode) =>
        setChatMessages((prev) => [...prev, { role: 'assistant', content }]);

    const addUser = (content: string | React.ReactNode) =>
        setChatMessages((prev) => [...prev, { role: 'user', content }]);

    const resetFlow = () => {
        // Reset session FIRST to clear sessionId and prevent auto-save pollution
        resetSession();
        activeSessionIdRef.current = null;
        
        // Reset to fresh state - no cooldown check here
        // Cooldown will be checked when user submits script
        setChatStep('upload-script');
        setChatMessages([{
            role: 'assistant',
            content: "OK VEVO is back and hungry. New video, new vibes. Drop that script and let's cook something OKVEVO-worthy.",
        }]);
        setRawScript('');
        setSelectedDuration(0);
        setTtsPacing('');
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
        // branding state reset
        setBrandingOpen(false);
        setBrandLogoFile(null);
        setBrandMarqueeText('');
        setBrandMarqueePos('bottom');
        setBrandLogoPos('top-right');
        setBrandNeedThumbnail(false);
        setBrandThumbnailPrompt('');
        setBrandThumbnailPhotoFile(null);
        setCustomThumbnailUrl(null);
        setThumbnailAlreadyGenerated(false);
        setIsBranding(false);
        setBrandedVideoUrl(null);
        isRestoringRef.current = false;
    };

    // ── Branding handler (optional — called only when user explicitly clicks Apply) ──
    const handleApplyBranding = async () => {
        if (!finalVideoUrl || !jobId || !user?.uid) return;
        if (!brandLogoFile && !brandMarqueeText.trim() && (!brandNeedThumbnail || !brandThumbnailPrompt.trim())) return;

        setIsBranding(true);
        try {
            let logoBase64: string | undefined;
            let logoMimeType: string | undefined;
            if (brandLogoFile) {
                const buf = await brandLogoFile.arrayBuffer();
                logoBase64  = Buffer.from(buf).toString('base64');
                logoMimeType = brandLogoFile.type;
            }

            let thumbnailPersonPhotoBase64: string | undefined;
            if (brandNeedThumbnail && brandThumbnailPhotoFile) {
                const thumbBuf = await brandThumbnailPhotoFile.arrayBuffer();
                thumbnailPersonPhotoBase64 = Buffer.from(thumbBuf).toString('base64');
            }

            const authToken = await user.getIdToken();
            const res = await fetch('/api/ai-influencer/brand-video', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    jobId,
                    finalVideoUrl,
                    logoBase64,
                    logoMimeType,
                    logoPosition:    brandLogoFile ? brandLogoPos : undefined,
                    marqueeText:     brandMarqueeText.trim() || undefined,
                    marqueePosition: brandMarqueeText.trim() ? brandMarqueePos : undefined,
                    generateThumbnail: brandNeedThumbnail,
                    thumbnailPrompt: brandNeedThumbnail ? brandThumbnailPrompt.trim() : undefined,
                    thumbnailPersonPhotoBase64: brandNeedThumbnail ? thumbnailPersonPhotoBase64 : undefined,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Branding failed');
            // The polling logic will catch brandedVideoUrl and customThumbnailUrl from Firestore
            if (data.brandedVideoUrl) setBrandedVideoUrl(data.brandedVideoUrl);
        } catch (err: any) {
            console.error('Branding error:', err);
            addAssistant(`💀 Branding pipeline choked:  — logo or marquee Lambda issue, Try again after Sometime.`); //${err.message}
        } finally {
            setIsBranding(false);
        }
    };

    const handleNewInfluencerSession = useCallback(() => {
        resetFlow();
    }, []);


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

    const handleScriptSubmit = async () => {
        if (!rawScript.trim()) return;
        
        // Check cooldown by fetching previous session's Firestore createdAt timestamp
        if (user?.uid) {
            try {
                const sessions = await getUserWorkspaceSessions(user.uid, 'ai-influencer');
                // Find the most recent session that's not the current one
                const previousSession = sessions
                    .filter(s => s.id !== sessionId && s.createdAt)
                    .sort((a, b) => {
                        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
                        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
                        return bTime - aTime;
                    })[0];
                
                if (previousSession?.createdAt) {
                    const createdAtMs = previousSession.createdAt.toMillis ? previousSession.createdAt.toMillis() : 
                                       previousSession.createdAt.seconds ? previousSession.createdAt.seconds * 1000 : null;
                    
                    if (createdAtMs) {
                        const timeSinceLastSession = Date.now() - createdAtMs;
                        const cooldownMs = 60000; // 1 minute
                        
                        if (timeSinceLastSession < cooldownMs) {
                            const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSession) / 1000);
                            addAssistant(`⏱️ Slow down! You can start a new generation in ${remainingSeconds} seconds. VEVO is still cooking your last one.`);
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking session cooldown:', error);
            }
        }
        
        const wordCount = rawScript.trim().split(/\s+/).length;
        addUser(
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-white/60" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Script Uploaded • {wordCount} words</span>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 max-h-[200px] overflow-y-auto custom-scrollbar">
                    <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">{rawScript}</p>
                </div>
            </div>
        );
        addAssistant('🔥 Script locked in! Now tell VEVO — how long are we cookin\' this masterpiece?');
        setChatStep('duration');
    };

    // ── Step 2: Duration ─────
    const handleDurationSelect = (duration: 15 | 30 | 60) => {
        if (!user?.uid) {
            addAssistant('❌ Please sign in to generate videos.');
            return;
        }

        setSelectedDuration(duration);
        addUser(`${duration === 15 ? '0 to 15' : duration === 30 ? '15 to 30' : '30 to 60'} seconds`);
        
        setChatStep('tts-pacing');
        addAssistant('Duration? LOCKED. Now pick the vibe — how do you want VEVO to talk?');
    };

    // ── Step 2b: Pacing → Phase 1 Script Generation ─────
    const handlePacingSelect = async (pacing: 'calm' | 'fast') => {
        if (!user?.uid) {
            addAssistant('❌ Please sign in to continue.');
            return;
        }

        if (!rawScript || rawScript.trim().length === 0) {
            addAssistant('❌ Please upload a script first.');
            setChatStep('upload-script');
            return;
        }

        setTtsPacing(pacing);
        addUser(`${pacing === 'calm' ? 'Calm & Steady' : 'Fast & Punchy'} style`);

        setIsGenerating(true);
        setChatStep('generating-script');
        scriptMessageShownRef.current = false;
        addAssistant(`VEVO is thinking... conjuring a ${selectedDuration === 15 ? '0–15s' : selectedDuration === 30 ? '15–30s' : '30–60s'} script from your raw material. This hits different.`);

        try {
            const authToken = await user.getIdToken();
            const res = await fetch('/api/ai-influencer/generate-script', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    script: rawScript,
                    duration: selectedDuration,
                    ttsPacing: pacing
                }),
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.error || 'Failed to generate script');

            setGeneratedScript(data.script);
            setEditableScript(data.script);

            // Store mood
            if (data.mood) {
                setScriptMood(data.mood);
            }

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

            // ── DEDUCT CREDITS AFTER SUCCESSFUL SCRIPT GENERATION ──
            const newJobId = generateJobId();
            setJobId(newJobId);

            // Check if user has sufficient credits
            const creditCheck = await checkCredits(user.uid, 'AI_INFLUENCER');
            if (!creditCheck.allowed) {
                addAssistant(`❌ ${creditCheck.error || 'Insufficient credits. You need 200 credits to generate an AI Influencer video.'}`);
                setIsGenerating(false);
                setChatStep('tts-pacing');
                return;
            }

            // Deduct 200 credits after script is analyzed and generated
            await deductCredits(
                user.uid,
                200,
                'AI_INFLUENCER',
                newJobId,
                'AI-Influencer Generation'
            );

            addAssistant(`✨VEVO cooked! ${data.wordCount} words of pure OKVEVO energy.\n\n200 credits deducted.\n\nRead it. Live it. Edit it if you dare. Then hit Finalise Script.`);
            setChatStep('edit-script');
            setIsGenerating(false);

        } catch (err: any) {
            console.error('Script generation error:', err);
            const errorMsg = err.message || 'Unknown error';
            
            if (errorMsg.includes('Missing required field')) {
                addAssistant(`❌ Script data missing. Please upload your script again.`);
                setChatStep('upload-script');
            } else if (errorMsg.includes('Insufficient credits')) {
                addAssistant(`❌ ${errorMsg}`);
            } else if (errorMsg.includes('high demand') || errorMsg.includes('503')) {
                addAssistant(`⚠️ Vevo is experiencing high demand. Trying again...`);
                setChatStep('tts-pacing');
            } else {
                addAssistant(`❌ Generation failed: ${errorMsg}. Try again.`);
                setChatStep('tts-pacing');
            }
            
            setIsGenerating(false);
        }
    };

    // ── Step 3: Generate script ──────────────────────────
    // REDUNDANT - Now handled by Step Function
    const generateScript = async (duration: number, scriptToSend: string) => {
        console.log('Sit back and Relax, Vevo is Vevoing');
    };

    // ── Step 4: Confirm script → Phase 2 Start Step Function ───────
    const handleConfirmScript = async () => {
        if (!user?.uid || !editableScript || !selectedDuration || !jobId) {
            addAssistant('❌ Missing required data to start video generation.');
            return;
        }

        // Use existing jobId from handleScriptSubmit (where credits were deducted)

        addUser('[Script confirmed]');
        addAssistant('Script? DONE. VEVO stamped it APPROVED. 🔒');
        addAssistant('Now gimme the face. Upload your avatar video — MP4, MOV, or WebM. This is who VEVO speaks through.');

        try {
            // Save initial job state to Firestore
            const jobRef = doc(db, 'users', user.uid, 'aiInfluencerJobs', jobId);
            await setDoc(jobRef, {
                jobId: jobId,
                userId: user.uid,
                sessionId: sessionId, // Link job to session for isolation
                script: editableScript,
                mood: scriptMood,
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

            // console.log('✅ Script and moments saved to Firestore');
            setChatStep('avatar-video');
        } catch (err: any) {
            addAssistant(`💀 OKVEVO couldn't stash the script: Try Again or Contact at info@okvevo.com`); //${err.message}
        }
    };

    // ── Step 5: Avatar video upload ───────────────────────
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid || !jobId) return;

        setAvatarVideo(file);
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
        addUser(
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <Video size={14} className="text-white/60" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Avatar Video • {fileSizeMB}MB</span>
                </div>
                <div className="text-[12px] text-white/50">Uploading to VEVO servers...</div>
            </div>
        );
        addAssistant('OKVEVO is beaming up your avatar'); //Uploading AVATAR to Firebase
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

            // Add download link for uploaded avatar
            addUser(
                <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className="text-green-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400">Avatar Uploaded Successfully</span>
                    </div>
                    <a
                        href={`/api/download-video?url=${encodeURIComponent(videoUrl)}`}
                        download
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/20 transition-all active:scale-95"
                    >
                        <Download size={12} strokeWidth={3} /> Download Avatar
                    </a>
                </div>
            );
            addAssistant('VEVO sees your face. Now let\'s give it a voice.');
            addAssistant('Pick Richard or Aurora — or upload a voice sample. We go full method here.');
            setChatStep('generating-tts');
            setIsGenerating(false);
        } catch (err: any) {
            addAssistant(`💀 Avatar upload fumbled: — Check file format or size. VEVO only takes quality.`); //${err.message}
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

            // addAssistant('🚀 VEVO is VEVOING. Pipeline ignited. Sit tight.');
            addAssistant('VEVO is Vevoing, ETA: 2–15 mins. Go grab a coffee.');

            // Start Step Function with all data
            const authToken = await user.getIdToken();
            const res = await fetch('/api/sqs/ai-influencer', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    jobId: jobId,
                    script: editableScript,
                    duration: selectedDuration,
                    avatarVideoUrl: avatarVideoUrl,
                    gender: selectedGender || 'female',
                    ttsPacing: ttsPacing,
                    audioSampleUrl: audioSampleUrl,
                    mood: scriptMood,
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

            console.log('Vevo Started Execution'); //✅ Step Function started:', data.executionArn
            addAssistant('Your video is being born right now. Watch the monitor 👀');

            setChatStep('generating-lipsync');
            setIsGenerating(false);
        } catch (err: any) {
            addAssistant(`💀 Pipeline choked at launch, Try again or Contact info@okvevo.com.`); //${err.message}
            setIsGenerating(false);
        }
    };

    // ── Step 7: LipSync ───────────────────────────────────
    const handleGenerateLipSync = async () => {
        if (!jobId || !avatarVideoUrl || !audioUrl) return;

        // Guard: data URLs can't be fetched by the Lambda — should never reach here now
        if (audioUrl.startsWith('data:')) {
            addAssistant('❌ Audio is a local blob — VEVO cannot use that. Regenerate the voice-over for a proper URL.');
            setChatStep('generating-tts');
            return;
        }

        // Require authentication
        if (!user?.uid) {
            addAssistant('❌ VEVO does not work for strangers. Sign in first, then we party.');
            return;
        }

        setIsGenerating(true);
        setChatStep('generating-lipsync');
        addAssistant('🎬 VEVO is bringing your avatar to life, we call this the VEVO Kiss. Give it 2–5 mins.');

        try {
            const authToken = await user.getIdToken();
            const res = await fetch('/api/sqs/ai-influencer', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    jobId,
                    action: 'resume',
                    taskToken: waitTaskToken, // The token from the Human_Wait state
                    avatarVideoUrl: avatarVideoUrl,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to resume');
            addAssistant(`Avatar delivered! OKVEVO is monitoring the render... usually 1–3 mins. Don't touch anything.`);
        } catch (err: any) {
            addAssistant(`💀 OKVEVO hit a snag: Might need a few more seconds — wait and retry.`); //${err.message}.
            setChatStep('preview-audio');
            setIsGenerating(false);
        }
    };

    // ─── Render ─────────────────────────────────────────────
    const currentStepIdx = getStepIndex(chatStep);

    return (
        <section
            data-section-theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            className="relative h-screen bg-black text-black dark:text-white font-sans selection:bg-[#E2FF4D]/30 overflow-hidden transition-colors duration-500"
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
                    className="fixed inset-0 w-full h-full object-cover opacity-50"
                    style={{ filter: 'hue-rotate(145deg) saturate(1.4) brightness(0.7)' }}
                >
                    <source src="/videos/bg-blue.mp4" type="video/mp4" />
                </video>

                {/* Global Textural Dot Grid (Stitch Aesthetic) */}
                <div className="fixed inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20 z-0" />

                {/* Orange Ambient Light Overlay */}
                <div className="fixed inset-0 bg-orange-600/5 pointer-events-none z-0 mix-blend-overlay" />



                {/* ── Body — history sidebar + main content ── */}
                <div className="flex-1 flex relative z-10 overflow-hidden">
                    {/* Session History Sidebar Overlay */}
                    {user?.uid && (
                        <div className={`absolute top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${isHistoryOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'} rounded-r-[2rem] overflow-hidden shadow-2xl border-y border-r border-white/10`}>
                            <div className="relative h-full">
                                <SessionHistorySidebar
                                    userId={user.uid}
                                    feature="ai-influencer"
                                    currentSessionId={sessionId}
                                    onSelectSession={(session) => {
                                        handleRestoreSession(session);
                                        setIsHistoryOpen(false);
                                    }}
                                    onNewSession={() => {
                                        handleNewInfluencerSession();
                                        setIsHistoryOpen(false);
                                    }}
                                    accentColor="orange"
                                    initiallyCollapsed={false}
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

                    <main className="flex-1 relative ml-0 md:ml-12 z-10 px-4 md:px-10 w-full max-w-[1600px] pt-8 bg-transparent mx-auto flex flex-col h-full min-h-0 overflow-hidden">

                        {/* Header with Professional Status */}
                        {activeTab === 'explainers' ? (
                            <div className="flex flex-col lg:flex-row gap-6 md:gap-10 items-stretch justify-center flex-1 h-full max-h-full overflow-hidden pb-8 min-h-0 relative">

                                {/* ── LEFT: Step Wizard ── */}
                                <div className={`flex-1 w-full max-w-full lg:max-w-[750px] flex flex-col gap-6 h-full max-h-full overflow-hidden min-h-0 ${activeMobileTab === 'workstation' ? 'flex' : 'hidden lg:flex'}`}>
                                    {/* Page Title & Status */}
                                    <div className="flex items-center gap-4 px-2 mb-2">
                                        {/* <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-[0_0_20px_rgba(234,88,12,0.15)] backdrop-blur-3xl shrink-0">
                                            <Sparkles size={20} className="text-orange-500" />
                                        </div> */}
                                        <div className="flex flex-col">
                                            <h1 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-white">AI Influencer Studio</h1>
                                            <div className="flex items-center gap-2 mt-1">
                                                {/* <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" /> */}
                                                {/* <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-orange-500/80">Neural Synthesis Protocol Active</span> */}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Chat Panel ── */}
                                    <div className="flex flex-col flex-1 min-h-0 glass-studio-panel border border-white/20 rounded-[2.5rem] overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none rounded-[2.5rem]" />
                                        {/* Chat header */}
                                        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">VEVO Chat</span>
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
                                                            <span className="w-1 h-1 rounded-full bg-orange-500" /> Your Script
                                                        </p>
                                                    </div>
                                                    <textarea
                                                        value={rawScript}
                                                        onChange={(e) => setRawScript(e.target.value)}
                                                        placeholder="Synthesize your story here..."
                                                        className="w-full h-32 p-5 rounded-2xl border border-white/10 bg-white/[0.03] text-[13px] text-white/90 focus:border-white/30 focus:ring-1 focus:ring-white/10 outline-none resize-none placeholder-white/20 leading-relaxed transition-all shadow-inner"
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
                                                            Continue <ChevronRight size={14} strokeWidth={3} />
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
                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Temporal Calibration
                                                    </p>
                                                    <div className="flex gap-3">
                                                        {([15, 30, 60] as const).map((d) => (
                                                            <button
                                                                key={d}
                                                                onClick={() => handleDurationSelect(d)}
                                                                disabled={isGenerating}
                                                                className="flex-1 py-4 rounded-2xl font-black text-[12px] tracking-[0.1em] border transition-all flex flex-col items-center gap-2 disabled:opacity-20 bg-white/[0.02] border-white/5 text-white/60 hover:border-orange-500/50 hover:bg-orange-600/10 hover:text-white hover:shadow-[0_0_20px_rgba(234,88,12,0.1)] active:scale-95"
                                                            >
                                                                <Clock size={16} className="text-orange-500" strokeWidth={2.5} />
                                                                <span>{d === 15 ? '0–15' : d === 30 ? '15–30' : '30–60'} Seconds</span>
                                                                <span className="text-[8px] text-white/20 font-black tracking-widest uppercase">~{Math.floor(d * 2.5)} Tokens / {d === 15 ? '3' : d === 30 ? '5' : '8'} Images</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}

                                            {/* STEP 3: Pacing */}
                                            {chatStep === 'tts-pacing' && (
                                                <motion.div
                                                    key="tts-pacing"
                                                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                                    className="px-6 py-6 border-b border-white/5 bg-white/[0.01] shrink-0 space-y-4"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Pacing Calibration
                                                    </p>
                                                    <div className="flex gap-3">
                                                        <button
                                                            onClick={() => handlePacingSelect('calm')}
                                                            disabled={isGenerating}
                                                            className="flex-1 py-4 rounded-2xl font-black text-[12px] tracking-[0.1em] border transition-all flex flex-col items-center gap-2 disabled:opacity-20 bg-white/[0.02] border-white/5 text-white/60 hover:border-orange-500/50 hover:bg-orange-600/10 hover:text-white hover:shadow-[0_0_20px_rgba(234,88,12,0.1)] active:scale-95"
                                                        >
                                                            <span>Calm & Steady</span>
                                                            <span className="text-[8px] text-white/20 font-black tracking-widest uppercase">Slower</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handlePacingSelect('fast')}
                                                            disabled={isGenerating}
                                                            className="flex-1 py-4 rounded-2xl font-black text-[12px] tracking-[0.1em] border transition-all flex flex-col items-center gap-2 disabled:opacity-20 bg-white/[0.02] border-white/5 text-white/60 hover:border-orange-500/50 hover:bg-orange-600/10 hover:text-white hover:shadow-[0_0_20px_rgba(234,88,12,0.1)] active:scale-95"
                                                        >
                                                            <span>Fast & Punchy</span>
                                                            <span className="text-[8px] text-white/20 font-black tracking-widest uppercase">Aggressive</span>
                                                        </button>
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
                                                            <span className="w-1 h-1 rounded-full bg-orange-500" /> Refined Narrative
                                                        </p>
                                                        <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{(editableScript || '').trim().split(/\s+/).length} Words</span>
                                                    </div>
                                                    <textarea
                                                        value={editableScript || ''}
                                                        onChange={(e) => setEditableScript(e.target.value)}
                                                        className="w-full h-32 p-5 rounded-2xl border border-white/20 bg-white/[0.03] text-[13px] text-white leading-relaxed focus:border-white/40 focus:ring-1 focus:ring-white/10 outline-none resize-none shadow-inner"
                                                    />
                                                    <button
                                                        onClick={handleConfirmScript}
                                                        disabled={!(editableScript || '').trim()}
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
                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Visual Identity Mapping
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
                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Acoustic Synthesis
                                                    </p>
                                                    
                                                    <div className="space-y-3">
                                                        <input
                                                            type="file"
                                                            accept="audio/mpeg,audio/wav,audio/*"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file && user?.uid && jobId) {
                                                                    setAudioSampleFile(file);
                                                                    const audioUrl = URL.createObjectURL(file);
                                                                    const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
                                                                    addUser(
                                                                        <div className="space-y-3">
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                <Volume2 size={14} className="text-white/60" />
                                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Audio Reference • {fileSizeMB}MB</span>
                                                                            </div>
                                                                            <audio controls className="w-full h-10 rounded-lg" style={{ filter: 'invert(0.9) hue-rotate(180deg)' }}>
                                                                                <source src={audioUrl} type={file.type} />
                                                                                Your browser does not support audio playback.
                                                                            </audio>
                                                                        </div>
                                                                    );
                                                                    addAssistant('OK VEVO is sampling your voice DNA... uploading to the lab 🧬');
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

                                                                        addAssistant('✅ Voice DNA locked in! Hit Commit and Continue.');
                                                                        setSelectedGender('');
                                                                        setIsGenerating(false);
                                                                    } catch (err: any) {
                                                                        addAssistant(`💀 Voice clone failed at upload: — the lab is shook.`); //${err.message}
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
                                                            {audioSampleFile ? 'Reference DNA Linked' : 'Your Voice'}
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
                                                            : <><Sparkles size={14} /> Commit and Continue</>
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
                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Audio Verification
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
                                                            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white">VEVO is bringing your AVATAR to Life</p>
                                                            <p className="text-[9px] text-white/30 mt-1 uppercase font-bold tracking-widest">We call it The VEVO Kiss</p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                        </AnimatePresence>

                                        {/* ── Chat Messages ── */}
                                        <div 
                                            data-lenis-prevent
                                            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-8 space-y-8 bg-transparent custom-scrollbar rounded-[2.5rem] scroll-smooth"
                                        >
                                            {chatMessages.map((msg, i) => (
                                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`flex flex-col gap-2.5 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                        {msg.role === 'assistant' && (
                                                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 mb-1 backdrop-blur-md">
                                                                <Sparkles size={10} className="text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">VEVO SPEAKING</span>
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
                                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">VEVO IS Vevoing</span>
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
                                                                <span className="text-[10px] text-white/30 ml-3 font-black uppercase tracking-[0.2em]">Conjuring...</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {errorMessage && (
                                                <div className="flex justify-start">
                                                    <div className="flex flex-col gap-2.5 items-start max-w-[85%]">
                                                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 mb-1 backdrop-blur-md">
                                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-red-400">PIPELINE FAILURE • {errorCode}</span>
                                                        </div>
                                                        <div className="bg-red-500/5 rounded-[2rem] rounded-tl-none px-7 py-5 border border-red-500/20 backdrop-blur-2xl shadow-2xl ring-1 ring-red-500/10 w-full space-y-4">
                                                            <p className="text-[14px] text-red-200/80 leading-relaxed">
                                                                {errorMessage}
                                                            </p>
                                                            
                                                            {/* Show partial assets info if available */}
                                                            {(imageTimeline.some(img => img.imageUrl) || audioUrl) && (
                                                                <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400 mb-2">
                                                                        ✅ Partial Assets Saved
                                                                    </p>
                                                                    <div className="space-y-1.5 text-[11px] text-white/60">
                                                                        {imageTimeline.some(img => img.imageUrl) && (
                                                                            <p>• Visual Moments: {imageTimeline.filter(img => img.imageUrl).length}/{imageTimeline.length} generated</p>
                                                                        )}
                                                                        {audioUrl && (
                                                                            <p>• Audio: Generated successfully</p>
                                                                        )}
                                                                        <p className="text-[10px] text-green-300/80 mt-2">
                                                                            Check the assets panel on the right to view →
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            <button 
                                                                onClick={() => {
                                                                    setErrorMessage(null);
                                                                    setErrorCode(null);
                                                                    setChatStep('edit-script');
                                                                }}
                                                                className="mt-4 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-[10px] font-black uppercase tracking-widest text-red-200 hover:bg-red-500/30 transition-all"
                                                            >
                                                                Restart Pipeline
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {chatStep === 'complete' && finalVideoUrl && (
                                                <motion.div 
                                                    initial={{ opacity: 0, scale: 0.95 }} 
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="flex justify-start"
                                                >
                                                    <div className="flex flex-col gap-2.5 items-start max-w-[80%]">
                                                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 mb-1 backdrop-blur-md">
                                                            <CheckCircle2 size={10} className="text-green-400" />
                                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-green-400">VEVO DELIVERED 🔥</span>
                                                        </div>
                                                        <div className="bg-green-500/5 rounded-[2rem] rounded-tl-none px-7 py-6 border border-green-500/20 backdrop-blur-2xl shadow-2xl ring-1 ring-green-500/10 space-y-4">
                                                            <p className="text-[14px] text-green-200/80 leading-relaxed">
                                                                Your video is ready! Download it now.
                                                            </p>
                                                            <a
                                                                href={`/api/download-video?url=${encodeURIComponent(finalVideoUrl)}`}
                                                                download
                                                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-500 transition-all shadow-xl active:scale-95 cursor-pointer"
                                                            >
                                                                <Download size={14} strokeWidth={3} /> Secure Download
                                                            </a>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                            {chatStep === 'complete' && (
                                                <motion.div 
                                                    initial={{ opacity: 0, scale: 0.95 }} 
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="flex justify-start"
                                                >
                                                    <div className="flex flex-col gap-2.5 items-start max-w-[85%]">
                                                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 mb-1 backdrop-blur-md">
                                                            <Sparkles size={10} className="text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30">VEVO SPEAKING</span>
                                                        </div>
                                                        <div className="bg-white/[0.02] rounded-[2rem] rounded-tl-none px-7 py-6 border border-white/5 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 w-full">
                                                            <button
                                                                onClick={() => setBrandingOpen(v => !v)}
                                                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 transition-all"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                   
                                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-300">Add Custom Branding and Thumbnail</span>
                                                                    <span className="text-[8px] text-white/20 font-bold uppercase">Optional</span>
                                                                </div>
                                                                <ChevronDown
                                                                    size={13}
                                                                    className={`text-green-400/60 transition-transform duration-300 ${brandingOpen ? 'rotate-180' : ''}`}
                                                                />
                                                            </button>

                                                            <AnimatePresence>
                                                                {brandingOpen && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, height: 0 }}
                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                        exit={{ opacity: 0, height: 0 }}
                                                                        transition={{ duration: 0.25 }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="mt-4 space-y-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] max-h-[400px] overflow-y-auto custom-scrollbar">
                                                                            {/* Logo and Marquee Side by Side */}
                                                                            <div className="grid grid-cols-2 gap-4">
                                                                                {/* Logo Section */}
                                                                                <div className="space-y-2">
                                                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Logo
                                                                                    </p>
                                                                                    <label
                                                                                        htmlFor="brand-logo-upload-chat"
                                                                                        className={`w-full py-3 rounded-xl border border-dashed flex justify-center items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] cursor-pointer transition-all active:scale-[0.98] ${
                                                                                            brandLogoFile
                                                                                                ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                                                                                                : 'border-white/10 bg-white/[0.02] text-white/30 hover:border-orange-500/30 hover:bg-orange-500/5'
                                                                                        }`}
                                                                                    >
                                                                                        <Image size={13} strokeWidth={2.5} />
                                                                                        {brandLogoFile ? brandLogoFile.name : 'Upload Logo'}
                                                                                    </label>
                                                                                    <input
                                                                                        id="brand-logo-upload-chat"
                                                                                        type="file"
                                                                                        accept="image/png,image/jpeg,image/webp"
                                                                                        className="hidden"
                                                                                        onChange={e => {
                                                                                            const f = e.target.files?.[0] ?? null;
                                                                                            setBrandLogoFile(f);
                                                                                            e.target.value = '';
                                                                                        }}
                                                                                    />
                                                                                    {brandLogoFile && (
                                                                                        <div className="space-y-1.5">
                                                                                            <p className="text-[8px] font-black uppercase tracking-widest text-white/20">Corner:</p>
                                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                                {([
                                                                                                    { val: 'top-left',     label: '↖ TL' },
                                                                                                    { val: 'top-right',    label: '↗ TR' },
                                                                                                    { val: 'bottom-left',  label: '↙ BL' },
                                                                                                    { val: 'bottom-right', label: '↘ BR' },
                                                                                                ] as { val: typeof brandLogoPos; label: string }[]).map(({ val, label }) => {
                                                                                                    const conflictRow = brandMarqueeText.trim() ? brandMarqueePos : null;
                                                                                                    const isConflict  = conflictRow && val.startsWith(conflictRow);
                                                                                                    return (
                                                                                                        <button
                                                                                                            key={val}
                                                                                                            disabled={!!isConflict}
                                                                                                            onClick={() => setBrandLogoPos(val)}
                                                                                                            className={`py-2 px-2 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] border transition-all active:scale-95 ${
                                                                                                                isConflict
                                                                                                                    ? 'opacity-25 cursor-not-allowed border-white/5 bg-white/[0.01] text-white/20'
                                                                                                                    : brandLogoPos === val
                                                                                                                        ? 'bg-orange-600/20 border-orange-500/40 text-orange-300'
                                                                                                                        : 'bg-white/[0.02] border-white/5 text-white/30 hover:border-white/20'
                                                                                                            }`}
                                                                                                        >
                                                                                                            {label}
                                                                                                        </button>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Marquee Section */}
                                                                                <div className="space-y-2">
                                                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                                                        <span className="w-1 h-1 rounded-full bg-orange-500" /> Marquee
                                                                                    </p>
                                                                                    <textarea
                                                                                        value={brandMarqueeText}
                                                                                        onChange={e => setBrandMarqueeText(e.target.value)}
                                                                                        placeholder="Scrolling text..."
                                                                                        rows={2}
                                                                                        className="w-full p-3 rounded-xl border border-white/10 bg-white/[0.03] text-[11px] text-white/80 focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 outline-none resize-none placeholder-white/20"
                                                                                    />
                                                                                    {brandMarqueeText.trim() && (
                                                                                        <div className="flex gap-2">
                                                                                            <p className="text-[8px] font-black uppercase tracking-widest text-white/20 self-center">Pos:</p>
                                                                                            {(['bottom', 'top'] as const).map(pos => (
                                                                                                <button
                                                                                                    key={pos}
                                                                                                    onClick={() => {
                                                                                                        setBrandMarqueePos(pos);
                                                                                                        setBrandLogoPos(pos === 'bottom' ? 'top-right' : 'bottom-right');
                                                                                                    }}
                                                                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border transition-all active:scale-95 ${
                                                                                                        brandMarqueePos === pos
                                                                                                            ? 'bg-orange-600/20 border-orange-500/40 text-orange-300'
                                                                                                            : 'bg-white/[0.02] border-white/5 text-white/30 hover:border-white/20'
                                                                                                    }`}
                                                                                                >
                                                                                                    {pos === 'bottom' ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                                                                                                    {pos}
                                                                                                </button>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>

                                                                            {/* Thumbnail Section */}
                                                                            <div className="space-y-4 pt-4 border-t border-white/5">
                                                                                <div className="flex items-center justify-between">
                                                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
                                                                                        <span className="w-1 h-1 rounded-full bg-blue-500" />Thumbnail
                                                                                    </p>
                                                                                    <button
                                                                                        onClick={() => !thumbnailAlreadyGenerated && setBrandNeedThumbnail(v => !v)}
                                                                                        disabled={thumbnailAlreadyGenerated}
                                                                                        className={`w-8 h-4 rounded-full transition-colors relative ${
                                                                                            thumbnailAlreadyGenerated 
                                                                                                ? 'bg-green-500/30 cursor-not-allowed' 
                                                                                                : brandNeedThumbnail 
                                                                                                    ? 'bg-blue-500' 
                                                                                                    : 'bg-white/10'
                                                                                        }`}
                                                                                    >
                                                                                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                                                                                            thumbnailAlreadyGenerated || brandNeedThumbnail ? 'translate-x-4' : 'translate-x-0'
                                                                                        }`} />
                                                                                    </button>
                                                                                </div>
                                                                                {thumbnailAlreadyGenerated && (
                                                                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                                                                                        <CheckCircle2 size={12} className="text-green-400" />
                                                                                        <span className="text-[9px] text-green-300 font-bold uppercase tracking-wider">
                                                                                            Thumbnail Already Generated ✓
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {brandNeedThumbnail && !thumbnailAlreadyGenerated && (
                                                                                    <div className="space-y-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                                                                                        <textarea
                                                                                            value={brandThumbnailPrompt}
                                                                                            onChange={e => setBrandThumbnailPrompt(e.target.value)}
                                                                                            placeholder="Describe the thumbnail..."
                                                                                            rows={2}
                                                                                            className="w-full p-3 rounded-xl border border-white/10 bg-white/[0.03] text-[11px] text-white/80 focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 outline-none resize-none placeholder-white/20"
                                                                                        />
                                                                                        <label
                                                                                            className={`w-full py-3 rounded-xl border border-dashed flex justify-center items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] cursor-pointer transition-all active:scale-[0.98] ${
                                                                                                brandThumbnailPhotoFile
                                                                                                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                                                                                    : 'border-white/10 bg-white/[0.02] text-white/30 hover:border-blue-500/30 hover:bg-blue-500/5'
                                                                                            }`}
                                                                                        >
                                                                                            <Image size={13} strokeWidth={2.5} />
                                                                                            {brandThumbnailPhotoFile ? brandThumbnailPhotoFile.name : 'Upload Photo (Optional)'}
                                                                                            <input
                                                                                                type="file"
                                                                                                accept="image/png,image/jpeg,image/webp"
                                                                                                className="hidden"
                                                                                                onChange={e => {
                                                                                                    const f = e.target.files?.[0] ?? null;
                                                                                                    setBrandThumbnailPhotoFile(f);
                                                                                                    e.target.value = '';
                                                                                                }}
                                                                                            />
                                                                                        </label>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Apply Button */}
                                                                            <button
                                                                                onClick={handleApplyBranding}
                                                                                disabled={isBranding || (!brandLogoFile && !brandMarqueeText.trim() && !brandNeedThumbnail)}
                                                                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg"
                                                                            >
                                                                                {isBranding
                                                                                    ? <><Loader2 size={13} className="animate-spin" /> VEVO Branding…</>
                                                                                    : <><Sparkles size={13} /> VEVO-fy This Video</>
                                                                                }
                                                                            </button>

                                                                            {/* Download Results */}
                                                                            {(brandedVideoUrl || customThumbnailUrl) && (
                                                                                <div className="flex flex-col gap-2 pt-2">
                                                                                    {brandedVideoUrl && (
                                                                                        <a
                                                                                            href={`/api/download-video?url=${encodeURIComponent(brandedVideoUrl)}`}
                                                                                            download
                                                                                            className="w-full py-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-green-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                                                                                        >
                                                                                            <Download size={13} strokeWidth={3} /> Download Branded Video
                                                                                        </a>
                                                                                    )}
                                                                                    {customThumbnailUrl && (
                                                                                        <a
                                                                                            href={customThumbnailUrl}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            download
                                                                                            className="w-full py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                                                                                        >
                                                                                            <Image size={13} strokeWidth={3} /> Download Thumbnail
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>
                                        
                                        {/* Disclaimer */}
                                        <div className="px-6 py-3 text-center">
                                            <p className="text-[8px] text-white/50 leading-relaxed">
                                                OKVEVO can make mistakes. Re-check every generation. Contact: <a href="mailto:info@okvevo.com" className="text-green-400/70 hover:text-orange-400/60 transition-colors">info@okvevo.com</a>
                                            </p>
                                        </div>
                                    </div>
                                    <div 
                                        ref={stepsRef}
                                        className="hidden lg:flex items-center gap-1 bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-3 overflow-x-auto scrollbar-hide relative group isolate will-change-transform"
                                        style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
                                    >
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
                                

                                {/* ── RIGHT: Monitor Output & Assets ── */}
                                <div className={`flex-1 flex flex-col lg:flex-row gap-6 items-stretch h-full max-h-full overflow-hidden min-h-0 ${(activeMobileTab === 'monitor' || activeMobileTab === 'assets') ? 'flex' : 'hidden lg:flex'}`}>
                                    {/* Monitor Column */}
                                    <div
                                        className={`h-full w-full max-w-[420px] mx-auto lg:mx-0 shrink-0 glass-studio-panel rounded-[2.5rem] border border-white/20 overflow-hidden relative group/monitor transition-all duration-700 hover:border-white/30 ${activeMobileTab === 'assets' ? 'hidden lg:block' : 'block'}`}
                                        style={{
                                            aspectRatio: '9/16',
                                            maxHeight: 'min(calc(100vh - 10rem), 750px)',
                                            width: 'min(100%, 420px)'
                                        }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none z-10 rounded-[2.5rem]" />
                                        {/* Cinematic Glass Glare */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-30 pointer-events-none z-10 rounded-[2.5rem]" />
                                        
                                        {/* High-Tech Grid bg */}
                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0 rounded-[2.5rem]" />

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
                                                    className="absolute inset-0 flex items-center justify-center bg-transparent group rounded-[2.5rem] overflow-hidden"
                                                >
                                                    <video
                                                        src={finalVideoUrl}
                                                        controls
                                                        autoPlay
                                                        className="w-full h-full object-contain rounded-[2.5rem]"
                                                    />
                                                    {/* Pro Status Overlay */}
                                                    <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-xl text-[9px] font-black text-white/60 uppercase tracking-[0.2em] z-20 pointer-events-none flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                                        VEVO Mode
                                                    </div>
                                                </motion.div>
                                            ) : isGenerating ? (
                                                <motion.div
                                                    key="loading"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute inset-0 flex flex-col items-center justify-center gap-8 glass-studio-panel z-20 rounded-[2.5rem]"
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
                                                        <p className="text-sm font-black uppercase tracking-[0.3em] text-white/80">VEVO is Cooking</p>
                                                        <div className="flex justify-center gap-1.5">
                                                            {[0,1,2].map(i => (
                                                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500/20 animate-pulse" />
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">
                                                            {chatStep === 'generating-lipsync' ? 'VEVO is syncing lips… almost there' : 'VEVO is conjuring frames… hang tight'}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="empty"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 transition-all rounded-[2.5rem]"
                                                >
                                                    <div className="relative group/icon mb-8">
                                                        <div className="absolute -inset-8 bg-orange-500/5 rounded-full blur-3xl opacity-0 group-hover/monitor:opacity-100 transition-opacity duration-1000" />
                                                        <div className="w-24 h-24 rounded-[3rem] border border-dashed border-white/10 flex items-center justify-center group-hover/monitor:border-orange-500/30 transition-all duration-700 bg-white/[0.01]">
                                                            <MonitorPlay size={36} className="text-white/[0.05] group-hover/monitor:text-orange-500/50 transition-all duration-1000 group-hover/monitor:scale-110" />
                                                        </div>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-white/10 mb-3 tracking-tighter group-hover/monitor:text-white/40 transition-colors duration-700">VEVO Monitor</h3>
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className="w-2 h-2 rounded-full bg-white/5 animate-pulse" />
                                                        <p className="text-[10px] text-white/10 font-black uppercase tracking-[0.3em] group-hover/monitor:text-white/20 transition-colors">
                                                            Waiting for your drop...
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>


                                    </div>

                                    {/* Right Side Sidebar (Script + Assets) */}
                                    <div className={`flex-1 flex flex-col gap-4 overflow-hidden ${activeMobileTab === 'monitor' ? 'hidden lg:flex' : 'flex'}`}>
                                        {/* Script quick-view panel (shown after step 4) */}
                                        {editableScript && getStepIndex(chatStep) >= getStepIndex('avatar-video') && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="w-full shrink-0 bg-white/[0.02] border border-orange-500/30 rounded-2xl p-4 shadow-[0_0_15px_rgba(234,88,12,0.15)] ring-1 ring-orange-500/10"
                                            >
                                                <p className="text-[8px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest mb-2 flex items-center gap-1">
                                                    <FileText size={8} /> Script Preview
                                                </p>
                                                <div data-lenis-prevent className="max-h-[100px] overflow-y-auto custom-scrollbar pr-2">
                                                    <p className="text-[10px] text-black/60 dark:text-white/50 leading-relaxed whitespace-pre-wrap">
                                                        {editableScript}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* ── Photo Assets Panel ── */}
                                        {imageTimeline.length > 0 && getStepIndex(chatStep) >= getStepIndex('avatar-video') && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="w-full flex-1 flex flex-col min-h-0 bg-white/[0.02] border border-orange-500/30 rounded-2xl p-4 shadow-[0_0_15px_rgba(234,88,12,0.15)] ring-1 ring-orange-500/10"
                                            >
                                                <div className="flex items-center justify-between mb-3 shrink-0">
                                                    <p className="text-[8px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest flex items-center gap-1.5">
                                                        <Sparkles size={8} /> Visual Assets
                                                    </p>
                                                    <span className="text-[8px] text-gray-400">
                                                        {imageTimeline.filter(p => p.imageUrl).length}/{imageTimeline.length} ready
                                                    </span>
                                                </div>


                                                {/* Image strip */}
                                                {imageTimeline.length > 0 && (
                                                    <div 
                                                        data-lenis-prevent
                                                        className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-1 pr-2"
                                                    >
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
                                    <Sparkles size={14} /> Coming Soon.
                                </button>
                            </div>
                        )}
                        {/* Mobile Tab Switcher */}
                        <div className="lg:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] p-1.5 glass-studio-panel border border-white/20 rounded-2xl shadow-2xl flex items-center gap-1 w-[90%] max-w-[400px]">
                            <button
                                onClick={() => setActiveMobileTab('workstation')}
                                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5 ${activeMobileTab === 'workstation' 
                                    ? 'bg-orange-600 text-white shadow-[0_5px_15px_rgba(234,88,12,0.3)]' 
                                    : 'text-white/40 hover:text-white/60'
                                }`}
                            >
                                <Edit3 size={12} /> Studio
                            </button>
                            <button
                                onClick={() => setActiveMobileTab('monitor')}
                                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5 ${activeMobileTab === 'monitor' 
                                    ? 'bg-orange-600 text-white shadow-[0_5px_15px_rgba(234,88,12,0.3)]' 
                                    : 'text-white/40 hover:text-white/60'
                                }`}
                            >
                                <MonitorPlay size={12} /> Monitor
                            </button>
                            <button
                                onClick={() => setActiveMobileTab('assets')}
                                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5 ${activeMobileTab === 'assets' 
                                    ? 'bg-orange-600 text-white shadow-[0_5px_15px_rgba(234,88,12,0.3)]' 
                                    : 'text-white/40 hover:text-white/60'
                                }`}
                            >
                                <Sparkles size={12} /> Assets
                            </button>
                        </div>
                    </main>
                    
                    {/* Disclaimer */}
                    
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
