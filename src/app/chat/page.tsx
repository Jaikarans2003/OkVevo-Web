"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Film, Loader2, Send, RefreshCw, Bot, User, CheckCircle, Volume2, Play } from 'lucide-react';
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
        regenerateNarration
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
        handleEnhancementConfirmation,
        handleProceedConfirmation,
        handleNarrationConfirmation,
        handleFinalConfirmation,
        setNarrationResult,
        setAudioUrl,
        setCurrentState,
        addAssistantMessage,
        resetConversation
    } = useChatFlow();

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
            console.log('🚀 Manually stitching storage videos:', storageVideos);

            const { stitchVideosWithLambda } = await import('../../services/LambdaStitchService');
            const result = await stitchVideosWithLambda({
                videoUrls: storageVideos.slice(0, 3), // First 3 videos
                sessionId: `storage-${Date.now()}`
            });

            if (result.success && result.videoUrl) {
                setStorageStitchedUrl(result.videoUrl);
                alert('✅ Storage videos stitched successfully!');
            } else {
                throw new Error(result.error || 'Stitching failed');
            }
        } catch (error) {
            console.error('Storage stitch error:', error);
            alert(`Stitching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsStitchingStorage(false);
        }
    };

    const handleGenerateVideos = useCallback(async () => {
        if (analyzedScenes) {
            await generateVideosFromScenes(analyzedScenes, guidanceScale);
        }
    }, [analyzedScenes, guidanceScale, generateVideosFromScenes]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (currentState === 'scenes_ready') {
            // Load videos from storage instead of generating new ones
            handleLoadStorageVideos();
        }
    }, [currentState]);

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
            const dispatchKey = `${storageVideos.slice(0, 3).join('|')}|${audioUrl}`;

            if (storageVideos.length >= 3 && audioUrl && currentState === 'scenes_ready' && !isStitchingStorage) {
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
                        storageVideos.slice(0, 3),
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

                                    const response = await fetch(
                                        'https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch-stitched'
                                    );

                                    if (!response.ok) continue;

                                    const data = await response.json();

                                    if (data.videos && data.videos.length > 0) {
                                        const matchingVideo = data.videos.find((video: { url: string }) =>
                                            video.url.includes(result.jobId!)
                                        );

                                        if (matchingVideo) {
                                            setStorageStitchedUrl(matchingVideo.url);
                                            setIsStitchingStorage(false);
                                            console.log('✅ Video with audio ready:', matchingVideo.url);
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
    }, [storageVideos, audioUrl, currentState]); // Removed isStitchingStorage from dependencies

    const handleSendMessage = async () => {
        if (!inputText.trim() || chatLoading) return;

        const userMessage = inputText.trim();
        setInputText('');

        // Handle different conversation states
        if (currentState === 'awaiting_story') {
            // User submitted their script - generate narration
            if (userMessage.toLowerCase().startsWith('@script')) {
                const storyContent = userMessage.substring('@script'.length).trim();

                addAssistantMessage(`Received your script! Generating AI narration...`);
                setCurrentState('generating_narration');

                try {
                    const { narrationService } = await import('../../services/NarrationService');
                    const result = await narrationService.generateDirectNarration(storyContent);
                    setNarrationResult(result);

                    // Internal scenes are already in Scene format
                    setAnalyzedScenes(result.internalScenes);

                    // Show the narration text
                    addAssistantMessage(
                        `📝 **Generated Narration:**\n\n"${result.narration.fullNarration}"\n\n---\n\nNow review the 3 cinematic scenes below. You can edit them if needed.`
                    );

                    // Trigger Scene Reviewer to display
                    addAssistantMessage('Scene Review', 'scene_review');

                    setCurrentState('awaiting_narration_confirmation');
                } catch (error) {
                    console.error('Narration generation failed:', error);
                    addAssistantMessage('Failed to generate narration. Please try again.');
                    setCurrentState('awaiting_story');
                }
            } else {
                addAssistantMessage("Please use the '@Script' format to submit your story.");
            }
        } else if (currentState === 'awaiting_narration_confirmation') {
            // User reviewed narration
            handleNarrationConfirmation(userMessage);
        } else if (currentState === 'awaiting_final_confirmation') {
            // User reviewed audio - proceed to video generation
            handleFinalConfirmation(userMessage);
        } else if (currentState === 'awaiting_enhancement_confirmation') {
            const scenes = await handleEnhancementConfirmation(userMessage);
            if (scenes) {
                setAnalyzedScenes(scenes);
            }
        } else if (currentState === 'awaiting_proceed_confirmation') {
            // OLD FLOW - Fetch videos and dispatch with audio
            const cleanedResponse = userMessage.toLowerCase().trim().replace(/[.,!?;:]/g, '');

            if (cleanedResponse === 'proceed' || cleanedResponse === 'yes' || cleanedResponse === 'continue') {
                console.log('✅ User confirmed PROCEED. Dispatching to SQS...');

                try {
                    setLoadingStorageVideos(true);
                    setStorageError(null);

                    const urls = await fetchVideosFromStorage();

                    if (urls.length < 3) {
                        throw new Error('Need at least 3 videos in storage');
                    }

                    setStorageVideos(urls);
                    console.log('📦 Fetched videos from storage:', urls);

                    // Dispatch to SQS with audio URL
                    setIsStitchingStorage(true);
                    const { dispatchStitchingJob } = await import('../../services/SQSStitchService');

                    console.log('🚀 Dispatching to SQS with audio:', audioUrl);
                    const result = await dispatchStitchingJob(
                        urls.slice(0, 3),
                        audioUrl || undefined  // Pass audio URL if available
                    );

                    if (result.success) {
                        console.log('✅ Dispatched to SQS:', result);

                        const jobId = result.jobId;

                        if (!jobId) {
                            console.error('❌ No jobId returned from SQS dispatch');
                            alert('Error: No job ID received. Cannot track stitching progress.');
                            setIsStitchingStorage(false);
                            return;
                        }

                        // Start polling
                        const pollForStitchedVideo = async () => {
                            const maxAttempts = 24;

                            for (let i = 0; i < maxAttempts; i++) {
                                await new Promise(resolve => setTimeout(resolve, 5000));

                                try {
                                    console.log(`🔍 Polling attempt ${i + 1}/${maxAttempts} for jobId: ${jobId}...`);

                                    const response = await fetch(
                                        'https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch-stitched'
                                    );

                                    if (!response.ok) {
                                        console.warn('Failed to fetch stitched videos:', response.statusText);
                                        continue;
                                    }

                                    const data = await response.json();

                                    if (data.videos && data.videos.length > 0) {
                                        const matchingVideo = data.videos.find((video: { url: string }) =>
                                            video.url.includes(jobId)
                                        );

                                        if (matchingVideo) {
                                            setStorageStitchedUrl(matchingVideo.url);
                                            setIsStitchingStorage(false);
                                            console.log('✅ Found stitched video:', matchingVideo.url);
                                            alert('🎉 Video stitched successfully with narration!');
                                            return;
                                        } else {
                                            console.log(`⏳ Video not found yet (${i + 1}/${maxAttempts})...`);
                                        }
                                    }
                                } catch (err) {
                                    console.error('Polling error:', err);
                                }
                            }

                            console.log('⏱️ Polling timeout.');
                            alert('Stitching is taking longer than expected. Check Firebase Storage later.');
                            setIsStitchingStorage(false);
                        };

                        pollForStitchedVideo();

                    } else {
                        throw new Error(result.error || 'SQS dispatch failed');
                    }

                } catch (error) {
                    console.error('Error in SQS dispatch flow:', error);
                    setStorageError(error instanceof Error ? error.message : 'Failed to dispatch');
                    setIsStitchingStorage(false);
                } finally {
                    setLoadingStorageVideos(false);
                }
            }

            await handleProceedConfirmation(userMessage);
        } else {
            await processUserStory(userMessage);
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
            {/* Header */}
            <div className="flex-shrink-0 p-4 bg-custom-bg relative">
                <div className="absolute top-4 right-4 z-10">
                    <a href="/profile" className="p-2 bg-custom-cream/10 rounded-full text-custom-orange hover:bg-custom-orange hover:text-custom-cream transition-all duration-300 block">
                        <User className="w-5 h-5" />
                    </a>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                        <div className="p-2 bg-custom-orange rounded-full shadow-lg shadow-custom-orange/50">
                            <Film className="w-8 h-8 text-custom-cream" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-custom-orange">
                        AIVOZO
                    </h1>
                    <p className="text-custom-cream/70 text-sm">Transform your words into motion</p>
                </div>
            </div>

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
                                onStitchVideos={stitchVideosWithAWSLambda}
                                isStitching={isStitching}
                                stitchedVideoUrl={stitchedVideoUrl}
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
                                            currentState === 'awaiting_enhancement_confirmation' ? 'Your response (yes/no)...' :
                                                currentState === 'awaiting_proceed_confirmation' ? 'Type "proceed" to dispatch stitching job to queue...' :
                                                    'Type your message...'
                                }
                                className="w-full h-20 bg-custom-bg text-custom-cream p-4 rounded-xl border-2 border-custom-orange/30 focus:border-custom-orange focus:outline-none resize-none placeholder-custom-cream/30 transition-all duration-300"
                                disabled={chatLoading || !['awaiting_story', 'awaiting_enhancement_confirmation', 'awaiting_narration_confirmation', 'awaiting_final_confirmation', 'awaiting_proceed_confirmation'].includes(currentState)}
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
