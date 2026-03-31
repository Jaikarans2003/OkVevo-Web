'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Upload, Sparkles, User, Check, Loader2, ChevronRight, FileText, Image as ImageIcon } from 'lucide-react';

type Step = 'chat' | 'upload' | 'generate' | 'avatar';

export default function ExplainerWorkflow() {
    const [currentStep, setCurrentStep] = useState<Step>('chat');
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', text: string }[]>([
        { role: 'assistant', text: "Yo! OKVEVO in the building. I'm your eccentric creative genius. Step into the lab and let's cook up a masterpiece. Drop your script and let's get OKVEVING!" }
    ]);
    const [inputText, setInputText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [generatedScript, setGeneratedScript] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
    const [uploadedScriptFile, setUploadedScriptFile] = useState<File | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const scriptInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const steps: { id: Step; label: string; icon: any }[] = [
        { id: 'chat', label: 'Chat UI', icon: Send },
        { id: 'upload', label: 'Upload Script', icon: Upload },
        { id: 'generate', label: 'AI Analysis', icon: Sparkles },
        { id: 'avatar', label: 'Select Avatar', icon: User },
    ];

    const handleSendMessage = () => {
        if (!inputText.trim()) return;
        setMessages([...messages, { role: 'user', text: inputText }]);
        setInputText('');

        // Mock assistant response
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: "Oooooh, I can see the vision! OKVEVO is vibing with this. Do you have a script ready for this drop, or should OKVEVO's neural engines forge one for you?"
            }]);
        }, 1000);
    };

    const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadedScriptFile(file);
        setCurrentStep('generate');
        setIsAnalyzing(true);

        // Simulate reading and analyzing the file
        setTimeout(() => {
            setIsAnalyzing(true);
            setGeneratedScript(`🧠 OKVEVO Analysis of "${file.name}": Welcome to the future, baby. This script is pure heat. Based on your file, OKVEVO optimized the tone for maximum, unfiltered engagement. We don't play safe here.`);
        }, 3000);
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        setUploadedAvatarUrl(url);
        setSelectedAvatar('custom');
    };

    const nextStep = () => {
        if (currentStep === 'chat') setCurrentStep('upload');
        else if (currentStep === 'upload') setCurrentStep('generate');
        else if (currentStep === 'generate') setCurrentStep('avatar');
    };

    return (
        <div className="flex flex-col gap-12">
            {/* Workflow Stepper */}
            <div className="flex items-center justify-between max-w-4xl mx-auto w-full px-4">
                {steps.map((step, idx) => {
                    const isActive = currentStep === step.id;
                    const isPast = steps.findIndex(s => s.id === currentStep) > idx;

                    return (
                        <div key={step.id} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center gap-3 relative">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isActive ? 'border-[#FF0080] bg-[#FF0080]/10 text-white shadow-[0_0_20px_rgba(255,0,128,0.3)]' :
                                    isPast ? 'border-lime-500 bg-lime-500/10 text-lime-500' :
                                        'border-white/10 bg-white/5 text-white/20'
                                    }`}>
                                    {isPast ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest absolute -bottom-6 whitespace-nowrap ${isActive ? 'text-white' : 'text-white/20'
                                    }`}>
                                    {step.label}
                                </span>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className="flex-1 h-[2px] mx-4 bg-white/5">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-[#FF0080] to-[#7928CA]"
                                        initial={{ width: '0%' }}
                                        animate={{ width: isPast ? '100%' : '0%' }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Workflow Content */}
            <div className="mt-8">
                <AnimatePresence mode="wait">
                    {currentStep === 'chat' && (
                        <motion.div
                            key="chat-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-4xl mx-auto w-full h-[600px] flex flex-col bg-white/5 rounded-[40px] border border-white/10 overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" />
                                    <span className="text-xs font-black uppercase tracking-widest text-white/60">OKVEVO ONLINE & OKVEVING</span>
                                </div>
                                <button onClick={() => setCurrentStep('upload')} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center gap-2 border border-white/5">
                                    Skip to Upload <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Scrollable Messages Container */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar scroll-smooth">
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] p-5 rounded-3xl text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-gradient-to-r from-[#FF0080] to-[#7928CA] text-white rounded-tr-none shadow-lg'
                                            : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5 backdrop-blur-md'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </motion.div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="p-6 border-t border-white/10 flex gap-4 bg-white/[0.02]">
                                <input
                                    type="text"
                                    placeholder="Describe your explainer script..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-[#FF0080]/50 transition-all placeholder:text-white/20"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className="bg-white text-black px-6 rounded-2xl hover:scale-105 active:scale-95 transition-all font-bold shadow-lg"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 'upload' && (
                        <motion.div
                            key="upload-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-4xl mx-auto w-full h-[500px] flex flex-col items-center justify-center bg-white/5 rounded-[40px] border border-white/10 p-12 text-center gap-8 shadow-2xl"
                        >
                            <input
                                type="file"
                                className="hidden"
                                ref={scriptInputRef}
                                onChange={handleScriptUpload}
                                accept=".txt,.pdf,.doc,.docx"
                            />

                            <div
                                className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group hover:border-[#FF0080]/50 hover:bg-[#FF0080]/5 transition-all duration-500 cursor-pointer shadow-xl relative"
                                onClick={() => scriptInputRef.current?.click()}
                            >
                                <Upload className="w-12 h-12 text-white/40 group-hover:text-[#FF0080] group-hover:scale-110 transition-all duration-500" />
                                <div className="absolute inset-0 rounded-full bg-[#FF0080]/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <div>
                                <h3 className="text-3xl font-black italic uppercase tracking-tight mb-3">Feed the Machine</h3>
                                <p className="text-white/40 max-w-sm mx-auto font-medium">
                                    Drop your script file here to begin the OKVEVO protocol. We take .txt, .pdf, or Word — as long as it's fire.
                                </p>
                            </div>

                            <button
                                onClick={() => scriptInputRef.current?.click()}
                                className="px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform shadow-xl"
                            >
                                Browse Local Files
                            </button>
                        </motion.div>
                    )}

                    {currentStep === 'generate' && (
                        <motion.div
                            key="generate-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-4xl mx-auto w-full h-[500px] flex flex-col bg-white/5 rounded-[40px] border border-white/10 overflow-hidden p-12 shadow-2xl"
                        >
                            {isAnalyzing ? (
                                <div className="h-full flex flex-col items-center justify-center gap-6">
                                    <div className="relative">
                                        <Loader2 className="w-16 h-16 text-[#FF0080] animate-spin" />
                                        <div className="absolute inset-0 blur-xl bg-[#FF0080]/30 animate-pulse" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold mb-1 italic uppercase tracking-tight">OKVEVO IS COOKIN'</h3>
                                        <p className="text-white/40 text-xs font-black uppercase tracking-[0.2em] animate-pulse">Engaging Neural OKVEVO Networks... Pure Genius Incoming...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col gap-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
                                            <Sparkles className="w-6 h-6 text-[#FF0080]" /> AI Analysis Result
                                        </h3>
                                        <div className="px-4 py-2 bg-lime-500/10 text-lime-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-lime-500/20">
                                            {uploadedScriptFile ? 'File Analyzed' : 'Prompt Analyzed'}
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-black/40 rounded-3xl p-8 border border-white/5 text-white/80 font-medium leading-relaxed italic relative backdrop-blur-xl">
                                        "{generatedScript}"

                                        {uploadedScriptFile && (
                                            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                                                <FileText className="w-3 h-3 text-[#FF0080]" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{uploadedScriptFile.name}</span>
                                            </div>
                                        )}

                                        <div className="absolute bottom-4 right-4 group cursor-pointer">
                                            <div className="bg-white/10 p-2 rounded-xl border border-white/5 hover:bg-white/20 transition-all hover:scale-110">
                                                <Sparkles className="w-4 h-4 text-[#FF0080]" />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={nextStep}
                                        className="w-fit self-end px-12 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform flex items-center gap-2 shadow-xl"
                                    >
                                        Choose Avatar <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {currentStep === 'avatar' && (
                        <motion.div
                            key="avatar-step"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-4xl mx-auto w-full h-auto min-h-[500px] flex flex-col bg-white/5 rounded-[40px] border border-white/10 overflow-hidden p-12 shadow-2xl"
                        >
                            <div className="flex flex-col gap-8 h-full">
                                <div>
                                    <h3 className="text-3xl font-black uppercase italic tracking-tight mb-2">Select Your Persona</h3>
                                    <p className="text-white/40 text-sm font-medium">Choose an OKVEVO persona to narrate your script or upload your own creation.</p>
                                </div>

                                <input
                                    type="file"
                                    className="hidden"
                                    ref={avatarInputRef}
                                    onChange={handleAvatarUpload}
                                    accept="image/*"
                                />

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                    {/* Upload Button */}
                                    <button
                                        onClick={() => avatarInputRef.current?.click()}
                                        className={`aspect-square rounded-[30px] border-2 border-dashed flex flex-col items-center justify-center gap-3 group transition-all relative overflow-hidden ${selectedAvatar === 'custom' ? 'border-[#FF0080] bg-[#FF0080]/5' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        {uploadedAvatarUrl ? (
                                            <img src={uploadedAvatarUrl} className="absolute inset-0 w-full h-full object-cover" alt="Custom avatar" />
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/20 group-hover:text-white group-hover:scale-110 transition-all">
                                                    <Upload className="w-6 h-6" />
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/20 group-hover:text-white">Upload Custom</span>
                                            </>
                                        )}
                                        {selectedAvatar === 'custom' && (
                                            <div className="absolute top-4 right-4 w-6 h-6 bg-[#FF0080] rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </button>

                                    {/* Preset Avatars */}
                                    {[1, 2, 3].map((i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedAvatar(`avatar-${i}`)}
                                            className={`aspect-square rounded-[30px] border-2 transition-all overflow-hidden relative group ${selectedAvatar === `avatar-${i}` ? 'border-[#FF0080]' : 'border-white/5 bg-white/5 hover:border-white/20'
                                                }`}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4 z-10">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Persona Model 0{i}</span>
                                            </div>

                                            <div className="w-full h-full bg-gradient-to-br from-white/10 to-transparent group-hover:scale-110 transition-transform duration-700 relative">
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <User className="w-16 h-16 text-white/5 group-hover:text-white/10 transition-colors" />
                                                </div>
                                            </div>

                                            {selectedAvatar === `avatar-${i}` && (
                                                <div className="absolute top-4 right-4 w-6 h-6 bg-[#FF0080] rounded-full flex items-center justify-center shadow-lg z-20 animate-in zoom-in">
                                                    <Check className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    className={`w-full py-6 rounded-2xl font-black uppercase tracking-[0.4em] text-sm transition-all shadow-2xl relative overflow-hidden group/btn ${selectedAvatar
                                        ? 'bg-gradient-to-r from-[#FF0080] via-[#7928CA] to-[#4433FF] text-white hover:scale-[1.01] active:scale-[0.99]'
                                        : 'bg-white/10 text-white/20 cursor-not-allowed'
                                        }`}
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-3">
                                        Unleash OKVEVO <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                                    </span>
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
