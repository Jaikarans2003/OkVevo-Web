'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Film, Loader2, Send, RefreshCw, Bot, User, CheckCircle } from 'lucide-react';
import { useVideoGeneration } from '../hooks/useVideoGeneration';
import { useChatFlow } from '../hooks/useChatFlow';
import VideoPlayer from '../components/VideoPlayer';
import type { Scene, ChatMessage } from '../services/AIService';
import { fetchVideosFromStorage } from '../services/StorageService';
import { MODELS } from '../config/models';

export default function Brick2Brick() {
    const {
        analyzedScenes,
        videoUrls,
        error: videoError,
        setAnalyzedScenes,
        generateVideosFromScenes,
        resetAnalysis,
        updateAnalyzedScene
    } = useVideoGeneration();

    const {
        messages,
        currentState,
        loading: chatLoading,
        error: chatError,
        generatingVideos,
        processUserStory,
        handleEnhancementConfirmation,
        handleProceedConfirmation,
        resetConversation
    } = useChatFlow();

    const [inputText, setInputText] = useState('');
    const [guidanceScale,] = useState(MODELS['tunetales'].defaultGuidance);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [storageVideos, setStorageVideos] = useState<string[]>([]);
    const [loadingStorageVideos, setLoadingStorageVideos] = useState(false);
    const [storageError, setStorageError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const handleSendMessage = async () => {
        if (!inputText.trim() || chatLoading) return;

        const userMessage = inputText.trim();
        setInputText('');

        if (currentState === 'awaiting_enhancement_confirmation') {
            const scenes = await handleEnhancementConfirmation(userMessage);
            if (scenes) {
                setAnalyzedScenes(scenes);
            }
        } else if (currentState === 'awaiting_proceed_confirmation') {
            handleProceedConfirmation(userMessage);
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
            <div className="flex-shrink-0 p-4 bg-custom-bg">
                <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                        <div className="p-2 bg-custom-orange rounded-full shadow-lg shadow-custom-orange/50">
                            <Film className="w-8 h-8 text-custom-cream" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-custom-orange">
                        Brick2Brick
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
                            />
                        </div>
                    )}

                    {/* Storage Videos Section */}
                    {storageVideos.length > 0 && (
                        <div className="animate-in fade-in zoom-in duration-500 space-y-8 mt-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 text-custom-orange">
                                    <CheckCircle className="w-6 h-6" />
                                    <span className="font-bold text-xl text-custom-orange">
                                        Storage Videos Loaded
                                    </span>
                                </div>
                                <button
                                    onClick={() => setStorageVideos([])}
                                    className="text-sm text-custom-orange hover:text-orange-400 underline transition-colors"
                                >
                                    Clear Storage Videos
                                </button>
                            </div>

                            <VideoPlayer
                                videoUrls={storageVideos}
                                currentVideoIndex={currentVideoIndex}
                                setCurrentVideoIndex={setCurrentVideoIndex}
                            />
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
                                                currentState === 'awaiting_proceed_confirmation' ? 'Type "Proceed" to continue or provide feedback to regenerate scenes.' :
                                                    'Type your message...'
                                }
                                className="w-full h-20 bg-custom-bg text-custom-cream p-4 rounded-xl border-2 border-custom-orange/30 focus:border-custom-orange focus:outline-none resize-none placeholder-custom-cream/30 transition-all duration-300"
                                disabled={chatLoading || !['awaiting_story', 'awaiting_enhancement_confirmation', 'awaiting_proceed_confirmation'].includes(currentState)}
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
