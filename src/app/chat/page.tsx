
"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import {
    Send,
    Loader2,
    StopCircle,
    Image as ImageIcon,
    Layout,
    Clock,
    RotateCcw,
    Sparkles,
    Bot,
    User,
    Volume2,
    Film,
    CheckCircle
} from 'lucide-react';
import { useVideoGeneration } from '../../hooks/useVideoGeneration';
import { useChatFlow, ChatFlowState } from '../../hooks/useChatFlow';
import { useAuth } from '../../hooks/useAuth';
import VideoPlayer from '../../components/VideoPlayer';
import ChatWelcome from '../../components/chat/ChatWelcome';
import ChatHistorySidebar from '../../components/chat/ChatHistorySidebar';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Scene, ChatMessage } from '../../services/AIService';
import { fetchVideosFromStorage } from '../../services/StorageService';
import { MODELS } from '../../config/models';
import StudioLayout from '../studio/layout';
import { motion, AnimatePresence } from 'framer-motion';

function ChatPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialSessionId = searchParams.get('id');
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // Video Generation Logic
    const {
        analyzedScenes,
        videoUrls,
        error: videoError,
        isStitching,
        stitchedVideoUrl,
        narrationScript,
        narrationAudioUrl,
        generatingNarration,
        generatingAudio,
        setAnalyzedScenes,
        generateVideosFromScenes,
        stitchVideosWithAWSLambda,
        resetAnalysis,
        updateAnalyzedScene,
        generateNarration,
        generateAudio,
        regenerateNarration,
        setVideoUrls,
        // Map to existing names if needed or use direct
        status: videoStatus,
        videoUrls: generatedVideos,
        setVideoUrls: setGeneratedVideos,
        generateVideosFromScenes: generateVideos
    } = useVideoGeneration();

    // Chat Logic
    const {
        messages,
        currentState,
        loading: chatLoading,
        error: chatError,
        generatingVideos: isGeneratingVideos,
        narrationResult,
        audioUrl,
        processUserStory,
        setNarrationResult,
        setAudioUrl,
        setCurrentState,
        addAssistantMessage,
        resetConversation,
        handleDurationSelection,
        handleProceedToAnalysis,
        handleSceneConfirmation,
        targetDuration,
        followUpQuestions,
        pendingStory
    } = useChatFlow({
        initialSessionId,
        onScenesGenerated: (scenes) => {
            setAnalyzedScenes(scenes);
            // When scenes are generated (from analysis), we'll update the video generation hook
            // ... (existing logic)
        }
    });

    const [inputText, setInputText] = useState('');
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [storageVideos, setStorageVideos] = useState<string[]>([]);
    const [loadingStorageVideos, setLoadingStorageVideos] = useState(false);
    const [storageError, setStorageError] = useState<string | null>(null);
    const [isStitchingStorage, setIsStitchingStorage] = useState(false);
    const [storageStitchedUrl, setStorageStitchedUrl] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dispatchedJobRef = useRef<string | null>(null);

    // --- LOGIC FUNCTIONS (Preserved) ---
    const stitchStorageVideos = async () => {
        if (storageVideos.length < 3) {
            alert('Need at least 3 videos to stitch!');
            return;
        }

        setIsStitchingStorage(true);
        setStorageStitchedUrl(null);

        try {
            const { dispatchStitchingJob } = await import('../../services/SQSStitchService');
            const result = await dispatchStitchingJob(storageVideos.slice(0, 3), audioUrl || undefined);

            if (result.success && result.jobId) {
                const pollForStitchedVideo = async () => {
                    const maxAttempts = 24;
                    for (let i = 0; i < maxAttempts; i++) {
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        try {
                            const { fetchStitchedVideos } = await import('../../services/StorageService');
                            const videos = await fetchStitchedVideos();
                            if (videos && videos.length > 0) {
                                const matchingVideo = videos.find(url => url.includes(result.jobId!));
                                if (matchingVideo) {
                                    setStorageStitchedUrl(matchingVideo);
                                    setIsStitchingStorage(false);
                                    return;
                                }
                            }
                        } catch (err) { console.error('Polling error:', err); }
                    }
                    setIsStitchingStorage(false);
                    alert("Stitching is taking longer than expected.");
                };
                pollForStitchedVideo();
            } else {
                throw new Error(result.error || 'SQS dispatch failed');
            }
        } catch (error) {
            console.error('Storage stitch error:', error);
            alert("Stitching failed");
            setIsStitchingStorage(false);
        }
    };

    const handleGenerateVideos = useCallback(async () => {
        if (analyzedScenes && currentState === 'generating_final_assets') {
            try {
                addAssistantMessage("Using pre-stored videos from storage (Demo Mode)...");
                const urls = await fetchVideosFromStorage();
                const selectedUrls = urls.slice(0, 3);
                if (selectedUrls.length < 3) {
                    addAssistantMessage("Not enough videos in storage! Need at least 3.");
                    return;
                }
                setVideoUrls(selectedUrls);
                setStorageVideos(selectedUrls);
                if (!narrationResult) {
                    try {
                        const { narrationService } = await import('../../services/NarrationService');
                        const combinedScript = analyzedScenes.map(s => s.primary_visuals).join('\n');
                        const result = await narrationService.generateNarrationFromScenes(analyzedScenes, combinedScript);
                        setNarrationResult({ narration: result, internalScenes: analyzedScenes });
                    } catch (narrationError) {
                        addAssistantMessage("AI Narration limit reached. Using scene descriptions.");
                        const fallbackScript = {
                            fullNarration: analyzedScenes.map(s => s.primary_visuals).join('. '),
                            estimatedDuration: targetDuration || 20,
                            sceneDurations: analyzedScenes.map(() => (targetDuration || 20) / analyzedScenes.length),
                            segments: []
                        };
                        setNarrationResult({ narration: fallbackScript, internalScenes: analyzedScenes });
                    }
                }
                setCurrentState('generating_audio');
            } catch (e) {
                console.error("Generation failed:", e);
                addAssistantMessage("Something went wrong. Please try again.");
            }
        }
    }, [analyzedScenes, currentState, narrationResult, setVideoUrls, setCurrentState, setNarrationResult, addAssistantMessage, targetDuration]);

    // Reset Handler
    const handleReset = () => {
        // setVideoStatus({}); // Not exposed
        setGeneratedVideos([]);
        resetConversation();
        // Clear ID from URL without full reload, or push to /chat
        router.push('/chat');
    };

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const isUserNearBottomRef = useRef(true);

    const handleScroll = () => {
        const container = chatContainerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        isUserNearBottomRef.current = distanceFromBottom < 100; // Consider "near bottom" if within 100px
    };

    // Auto-scroll to bottom of chat only if user is near bottom
    useEffect(() => {
        if (isUserNearBottomRef.current) {
            messagesEndRef.current?.scrollIntoView(); // Removed behavior: "smooth" to prevent scroll fighting
        }
    }, [messages]);

    useEffect(() => { if (currentState === 'scenes_ready') handleLoadStorageVideos(); }, [currentState]);
    useEffect(() => { if (currentState === 'generating_final_assets') handleGenerateVideos(); }, [currentState, handleGenerateVideos]);

    useEffect(() => {
        const handleAudioGeneration = async () => {
            if (currentState === 'generating_audio' && narrationResult) {
                addAssistantMessage('🎵 Generating audio narration...');
                try {
                    const { ttsService } = await import('../../services/TTSService');
                    const sessionId = 'session-' + Date.now();
                    const generatedAudioUrl = await ttsService.generateNarrationAudio(narrationResult.narration.fullNarration, sessionId);
                    setAudioUrl(generatedAudioUrl);
                    addAssistantMessage(`🔊 Audio generated! You can listen below.\n\nType 'proceed' to create your video!`);
                    setCurrentState('awaiting_final_confirmation');
                } catch (error) {
                    console.error('Audio generation failed:', error);
                    addAssistantMessage('Failed to generate audio. Please try again.');
                    setCurrentState('awaiting_narration_confirmation');
                }
            }
        };
        handleAudioGeneration();
    }, [currentState, narrationResult, addAssistantMessage, setAudioUrl, setCurrentState]);

    useEffect(() => {
        const dispatchSQS = async () => {
            const dispatchKey = `${videoUrls.slice(0, 3).join('|')}| ${audioUrl} `;
            const validVideos = videoUrls.length >= 3 ? videoUrls : storageVideos;
            if (validVideos.length >= 3 && audioUrl && currentState === 'awaiting_final_confirmation' && !isStitchingStorage) {
                if (dispatchedJobRef.current === dispatchKey) return;
                setIsStitchingStorage(true);
                dispatchedJobRef.current = dispatchKey;
                try {
                    const { dispatchStitchingJob } = await import('../../services/SQSStitchService');
                    const result = await dispatchStitchingJob(validVideos.slice(0, 3), audioUrl);
                    if (result.success && result.jobId) {
                        const pollForStitchedVideo = async () => {
                            const maxAttempts = 24;
                            for (let i = 0; i < maxAttempts; i++) {
                                await new Promise(resolve => setTimeout(resolve, 5000));
                                try {
                                    const { fetchStitchedVideos } = await import('../../services/StorageService');
                                    const videos = await fetchStitchedVideos();
                                    if (videos && videos.length > 0) {
                                        const matchingVideo = videos.find(url => url.includes(result.jobId!));
                                        if (matchingVideo) {
                                            setStorageStitchedUrl(matchingVideo);
                                            setIsStitchingStorage(false);
                                            return;
                                        }
                                    }
                                } catch (err) { console.error('Polling error:', err); }
                            }
                            setIsStitchingStorage(false);
                        };
                        pollForStitchedVideo();
                    } else { throw new Error(result.error || 'SQS dispatch failed'); }
                } catch (error) {
                    console.error('SQS dispatch error:', error);
                    setStorageError('Failed to dispatch');
                    setIsStitchingStorage(false);
                    dispatchedJobRef.current = null;
                }
            }
        };
        dispatchSQS();
    }, [videoUrls, storageVideos, audioUrl, currentState, isStitchingStorage]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || chatLoading) return;
        const userMessage = inputText.trim();
        setInputText('');

        if (currentState === 'awaiting_story') {
            await processUserStory(userMessage);
        } else if (currentState === 'awaiting_answers') {
            await handleProceedToAnalysis(userMessage);
        } else if (currentState === 'awaiting_duration') {
            const duration = parseInt(userMessage.replace(/[^0-9]/g, ''));
            if ([10, 20, 30, 60].includes(duration)) handleDurationSelection(duration);
            else addAssistantMessage("Please select a valid duration: 10, 20, 30, or 60 seconds.");
        } else if (currentState === 'scene_review') {
            const lowerMsg = userMessage.toLowerCase();
            if (lowerMsg.includes('proceed') || lowerMsg.includes('yes') || lowerMsg.includes('good') || lowerMsg.includes('confirm')) {
                handleSceneConfirmation();
            }
        }
    };

    const handleLoadStorageVideos = async () => {
        setLoadingStorageVideos(true);
        setStorageError(null);
        try {
            const urls = await fetchVideosFromStorage();
            setStorageVideos(urls);
            setCurrentVideoIndex(0);
        } catch (error) {
            setStorageError('Failed to load videos');
        } finally {
            setLoadingStorageVideos(false);
        }
    };


    const formatMessageContent = (content: string) => {
        return content.split('\n').map((line, index) => {
            if (line.startsWith('✨') || line.startsWith('🎬') || line.startsWith('🎵') || line.startsWith('🎥')) {
                return (
                    <div key={index} className="flex items-start gap-2 mb-2">
                        <span className="text-lg">{line.substring(0, 2)}</span>
                        <span className="font-semibold text-custom-orange">{line.substring(2).split(':')[0]}:</span>
                        <span className="text-gray-300">{line.substring(2).split(':')[1]}</span>
                    </div>
                );
            }
            if (line.startsWith('•')) {
                return <div key={index} className="ml-4 mb-1 text-gray-400">{line}</div>;
            }
            if (line.trim() === '') return <div key={index} className="h-2" />;
            return <div key={index} className="text-gray-300 leading-relaxed">{line}</div>;
        });
    };

    // --- UI RENDER ---
    return (
        <div className="flex flex-col h-full max-h-screen relative bg-transparent">
            {/* Background image is now handled in StudioLayout */}
            <div className="relative z-10 flex flex-col h-full">

                {/* Header / Title */}
                <div className="px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                    {/* <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-custom-orange to-orange-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-custom-orange/20">
                            O
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-white leading-tight">OKVEVO</h1>
                            <p className="text-xs text-gray-400">AI Video Director</p>
                        </div>
                    </div> */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                            title="Chat History"
                        >
                            <Clock className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleReset}
                            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                            title="Reset Conversation"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div
                    ref={chatContainerRef}
                    onScroll={handleScroll}
                    style={{ overflowAnchor: 'none' }}
                    className={`flex-1 p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent ${messages.length === 0 ? 'overflow-visible' : 'overflow-y-auto'}`}
                >
                    <div className="max-w-3xl mx-auto space-y-6 pb-4 h-full flex flex-col">

                        {/* Welcome Message (if empty) */}
                        {messages.length === 0 && (
                            <div className="flex-1 flex flex-col justify-center">
                                <ChatWelcome onSuggestionClick={setInputText} />
                            </div>
                        )}

                        {/* Chat Messages */}
                        <AnimatePresence>
                            {messages.map((message, index) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    key={index}
                                    className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'} `}
                                >
                                    {message.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-lg bg-custom-orange flex items-center justify-center shrink-0 mt-1">
                                            <Bot className="w-4 h-4 text-white" />
                                        </div>
                                    )}

                                    <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : 'order-2'} `}>
                                        {message.type === 'scene_review' && analyzedScenes ? (
                                            // Scene Review Card
                                            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 shadow-xl">
                                                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                                    <Film className="w-5 h-5 text-custom-orange" /> Scene Breakdown
                                                </h2>
                                                <div className="space-y-4">
                                                    {analyzedScenes.map((scene, idx) => (
                                                        <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-custom-orange/30 transition-colors">
                                                            <div className="flex justify-between mb-2">
                                                                <h3 className="text-custom-orange font-bold text-sm">Scene {idx + 1}</h3>
                                                            </div>
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Visuals</label>
                                                                    <textarea
                                                                        value={scene.primary_visuals}
                                                                        onChange={(e) => updateAnalyzedScene(idx, 'primary_visuals', e.target.value)}
                                                                        disabled={isGeneratingVideos}
                                                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-gray-300 focus:outline-none focus:border-custom-orange/50 transition-colors resize-none"
                                                                        rows={3}
                                                                    />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Objective</label>
                                                                        <input
                                                                            value={scene.scene_objective}
                                                                            onChange={(e) => updateAnalyzedScene(idx, 'scene_objective', e.target.value)}
                                                                            disabled={isGeneratingVideos}
                                                                            className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-gray-300 focus:outline-none focus:border-custom-orange/50"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Mood</label>
                                                                        <input
                                                                            value={scene.emotional_tone}
                                                                            onChange={(e) => updateAnalyzedScene(idx, 'emotional_tone', e.target.value)}
                                                                            disabled={isGeneratingVideos}
                                                                            className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-gray-300 focus:outline-none focus:border-custom-orange/50"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-6 flex justify-end">
                                                    <button
                                                        onClick={handleSceneConfirmation}
                                                        disabled={isGeneratingVideos}
                                                        className="px-6 py-3 bg-custom-orange hover:bg-orange-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isGeneratingVideos ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                        {isGeneratingVideos ? 'Generating...' : 'Confirm & Generate'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // Regular Message
                                            <div className={`p-4 rounded-2xl ${message.role === 'user'
                                                ? 'bg-custom-orange text-white rounded-tr-none'
                                                : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
                                                } `}>
                                                <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                                                    {message.role === 'assistant'
                                                        ? formatMessageContent(message.content)
                                                        : message.content
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {message.role === 'user' && (
                                        <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                                            <User className="w-4 h-4 text-white" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Loading Indicators */}
                        {chatLoading && (
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-lg bg-custom-orange flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 rounded-tl-none flex items-center gap-3">
                                    <Loader2 className="w-4 h-4 animate-spin text-custom-orange" />
                                    <span className="text-gray-400 text-sm">Thinking...</span>
                                </div>
                            </div>
                        )}

                        {/* Clarifying Questions */}
                        {currentState === 'awaiting_answers' && followUpQuestions.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="ml-12 bg-orange-900/10 border border-custom-orange/20 rounded-xl p-5">
                                <h3 className="text-custom-orange font-bold mb-3 flex items-center gap-2">
                                    <Bot className="w-4 h-4" /> Questions to refine your video:
                                </h3>
                                <ul className="space-y-2 mb-4">
                                    {followUpQuestions.map((q, i) => (
                                        <li key={i} className="text-sm text-gray-300 flex gap-2">
                                            <span className="text-custom-orange font-bold">{i + 1}.</span> {q}
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex justify-end">
                                    <button onClick={() => handleProceedToAnalysis("SKIP")} className="text-xs font-bold text-gray-500 hover:text-white transition-colors">
                                        SKIP QUESTIONS
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Duration Selection */}
                        {currentState === 'awaiting_duration' && (
                            <div className="ml-12 grid grid-cols-4 gap-3">
                                {[10, 20, 30, 60].map((duration) => (
                                    <button
                                        key={duration}
                                        onClick={() => handleDurationSelection(duration)}
                                        className={`py-3 rounded-xl border font-bold transition-all ${targetDuration === duration
                                            ? 'bg-custom-orange border-custom-orange text-white'
                                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:border-custom-orange/50 hover:text-white'
                                            } `}
                                    >
                                        {duration}s
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Video / Audio Results */}
                        {audioUrl && (
                            <div className="ml-12 mt-4 bg-[#0F0F0F] rounded-xl p-4 border border-white/10">
                                <div className="flex items-center gap-3 mb-3 text-custom-orange font-bold text-sm">
                                    <Volume2 className="w-4 h-4" /> Generated Narration
                                </div>
                                <audio src={audioUrl} controls className="w-full h-8" />
                            </div>
                        )}

                        {/* Status Display during generation */}
                        {videoStatus && (isGeneratingVideos || videoStatus.includes('Success') || videoStatus.includes('Complete')) && (
                            <div className="ml-12 mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                                {isGeneratingVideos ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <CheckCircle className="w-4 h-4 text-green-400" />}
                                <span className="text-blue-200 text-sm font-medium">{videoStatus}</span>
                            </div>
                        )}

                        {(videoUrls.length > 0 || storageVideos.length > 0) && (
                            <div className="mt-8">
                                <VideoPlayer
                                    videoUrls={videoUrls.length > 0 ? videoUrls : storageVideos}
                                    currentVideoIndex={currentVideoIndex}
                                    setCurrentVideoIndex={setCurrentVideoIndex}
                                    onStitchVideos={stitchStorageVideos}
                                    isStitching={isStitching || isStitchingStorage}
                                    stitchedVideoUrl={stitchedVideoUrl || storageStitchedUrl}
                                />
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Error Display */}
                {
                    (chatError || videoError || storageError) && (
                        <div className="p-4 bg-red-900/20 border-t border-red-500/30">
                            <div className="max-w-3xl mx-auto">
                                <div className="flex items-center gap-2 text-red-400 text-sm">
                                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                                    {chatError || videoError || storageError}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Input Area */}
                <div className="p-4 bg-transparent">
                    <div className="max-w-3xl mx-auto relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-2xl">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={
                                currentState === 'awaiting_story' ? "Describe your video idea or click SCRIPT to paste a script..." :
                                    currentState === 'awaiting_answers' ? "Answer the questions..." :
                                        "Type a message..."
                            }
                            className={`w-full bg-transparent text-white rounded-xl py-3 min-h-[50px] max-h-[120px] focus:outline-none resize-none placeholder:text-gray-500 scrollbar-thin scrollbar-thumb-white/10 pr-14 ${currentState === 'awaiting_story' ? 'pl-24' : 'pl-4'}`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />

                        {currentState === 'awaiting_story' && (
                            <button
                                onClick={() => setInputText('@Script ')}
                                className="absolute left-3 bottom-3 bg-custom-orange/20 text-custom-orange hover:bg-custom-orange hover:text-white border border-custom-orange/50 px-3 py-1.5 text-xs font-bold rounded-xl transition-all z-10"
                            >
                                SCRIPT
                            </button>
                        )}

                        <button
                            onClick={handleSendMessage}
                            disabled={!inputText.trim() || chatLoading}
                            className="absolute right-3 bottom-3 p-2 bg-custom-orange rounded-xl text-white hover:bg-orange-500 disabled:bg-white/5 disabled:text-gray-500 transition-all shadow-lg shadow-orange-900/20"
                        >
                            {chatLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                    {/* Footer */}
                    <div className="mt-2 text-center text-[10px] text-gray-500 font-medium">
                        OKVEVO can make mistakes. Consider checking important information.
                    </div>
                </div>

                <ChatHistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
            </div >
        </div >
    );
}

export default function ChatPage() {
    return (
        <StudioLayout>
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-custom-bg text-white">Loading...</div>}>
                <ChatPageContent />
            </Suspense>
        </StudioLayout>
    );
}
