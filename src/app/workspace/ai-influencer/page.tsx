'use client';

import { useEffect, useState, useRef } from 'react';
import { auth, storage, db } from '../../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import StudioNavbar from '@/components/workspace/StudioNavbar';
import { useTheme } from '../../../contexts/ThemeContext';
import { FileText, Move3d, MonitorPlay, Loader2, Send, Sparkles, Clock, Upload, UserCircle2, Users, Video, Volume2, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateJobId } from '../../../services/AIInfluencerService';

export default function AIInfluencerPage() {
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'explainers' | 'motion-control'>('explainers');
    const [isGenerating, setIsGenerating] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatStep, setChatStep] = useState<'greeting' | 'topic' | 'duration' | 'avatar-video' | 'generating-script' | 'edit-script' | 'gender' | 'generating-tts' | 'preview-audio' | 'generating-lipsync' | 'complete'>('greeting');
    const [topicInput, setTopicInput] = useState('');
    const [selectedDuration, setSelectedDuration] = useState<number>(0);
    const [avatarVideo, setAvatarVideo] = useState<File | null>(null);
    const [avatarVideoUrl, setAvatarVideoUrl] = useState<string | null>(null);
    const [generatedScript, setGeneratedScript] = useState('');
    const [editableScript, setEditableScript] = useState('');
    const [selectedGender, setSelectedGender] = useState<'male' | 'female' | ''>('');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hi! I\'m your AI Explainer Assistant. Let\'s create a professional explainer video together. First, please share your script or describe the topic you\'d like explained.' }
    ]);
    const router = useRouter();
    const { resolvedTheme } = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        
        const userMessage = chatInput.trim();
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setTopicInput(userMessage);
        setChatInput('');
        setIsGenerating(true);
        
        setTimeout(() => {
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: 'Great! Now, what duration would you like for your explainer video?',
            }]);
            setChatStep('duration');
            setIsGenerating(false);
        }, 800);
    };

    const handleDurationSelect = (duration: number) => {
        setSelectedDuration(duration);
        setChatMessages(prev => [...prev, { role: 'user', content: `${duration} seconds` }]);
        setIsGenerating(true);
        
        setTimeout(() => {
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: 'Perfect! Now, please upload a VIDEO of your avatar that will present the explainer video.' 
            }]);
            setChatStep('avatar-video');
            setIsGenerating(false);
        }, 500);
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setAvatarVideo(file);
        setChatMessages(prev => [...prev, { role: 'user', content: '[Avatar video uploaded]' }]);
        setIsGenerating(true);
        
        // Generate script after video upload
        await handleGenerateScript();
    };

    const handleGenerateScript = async () => {
        if (!topicInput || !selectedDuration) return;
        
        setChatStep('generating-script');
        setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Generating your explainer script with AI...' 
        }]);
        
        try {
            const response = await fetch('/api/ai-influencer/generate-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topicInput, duration: selectedDuration })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setGeneratedScript(data.script);
                setEditableScript(data.script);
                setChatMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: `Here's your generated script (${data.wordCount} words). You can edit it below before proceeding.` 
                }]);
                setChatStep('edit-script');
            } else {
                throw new Error(data.error || 'Script generation failed');
            }
        } catch (error: any) {
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: `Error generating script: ${error.message}` 
            }]);
            setChatStep('avatar-video');
        }
        setIsGenerating(false);
    };

    const handleGenderSelect = (gender: 'male' | 'female') => {
        setSelectedGender(gender);
        setChatMessages(prev => [...prev, { role: 'user', content: gender === 'male' ? 'Male voice' : 'Female voice' }]);
        setIsGenerating(true);
        
        setTimeout(() => {
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: `Perfect! You've selected a ${gender} voice. Click "Proceed" to generate the audio.` 
            }]);
            setChatStep('gender');
            setIsGenerating(false);
        }, 500);
    };

    const handleGenerateTTS = async () => {
        if (!editableScript || !selectedGender || !avatarVideo) return;
        
        setIsGenerating(true);
        setChatStep('generating-tts');
        
        const newJobId = generateJobId();
        setJobId(newJobId);
        
        try {
            // Upload video to Firebase first
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: 'Uploading your avatar video to Firebase...' 
            }]);
            
            const videoRef = ref(storage, `AIInfluencer/${newJobId}/avatar.mp4`);
            await uploadBytes(videoRef, avatarVideo);
            const videoUrl = await getDownloadURL(videoRef);
            setAvatarVideoUrl(videoUrl);
            
            // Generate TTS
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: 'Generating voice-over with OpenAI TTS...' 
            }]);
            
            const response = await fetch('/api/ai-influencer/generate-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    jobId: newJobId, 
                    script: editableScript, 
                    gender: selectedGender 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setAudioUrl(data.audioUrl);
                setChatMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: 'Audio generated! Listen to the preview below. Click "Generate Video" to create the final lip-synced video.' 
                }]);
                setChatStep('preview-audio');
            } else {
                throw new Error(data.error || 'TTS generation failed');
            }
        } catch (error: any) {
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: `Error: ${error.message}` 
            }]);
            setChatStep('gender');
        }
        setIsGenerating(false);
    };

    const handleGenerateLipSync = async () => {
        if (!jobId || !avatarVideoUrl || !audioUrl) return;
        
        setIsGenerating(true);
        setChatStep('generating-lipsync');
        setChatMessages(prev => [...prev, { 
            role: 'assistant', 
            content: 'Generating lip-synced video with Fal AI... This may take 2-5 minutes.' 
        }]);
        
        try {
            const response = await fetch('/api/sqs/ai-influencer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    jobId, 
                    userId: user?.uid,
                    avatarVideoUrl, 
                    audioUrl,
                    script: editableScript,
                    duration: selectedDuration,
                    gender: selectedGender
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setChatMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: 'Job dispatched! Monitoring progress...' 
                }]);
            } else {
                throw new Error(data.error || 'Failed to dispatch job');
            }
        } catch (error: any) {
            setChatMessages(prev => [...prev, { 
                role: 'assistant', 
                content: `Error: ${error.message}` 
            }]);
            setIsGenerating(false);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Mouse tracking for potential future animations
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    // Firestore polling for job status
    useEffect(() => {
        if (!jobId) return;
        
        const unsubscribe = onSnapshot(
            doc(db, 'aiInfluencerJobs', jobId),
            (docSnapshot) => {
                const data = docSnapshot.data();
                if (data?.status === 'complete' && data?.finalVideoUrl) {
                    setFinalVideoUrl(data.finalVideoUrl);
                    setChatStep('complete');
                    setChatMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: 'Your video is ready! Check it out in the monitor output.' 
                    }]);
                    setIsGenerating(false);
                } else if (data?.status === 'error') {
                    setChatMessages(prev => [...prev, { 
                        role: 'assistant', 
                        content: `Error: ${data.errorMessage || 'Video generation failed'}` 
                    }]);
                    setIsGenerating(false);
                }
            }
        );
        
        return () => unsubscribe();
    }, [jobId]);

    return (
        <section
            onMouseMove={handleMouseMove}
            data-section-theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            className="relative min-h-screen bg-[#FAFAFA] dark:bg-black text-black dark:text-white font-sans selection:bg-[#E2FF4D]/30 overflow-x-hidden transition-colors duration-500"
        >
            <StudioNavbar
                rightContent={
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isGenerating ? 'bg-[#ff6d1f]' : 'bg-green-500'}`} />
                        <span className="text-[10px] uppercase font-medium text-gray-500 tracking-widest">
                            {isGenerating ? 'Generating' : 'Active'}
                        </span>
                    </div>
                }
            />

            <main className="relative z-10 pt-24 pb-16 px-4 md:px-10 max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 text-black dark:text-white">AI Influencer</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Create engaging content with AI-powered tools</p>
                </div>

                {/* Side-by-Side Layout */}
                <div className="flex flex-col md:flex-row gap-8 h-[calc(100vh-16rem)] items-start">
                    
                    {/* LEFT: Chat UI - Fixed width */}
                    <div className="w-[750px] flex flex-col gap-5 min-w-0 h-full flex-shrink-0">
                        
                        {/* Mode Tabs */}
                        <div className="space-y-3">
                            {/* <label className="text-[9px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest">Mode</label> */}
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => setActiveTab('explainers')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                                        activeTab === 'explainers'
                                            ? 'bg-white dark:bg-white text-black border-white dark:border-white'
                                            : 'bg-[#111] dark:bg-[#111] text-white/60 border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <FileText size={10} /> Explainers
                                </button>
                                <button
                                    onClick={() => setActiveTab('motion-control')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                                        activeTab === 'motion-control'
                                            ? 'bg-white dark:bg-white text-black border-white dark:border-white'
                                            : 'bg-[#111] dark:bg-[#111] text-white/60 border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <Move3d size={10} /> Motion Control
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1">
                            {activeTab === 'explainers' && (
                                <div className="flex flex-col bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl h-[600px]">
                                    {/* Chat Header */}
                                    <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#0F0F0F]/50 flex justify-between items-center shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <Sparkles size={12} className="text-purple-400" />
                                                <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-green-500 rounded-full border border-black animate-pulse"></div>
                                            </div>
                                            <span className="text-[9px] uppercase font-bold text-black/70 dark:text-white/70 tracking-widest whitespace-nowrap">Vevo</span>
                                        </div>
                                    </div>

                                    {/* Dynamic Chat Controls based on Step */}
                                    {chatStep === 'duration' && (
                                        <div className="px-4 py-3 bg-gray-100/50 dark:bg-[#0D0D0D] border-b border-gray-200 dark:border-white/5 shrink-0">
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest mb-2 flex items-center gap-1.5">
                                                <Clock size={9} /> Select Duration
                                            </p>
                                            <div className="flex gap-2">
                                                {[15, 30].map((d) => (
                                                    <button
                                                        key={d}
                                                        onClick={() => handleDurationSelect(d)}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                                                            selectedDuration === d
                                                                ? 'bg-purple-600 border-purple-600 text-white'
                                                                : 'bg-white/60 dark:bg-black/40 border-gray-200 dark:border-white/10 text-black/60 dark:text-white/60 hover:border-purple-500/30'
                                                        }`}
                                                    >
                                                        <Clock size={10} /> {d}s
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {chatStep === 'avatar-video' && (
                                        <div className="px-4 py-3 bg-gray-100/50 dark:bg-[#0D0D0D] border-b border-gray-200 dark:border-white/5 shrink-0">
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest mb-2 flex items-center gap-1.5">
                                                <Video size={9} /> Upload Avatar Video
                                            </p>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleVideoUpload}
                                                accept="video/mp4,video/mov,video/webm"
                                                className="hidden"
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full py-3 rounded-lg border border-dashed border-gray-300 dark:border-white/20 bg-white/60 dark:bg-black/40 hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:border-purple-400/50 transition-all flex items-center justify-center gap-2 text-[10px] text-black/60 dark:text-white/60"
                                            >
                                                {avatarVideo ? (
                                                    <>
                                                        <Video size={14} className="text-purple-400" />
                                                        <span className="text-purple-600 dark:text-purple-400 font-medium">Video Uploaded ({(avatarVideo.size / 1024 / 1024).toFixed(1)}MB)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload size={14} className="text-purple-400" />
                                                        <span>Click to upload your avatar video</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {chatStep === 'edit-script' && (
                                        <div className="px-4 py-3 bg-gray-100/50 dark:bg-[#0D0D0D] border-b border-gray-200 dark:border-white/5 shrink-0">
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest mb-2 flex items-center gap-1.5">
                                                <Edit3 size={9} /> Edit Script
                                            </p>
                                            <textarea
                                                value={editableScript}
                                                onChange={(e) => setEditableScript(e.target.value)}
                                                className="w-full h-24 p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-black/40 text-[10px] text-black dark:text-white focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all resize-none"
                                                placeholder="Edit your script here..."
                                            />
                                            <button
                                                onClick={() => setChatStep('gender')}
                                                className="w-full mt-2 py-2 rounded-lg bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-purple-500 transition-all"
                                            >
                                                Continue to Voice Selection
                                            </button>
                                        </div>
                                    )}

                                    {chatStep === 'gender' && (
                                        <div className="px-4 py-3 bg-gray-100/50 dark:bg-[#0D0D0D] border-b border-gray-200 dark:border-white/5 shrink-0">
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest mb-2 flex items-center gap-1.5">
                                                <Users size={9} /> Select Voice Gender
                                            </p>
                                            <div className="flex gap-2 mb-2">
                                                {[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }].map((g) => (
                                                    <button
                                                        key={g.value}
                                                        onClick={() => handleGenderSelect(g.value as 'male' | 'female')}
                                                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                                            selectedGender === g.value
                                                                ? 'bg-purple-600 border-purple-600 text-white'
                                                                : 'bg-white/60 dark:bg-black/40 border-gray-200 dark:border-white/10 text-black/60 dark:text-white/60 hover:border-purple-500/30'
                                                        }`}
                                                    >
                                                        {g.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {selectedGender && (
                                                <button
                                                    onClick={handleGenerateTTS}
                                                    className="w-full py-2 rounded-lg bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-purple-500 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Volume2 size={12} />
                                                    Proceed to Generate Audio
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {chatStep === 'preview-audio' && audioUrl && (
                                        <div className="px-4 py-3 bg-gray-100/50 dark:bg-[#0D0D0D] border-b border-gray-200 dark:border-white/5 shrink-0">
                                            <p className="text-[9px] uppercase font-bold text-black/40 dark:text-white/40 tracking-widest mb-2 flex items-center gap-1.5">
                                                <Volume2 size={9} /> Audio Preview
                                            </p>
                                            <audio controls src={audioUrl} className="w-full mb-2" />
                                            <button
                                                onClick={handleGenerateLipSync}
                                                className="w-full py-3 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-400 hover:to-blue-400 shadow-lg hover:scale-[1.01]"
                                            >
                                                <Sparkles size={14} />
                                                Generate Lip-Synced Video
                                            </button>
                                        </div>
                                    )}


                                    {/* Chat Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white/30 dark:bg-[#070707]">
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[90%] rounded-xl px-3 py-2 text-[10px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-purple-600 text-white font-medium' : 'bg-gray-100 dark:bg-[#151515] text-black/80 dark:text-white/80 border border-gray-200 dark:border-white/5'}`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                        {isGenerating && (
                                            <div className="flex justify-start">
                                                <div className="bg-gray-100 dark:bg-[#151515] border border-gray-200 dark:border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                                                    <Loader2 size={10} className="animate-spin text-purple-400" />
                                                    <span className="text-[10px] text-black/60 dark:text-white/60">Thinking...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Controls - Replaces Chat Input */}
                                    {chatStep === 'greeting' || chatStep === 'topic' ? (
                                        /* Chat Input - Only for Topic Input */
                                        <div className="p-3 bg-gray-50 dark:bg-[#0F0F0F] border-t border-gray-200 dark:border-white/5 shrink-0">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="text"
                                                    value={chatInput}
                                                    onChange={(e) => setChatInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                                    placeholder="Type your topic..."
                                                    className="w-full bg-white/60 dark:bg-black/60 border border-gray-200 dark:border-white/10 rounded-full py-2 px-4 text-[10px] text-black dark:text-white focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all placeholder-black/30 dark:placeholder-white/20 shadow-inner"
                                                />
                                                <button
                                                    onClick={handleSendMessage}
                                                    disabled={!chatInput.trim()}
                                                    className="absolute right-1 p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-500 transition-all hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group"
                                                >
                                                    <Send size={12} className="transition-transform" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {activeTab === 'motion-control' && (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <h2 className="text-xl font-medium tracking-tight text-black dark:text-white">
                                            Motion <span className="text-black/40 dark:text-white/40">Control</span>
                                        </h2>
                                        <p className="text-black/40 dark:text-white/40 text-[11px] leading-relaxed">
                                            Control camera movements and animations with precision.
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[9px] uppercase font-bold text-black/30 dark:text-white/30 tracking-widest">Camera Movement</label>
                                        <textarea
                                            placeholder="Describe camera path (e.g. slow dolly in, pan left to right...)"
                                            className="w-full h-24 bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-[11px] text-black dark:text-white focus:border-cyan-500/30 outline-none transition-colors placeholder-black/20 dark:placeholder-white/20 resize-none leading-relaxed"
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

                                    <button
                                        onClick={() => setIsGenerating(!isGenerating)}
                                        className="w-full py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 shadow-xl hover:scale-[1.01]"
                                    >
                                        <Move3d size={14} />
                                        Apply Motion
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Monitor Output - Bigger 9:16 */}
                    <div className="flex flex-col gap-6 flex-shrink-0 h-full -mt-3">
                        <div className="w-[450px] h-[800px] bg-white/50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden relative group shadow-2xl" style={{ aspectRatio: '9/16' }}>
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]"></div>

                            <AnimatePresence mode='wait'>
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
                                        key="loader"
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/60 backdrop-blur-sm"
                                    >
                                        <Loader2 size={32} className="text-purple-400 animate-spin mb-4" />
                                        <p className="text-[10px] uppercase tracking-widest text-white/60">Processing...</p>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="empty"
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }}
                                        className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 opacity-20"
                                    >
                                        <div className="w-20 h-20 rounded-3xl border border-dashed border-black/40 dark:border-white/40 flex items-center justify-center mb-6">
                                            <MonitorPlay size={32} className="text-black dark:text-white" />
                                        </div>
                                        <h3 className="text-xl font-medium text-black dark:text-white mb-2">
                                            Monitor Output
                                        </h3>
                                        <p className="text-xs max-w-[240px] text-black/60 dark:text-white/60">
                                            Generated content will appear here after processing.
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="absolute top-4 left-4 flex gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-500/30"></div>
                                <div className="w-2 h-2 rounded-full bg-yellow-500/30"></div>
                                <div className="w-2 h-2 rounded-full bg-green-500/30"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </section>
    );
}
