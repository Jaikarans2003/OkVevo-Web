"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Film, Loader2, Send, RefreshCw, Bot, User, CheckCircle, Volume2, Play, MessageSquare, History } from 'lucide-react';
import { useVideoGeneration } from '../../hooks/useVideoGeneration';
import { useChatFlow } from '../../hooks/useChatFlow';
import VideoPlayer from '../../components/VideoPlayer';
import type { Scene, ChatMessage } from '../../services/AIService';
import { fetchVideosFromStorage } from '../../services/StorageService';
import { MODELS } from '../../config/models';


export default function Brick2Brick() {
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
        setVideoUrls
    } = useVideoGeneration();

    const {
        messages,
        currentState,
        loading: chatLoading,
        error: chatError,
        generatingVideos,
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
        followUpQuestions
    } = useChatFlow({
        onScenesGenerated: setAnalyzedScenes
    });

    const [inputText, setInputText] = useState('');
    const [guidanceScale,] = useState(MODELS['tunetales'].defaultGuidance);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [storageVideos, setStorageVideos] = useState<string[]>([]);
    const [loadingStorageVideos, setLoadingStorageVideos] = useState(false);
    const [storageError, setStorageError] = useState<string | null>(null);
    const [isStitchingStorage, setIsStitchingStorage] = useState(false);
    const [storageStitchedUrl, setStorageStitchedUrl] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const dispatchedJobRef = useRef<string | null>(null); // Track dispatched jobs to prevent duplicates

    // Manual stitch function for storage videos
    const stitchStorageVideos = async () => {
        if (storageVideos.length < 3) {
            alert('Need at least 3 videos to stitch!');
            return;
        }

        setIsStitchingStorage(true);
        setStorageStitchedUrl(null);

        try {
            console.log('🚀 Manually stitching storage videos (SQS):', storageVideos);

            // Use SQS Service instead of direct Lambda
            const { dispatchStitchingJob } = await import('../../services/SQSStitchService');

            // Pass audioUrl if available, otherwise undefined
            const result = await dispatchStitchingJob(
                storageVideos.slice(0, 3),
                audioUrl || undefined
            );

            if (result.success && result.jobId) {
                console.log('✅ Dispatched to SQS:', result.jobId);

                // Polling logic for SQS result
                const pollForStitchedVideo = async () => {
                    const maxAttempts = 24; // 2 mins

                    for (let i = 0; i < maxAttempts; i++) {
                        await new Promise(resolve => setTimeout(resolve, 5000));

                        try {
                            // Use client-side storage fetch
                            const { fetchStitchedVideos } = await import('../../services/StorageService');
                            const videos = await fetchStitchedVideos();

                            if (videos && videos.length > 0) {
                                const matchingVideo = videos.find(url => url.includes(result.jobId!));

                                if (matchingVideo) {
                                    setStorageStitchedUrl(matchingVideo);
                                    setIsStitchingStorage(false);
                                    console.log('✅ Video ready:', matchingVideo);
                                    return;
                                }
                            }
                        } catch (err) {
                            console.error('Polling error:', err);
                        }
                    }

                    console.log('⏱️ Polling timeout');
                    setIsStitchingStorage(false);
                    alert("Stitching is taking longer than expected. Check the 'Stitched Videos' section in a few minutes.");
                };

                pollForStitchedVideo();

            } else {
                throw new Error(result.error || 'SQS dispatch failed');
            }
        } catch (error) {
            console.error('Storage stitch error:', error);
            alert(`Stitching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsStitchingStorage(false);
        }
    };

    const handleGenerateVideos = useCallback(async () => {
        if (analyzedScenes && currentState === 'generating_final_assets') {
            try {
                addAssistantMessage("⚠️ Using pre-stored videos from storage (Demo Mode)...");

                // 1. Fetch from Storage instead of Replicate
                const urls = await fetchVideosFromStorage();
                const selectedUrls = urls.slice(0, 3);

                if (selectedUrls.length < 3) {
                    addAssistantMessage("Not enough videos in storage! Need at least 3.");
                    return;
                }

                setVideoUrls(selectedUrls);
                setStorageVideos(selectedUrls); // Ensure local state is also set for SQS trigger

                // 2. Generate Narration (if missing)
                if (!narrationResult) {
                    try {
                        const { narrationService } = await import('../../services/NarrationService');
                        const combinedScript = analyzedScenes.map(s => s.primary_visuals).join('\n');
                        const result = await narrationService.generateNarrationFromScenes(analyzedScenes, combinedScript);
                        setNarrationResult({ narration: result, internalScenes: analyzedScenes });
                    } catch (narrationError) {
                        console.warn("⚠️ AI Narration generation failed (likely quota). Using fallback.", narrationError);
                        addAssistantMessage("⚠️ AI Narration limit reached. Using scene descriptions as narration.");

                        // Fallback: Use scene visuals as narration script
                        const fallbackScript = {
                            fullNarration: analyzedScenes.map(s => s.primary_visuals).join('. '),
                            estimatedDuration: targetDuration || 20,
                            sceneDurations: analyzedScenes.map(() => (targetDuration || 20) / analyzedScenes.length),
                            segments: [] // Empty segments for fallback
                        };

                        setNarrationResult({ narration: fallbackScript, internalScenes: analyzedScenes });
                    }
                }

                // 3. Move to Audio Generation
                setCurrentState('generating_audio');

            } catch (e) {
                console.error("Generation failed:", e);
                addAssistantMessage("Something went wrong. Please try again.");
            }
        }
    }, [analyzedScenes, currentState, narrationResult, setVideoUrls, setCurrentState, setNarrationResult, addAssistantMessage]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (currentState === 'scenes_ready') {
            // Load videos from storage instead of generating new ones
            handleLoadStorageVideos();
        }
    }, [currentState]);

    useEffect(() => {
        if (currentState === 'generating_final_assets') {
            // Trigger video generation
            handleGenerateVideos();
        }
    }, [currentState, handleGenerateVideos]);

    // Handle audio generation when state changes to generating_audio
    useEffect(() => {
        const handleAudioGeneration = async () => {
            if (currentState === 'generating_audio' && narrationResult) {
                addAssistantMessage('🎵 Generating audio narration...');

                try {
                    const { ttsService } = await import('../../services/TTSService');
                    const sessionId = 'session-' + Date.now();
                    const generatedAudioUrl = await ttsService.generateNarrationAudio(
                        narrationResult.narration.fullNarration,
                        sessionId
                    );

                    setAudioUrl(generatedAudioUrl);
                    addAssistantMessage(
                        `🔊 Audio generated! You can listen to the preview below.\n\nType 'proceed' to create your video!`
                    );
                    setCurrentState('awaiting_final_confirmation');
                } catch (error) {
                    console.error('Audio generation failed:', error);
                    addAssistantMessage('Failed to generate audio. Please try again.');
                    setCurrentState('awaiting_narration_confirmation');
                }
            }
        };

        handleAudioGeneration();
    }, [currentState, narrationResult]);

    // Handle SQS dispatch when videos are loaded and audio is ready
    useEffect(() => {
        const dispatchSQS = async () => {
            // Create unique key for this dispatch
            const dispatchKey = `${videoUrls.slice(0, 3).join('|')}|${audioUrl}`;

            // We use videoUrls (from hook) or storageVideos (local). In demo mode we set BOTH.
            // But let's check videoUrls first as that's what handleGenerateVideos sets.
            // Actually, let's use the explicit local state for SQS logic if possible, or just check length.
            const validVideos = videoUrls.length >= 3 ? videoUrls : storageVideos;

            if (validVideos.length >= 3 && audioUrl && currentState === 'awaiting_final_confirmation' && !isStitchingStorage) {
                // Prevent duplicate dispatches
                if (dispatchedJobRef.current === dispatchKey) {
                    console.log('⏭️ Skipping duplicate dispatch');
                    return;
                }

                console.log('🚀 Auto-dispatching to SQS with audio:', audioUrl.substring(0, 50) + '...');
                setIsStitchingStorage(true);
                dispatchedJobRef.current = dispatchKey;

                try {
                    const { dispatchStitchingJob } = await import('../../services/SQSStitchService');

                    const result = await dispatchStitchingJob(
                        validVideos.slice(0, 3),
                        audioUrl
                    );

                    if (result.success && result.jobId) {
                        console.log('✅ Dispatched to SQS with audio:', result.jobId);

                        // Start polling for stitched video
                        const pollForStitchedVideo = async () => {
                            const maxAttempts = 24;

                            for (let i = 0; i < maxAttempts; i++) {
                                await new Promise(resolve => setTimeout(resolve, 5000));

                                try {
                                    console.log(`🔍 Polling ${i + 1}/${maxAttempts} for jobId: ${result.jobId}...`);

                                    // Use client-side storage fetch to avoid CORS/404
                                    const { fetchStitchedVideos } = await import('../../services/StorageService');
                                    const videos = await fetchStitchedVideos();

                                    if (videos && videos.length > 0) {
                                        const matchingVideo = videos.find(url => url.includes(result.jobId!));

                                        if (matchingVideo) {
                                            setStorageStitchedUrl(matchingVideo);
                                            setIsStitchingStorage(false);
                                            console.log('✅ Video with audio ready:', matchingVideo);
                                            return;
                                        }
                                    }
                                } catch (err) {
                                    console.error('Polling error:', err);
                                }
                            }

                            console.log('⏱️ Polling timeout');
                            setIsStitchingStorage(false);
                        };

                        pollForStitchedVideo();
                    } else {
                        throw new Error(result.error || 'SQS dispatch failed');
                    }
                } catch (error) {
                    console.error('SQS dispatch error:', error);
                    setStorageError(error instanceof Error ? error.message : 'Failed to dispatch');
                    setIsStitchingStorage(false);
                    dispatchedJobRef.current = null; // Reset on error
                }
            }
        };

        dispatchSQS();
    }, [videoUrls, storageVideos, audioUrl, currentState, isStitchingStorage]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || chatLoading) return;

        const userMessage = inputText.trim();
        setInputText('');

        // Handle different conversation states
        if (currentState === 'awaiting_story') {
            await processUserStory(userMessage);
        } else if (currentState === 'awaiting_answers') {
            await handleProceedToAnalysis(userMessage); // Submit answers
        } else if (currentState === 'awaiting_duration') {
            const duration = parseInt(userMessage.replace(/[^0-9]/g, ''));
            if ([10, 20, 30, 60].includes(duration)) {
                handleDurationSelection(duration);
            } else {
                // addAssistantMessage is from hook, can we use it? 
                // The hook exposes addAssistantMessage.
                addAssistantMessage("Please select a valid duration: 10, 20, 30, or 60 seconds.");
            }
        } else if (currentState === 'scene_review') {
            const lowerMsg = userMessage.toLowerCase();
            if (lowerMsg.includes('proceed') || lowerMsg.includes('yes') || lowerMsg.includes('good') || lowerMsg.includes('confirm')) {
                handleSceneConfirmation();
            } else {
                addAssistantMessage("I've made the scenes editable above! Please make your changes directly in the cards and click 'Looks Good - Generate Video' when you're ready.");
            }
        } else {
            // Fallback: If user types during other states, just add to chat or ignore
            // For now, if strictly in valid state, maybe add as user message? 
            // But hooks handle adding messages.
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
            setStorageError(error instanceof Error ? error.message : 'Failed to load videos');
        } finally {
            setLoadingStorageVideos(false);
        }
    };

    const formatMessageContent = (content: string) => {
        return content.split('\n').map((line, index) => {
            if (line.startsWith('✨') || line.startsWith('🎬') || line.startsWith('🎵') || line.startsWith('🎥')) {
                return (
                    <div key={index} className="flex items-start gap-2 mb-3">
                        <span className="text-lg">{line.substring(0, 2)}</span>
                        <span className="font-semibold text-orange-brand-300">{line.substring(2).split(':')[0]}:</span>
                        <span className="text-gray-brand-200">{line.substring(2).split(':')[1]}</span>
                    </div>
                );
            }
            if (line.startsWith('•')) {
                return (
                    <div key={index} className="ml-4 text-gray-brand-300 mb-1">
                        {line}
                    </div>
                );
            }
            if (line.trim() === '') {
                return <div key={index} className="h-2" />;
            }
            return (
                <div key={index} className="text-gray-brand-200 leading-relaxed">
                    {line}
                </div>
            );
        });
    };

    return (
        <div className="h-screen bg-custom-bg text-custom-cream flex flex-col">
            {/* Left Sidebar - Chats */}
            <aside className="fixed left-6 top-1/2 transform -translate-y-1/2 z-50">
                <div className="bg-custom-bg/80 backdrop-blur-md border border-custom-orange/20 rounded-3xl p-4 flex flex-col items-center gap-6 shadow-2xl shadow-custom-orange/10">
                    {/* Chats Title */}
                    <div className="flex flex-col items-center gap-2">
                        {/* Replaced MessageSquare with History */}
                        <History className="w-6 h-6 text-custom-orange" />
                        <span className="text-xs font-bold text-custom-orange tracking-wider">GENERATIONS</span>
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-custom-orange/20"></div>

                    {/* New Chat Button */}
                    <button
                        onClick={resetConversation}
                        className="p-3 bg-custom-orange/10 rounded-2xl hover:bg-custom-orange/20 transition-all duration-300 group"
                        title="New Chat"
                    >
                        <RefreshCw className="w-5 h-5 text-custom-cream group-hover:scale-110 group-hover:rotate-180 transition-all duration-300" />
                    </button>
                </div>
            </aside>

            {/* Right Sidebar - Profile & Logo */}
            <aside className="fixed right-6 top-1/2 transform -translate-y-1/2 z-50">
                <div className="bg-custom-bg/80 backdrop-blur-md border border-custom-orange/20 rounded-3xl p-4 flex flex-col items-center gap-6 shadow-2xl shadow-custom-orange/10">
                    {/* Logo */}
                    <Link href="/chat" className="group">
                        <div className="p-3 bg-custom-orange/10 rounded-2xl hover:bg-custom-orange/20 transition-all duration-300">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/White.svg"
                                alt="OKVEVO Logo"
                                width={32}
                                height={32}
                                className="w-8 h-8 group-hover:scale-110 transition-transform"
                            />
                        </div>
                    </Link>

                    {/* Divider */}
                    <div className="w-full h-px bg-custom-orange/20"></div>

                    {/* Profile Button */}
                    <Link
                        href="/profile"
                        className="p-3 bg-custom-orange rounded-2xl hover:bg-orange-600 transition-all duration-300 group"
                        title="Profile"
                    >
                        <User className="w-5 h-5 text-custom-cream group-hover:scale-110 transition-transform" />
                    </Link>
                </div>
            </aside>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto space-y-6">
                    {messages.map((message: ChatMessage, index: number) => (
                        <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {message.role === 'assistant' && (
                                <div className="w-8 h-8 bg-custom-orange rounded-full flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-custom-cream" />
                                </div>
                            )}

                            <div className={`max-w-3xl ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
                                {message.type === 'scene_review' && analyzedScenes ? (
                                    // Render Scene Reviewer inline
                                    <div className="bg-custom-cream/5 border border-custom-orange/30 rounded-2xl p-4 mr-12">
                                        <div className="space-y-6">
                                            <h2 className="text-2xl font-bold text-custom-orange">
                                                Scene Review
                                            </h2>

                                            <div className="grid gap-4">
                                                {analyzedScenes?.map((scene: Scene, idx: number) => (
                                                    <div key={idx} className={`bg-custom-bg border border-custom-orange/30 rounded-xl p-4 transition-all duration-300 ${generatingVideos ? 'opacity-75' : 'hover:border-custom-orange'
                                                        }`}>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h3 className="font-bold text-lg text-custom-orange">Scene {idx + 1}</h3>
                                                        </div>

                                                        <div className="space-y-4 text-sm">
                                                            <div>
                                                                <label className="text-custom-cream block mb-2 font-semibold flex items-center gap-2">
                                                                    Visuals
                                                                    <span className="text-xs text-custom-orange font-normal">(AI Suggested)</span>
                                                                </label>
                                                                <textarea
                                                                    value={scene.primary_visuals}
                                                                    onChange={(e) => updateAnalyzedScene(idx, 'primary_visuals', e.target.value)}
                                                                    readOnly={generatingVideos}
                                                                    className={`w-full bg-custom-bg text-custom-cream p-3 rounded-lg border border-custom-orange/30 resize-none transition-all duration-300 ${generatingVideos
                                                                        ? 'cursor-not-allowed opacity-60'
                                                                        : 'focus:border-custom-orange focus:outline-none'
                                                                        }`}
                                                                    rows={3}
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="text-custom-cream block mb-2 font-semibold">Objective</label>
                                                                <input
                                                                    type="text"
                                                                    value={scene.scene_objective}
                                                                    onChange={(e) => updateAnalyzedScene(idx, 'scene_objective', e.target.value)}
                                                                    readOnly={generatingVideos}
                                                                    className={`w-full bg-custom-bg text-custom-cream p-2 rounded-lg border border-custom-orange/30 transition-all duration-300 ${generatingVideos
                                                                        ? 'cursor-not-allowed opacity-60'
                                                                        : 'focus:border-custom-orange focus:outline-none'
                                                                        }`}
                                                                />
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-custom-cream block mb-2 font-semibold">Mood / Tone</label>
                                                                    <input
                                                                        type="text"
                                                                        value={scene.emotional_tone}
                                                                        onChange={(e) => updateAnalyzedScene(idx, 'emotional_tone', e.target.value)}
                                                                        readOnly={generatingVideos}
                                                                        className={`w-full bg-custom-bg text-custom-cream p-2 rounded-lg border border-custom-orange/30 transition-all duration-300 ${generatingVideos
                                                                            ? 'cursor-not-allowed opacity-60'
                                                                            : 'focus:border-custom-orange focus:outline-none'
                                                                            }`}
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <strong className="text-custom-cream block mb-2">Transition:</strong>
                                                                    <span className="text-custom-cream/70 italic block py-2 bg-custom-bg p-2 rounded-lg border border-custom-orange/30 text-xs">{scene.transition_logic}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Regular message rendering
                                    <div className={`rounded-2xl p-4 ${message.role === 'user'
                                        ? 'bg-custom-orange text-custom-cream ml-12'
                                        : 'bg-custom-cream/5 border border-custom-orange/30 mr-12'
                                        }`}>
                                        <div className="text-sm leading-relaxed">
                                            {formatMessageContent(message.content)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {message.role === 'user' && (
                                <div className="w-8 h-8 bg-custom-cream/20 rounded-full flex items-center justify-center flex-shrink-0 order-2">
                                    <User className="w-4 h-4 text-custom-cream" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Clarifying Questions UI */}
                    {currentState === 'awaiting_answers' && followUpQuestions.length > 0 && (
                        <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-5 duration-500">
                            <div className="w-8 h-8 bg-custom-orange rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-custom-cream" />
                            </div>
                            <div className="max-w-3xl w-full">
                                <div className="bg-custom-cream/5 border border-custom-orange/30 rounded-2xl p-6 mr-12">
                                    <h3 className="text-custom-orange font-bold mb-4">Clarifying Questions</h3>
                                    <ul className="space-y-3 mb-6">
                                        {followUpQuestions.map((q, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-custom-cream/90">
                                                <span className="text-custom-orange font-bold">{i + 1}.</span>
                                                {q}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleProceedToAnalysis("SKIP")}
                                            className="px-4 py-2 bg-custom-orange hover:bg-orange-600 text-white text-sm font-bold rounded-lg transition-colors"
                                        >
                                            SKIP
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Duration Selection UI */}
                    {currentState === 'awaiting_duration' && (
                        <div className="flex gap-3 justify-start animate-in fade-in slide-in-from-bottom-5 duration-500">
                            <div className="w-8 h-8 bg-custom-orange rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-custom-cream" />
                            </div>
                            <div className="max-w-3xl w-full">
                                <div className="bg-custom-cream/5 border border-custom-orange/30 rounded-2xl p-6 mr-12">
                                    <h3 className="text-custom-orange font-bold mb-4">Select Video Duration</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {[10, 20, 30, 60].map((duration) => (
                                            <button
                                                key={duration}
                                                onClick={() => handleDurationSelection(duration)}
                                                className={`px-6 py-3 rounded-xl border-2 font-bold transition-all duration-300 ${targetDuration === duration
                                                    ? 'bg-custom-orange border-custom-orange text-custom-cream'
                                                    : 'border-custom-orange/30 text-custom-cream hover:border-custom-orange hover:bg-custom-orange/10'
                                                    }`}
                                            >
                                                {duration} Seconds
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {chatLoading && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-custom-orange" />
                            <p className="ml-4 text-lg text-custom-cream">Analyzing your story...</p>
                        </div>
                    )}


                    {/* Loader after Proceed */}
                    {generatingVideos && videoUrls.length === 0 && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-8 h-8 bg-custom-orange rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-custom-cream" />
                            </div>

                            <div className="max-w-3xl order-2">
                                <div className="bg-custom-cream/5 border border-custom-orange/30 rounded-2xl p-4 mr-12">
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin text-custom-orange" />
                                        <p className="text-sm text-custom-cream">Generating videos from your scenes...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Audio Player */}
                    {audioUrl && (
                        <div className="animate-in fade-in zoom-in duration-500 mt-6">
                            <div className="flex gap-3 justify-start">
                                <div className="w-8 h-8 bg-custom-orange rounded-full flex items-center justify-center flex-shrink-0">
                                    <Volume2 className="w-4 h-4 text-custom-cream" />
                                </div>

                                <div className="max-w-3xl w-full">
                                    <div className="bg-gradient-to-r from-custom-orange/10 to-custom-cream/5 border border-custom-orange rounded-2xl p-6">
                                        <h3 className="text-lg font-bold text-custom-orange mb-4 flex items-center gap-2">
                                            <Play className="w-5 h-5" />
                                            Generated Narration Audio
                                        </h3>
                                        <audio
                                            src={audioUrl}
                                            controls
                                            className="w-full"
                                            style={{
                                                filter: 'sepia(20%) saturate(200%) hue-rotate(350deg)',
                                            }}
                                        />
                                        <p className="text-xs text-custom-cream/60 mt-3">
                                            Listen to the AI-generated narration. Type 'proceed' to create your video!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Video Player */}
                    {videoUrls.length > 0 && (
                        <div className="animate-in fade-in zoom-in duration-500 space-y-8 mt-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-custom-orange">
                                    <CheckCircle className="w-6 h-6" />
                                    <span className="font-bold text-xl text-custom-orange">
                                        Video Generation Complete
                                    </span>
                                </div>
                                <button
                                    onClick={resetAnalysis}
                                    className="text-sm text-custom-orange hover:text-orange-400 underline transition-colors"
                                >
                                    Create New Video
                                </button>
                            </div>

                            <VideoPlayer
                                videoUrls={videoUrls}
                                currentVideoIndex={currentVideoIndex}
                                setCurrentVideoIndex={setCurrentVideoIndex}
                                onStitchVideos={stitchStorageVideos}
                                isStitching={isStitching || isStitchingStorage} // Share loading state
                                stitchedVideoUrl={stitchedVideoUrl || storageStitchedUrl} // Share result
                            />
                        </div>
                    )}

                    {/* Storage Videos Section */}
                    {(storageVideos.length > 0 || storageStitchedUrl || isStitchingStorage) && (
                        <div className="animate-in fade-in zoom-in duration-500 space-y-8 mt-8">
                            {/* Show stitching progress */}
                            {isStitchingStorage && !storageStitchedUrl && (
                                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                                    <Loader2 className="w-16 h-16 text-custom-orange animate-spin" />
                                    <h2 className="text-2xl font-bold text-custom-cream">Stitching Your Video...</h2>
                                    <p className="text-custom-cream/70">Please wait while we create your masterpiece (1-2 minutes)</p>
                                </div>
                            )}

                            {/* Show only stitched video when ready */}
                            {storageStitchedUrl && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-custom-orange">
                                            <CheckCircle className="w-6 h-6" />
                                            <span className="font-bold text-xl text-custom-orange">
                                                ✅ Final Video Ready!
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setStorageVideos([]);
                                                setStorageStitchedUrl(null);
                                            }}
                                            className="text-sm text-custom-orange hover:text-orange-400 underline transition-colors"
                                        >
                                            Create New Video
                                        </button>
                                    </div>

                                    {/* Stitched Video Player */}
                                    <div className="relative rounded-lg overflow-hidden bg-black">
                                        <video
                                            src={storageStitchedUrl}
                                            controls
                                            className="w-full aspect-video"
                                            autoPlay
                                        >
                                            Your browser does not support video playback.
                                        </video>
                                    </div>

                                    {/* Download Button */}
                                    <div className="flex justify-center">
                                        <a
                                            href={storageStitchedUrl}
                                            download="stitched-video.mp4"
                                            className="px-6 py-3 bg-custom-orange hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                                        >
                                            <Film className="w-5 h-5" />
                                            Download Final Video
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Show individual videos only if NOT stitching and NO stitched result */}
                            {!isStitchingStorage && !storageStitchedUrl && storageVideos.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-custom-orange">
                                            <CheckCircle className="w-6 h-6" />
                                            <span className="font-bold text-xl text-custom-orange">
                                                Storage Videos Loaded ({storageVideos.length})
                                            </span>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={stitchStorageVideos}
                                                disabled={storageVideos.length < 3}
                                                className="px-4 py-2 bg-custom-orange hover:bg-orange-600 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                                            >
                                                <Film className="w-4 h-4" />
                                                Stitch Videos
                                            </button>
                                            <button
                                                onClick={() => setStorageVideos([])}
                                                className="text-sm text-custom-orange hover:text-orange-400 underline transition-colors"
                                            >
                                                Clear Storage Videos
                                            </button>
                                        </div>
                                    </div>

                                    <VideoPlayer
                                        videoUrls={storageVideos}
                                        currentVideoIndex={currentVideoIndex}
                                        setCurrentVideoIndex={setCurrentVideoIndex}
                                        isStitching={false}
                                        stitchedVideoUrl={null}
                                    />
                                </>
                            )}
                        </div>
                    )}


                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Error Display */}
            {(chatError || videoError || storageError) && (
                <div className="p-4 bg-custom-orange/10 border-t border-custom-orange">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center gap-2 text-custom-orange">
                            <div className="w-2 h-2 bg-custom-orange rounded-full animate-pulse"></div>
                            {chatError || videoError || storageError}
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="flex-shrink-0 p-4 bg-custom-bg">
                <div className="max-w-4xl mx-auto">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            {currentState === 'awaiting_story' && (
                                <button
                                    onClick={() => setInputText('@Script ')}
                                    className="absolute bottom-3 left-3 bg-custom-orange text-custom-cream px-3 py-1 text-xs font-bold rounded hover:bg-orange-600 transition-colors z-10"
                                >
                                    SCRIPT
                                </button>
                            )}
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={
                                    currentState === 'greeting' ? 'Loading...' :
                                        currentState === 'awaiting_story' ? 'Click SCRIPT and share your story or video idea...' :
                                            currentState === 'awaiting_answers' ? 'Type your answers here...' :
                                                currentState === 'awaiting_duration' ? 'Select duration above or type (10, 20, 30, 60)...' :
                                                    'Type your message...'
                                }
                                className="w-full h-20 bg-custom-bg text-custom-cream p-4 rounded-xl border-2 border-custom-orange/30 focus:border-custom-orange focus:outline-none resize-none placeholder-custom-cream/30 transition-all duration-300"
                                disabled={chatLoading || !['awaiting_story', 'awaiting_answers', 'awaiting_duration', 'scene_review'].includes(currentState)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!inputText.trim() || chatLoading}
                                className="absolute bottom-3 right-3 bg-custom-orange p-2 rounded-lg text-custom-cream disabled:bg-custom-cream/10 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 active:scale-95"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-center mt-3">
                        <button
                            onClick={resetConversation}
                            className="text-xs text-custom-orange hover:text-orange-400 transition-colors flex items-center gap-1"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Start New Conversation
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
