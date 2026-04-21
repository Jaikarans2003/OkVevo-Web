'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Video, Target, Sparkles, Wand2 } from 'lucide-react';
import Link from 'next/link';
import StudioNavbar from '@/components/workspace/StudioNavbar';

const AI_INFLUENCER_STEPS = [
    {
        number: "1",
        text: "Upload a Text File or Type in your Ideas.",
        placeholder: "/instructions/1.png"
    },
    {
        number: "2",
        text: "Select Duration of your video.",
        placeholder: "/instructions/2.png"
    },
    {
        number: "3",
        text: "Select Your Vibe.",
        placeholder: "/instructions/3.png"
    },
    {
        number: "4",
        text: "Read, Edit and Finalise your Custom Social Media Script.",
        placeholder: "/instructions/4.png"
    },
    {
        number: "5",
        text: "Upload a Video of Yourself -> Read For Best Results Guide.",
        placeholder: "/instructions/5.png"
    },
    {
        number: "6",
        text: "Upload a Audio Sample of you -> Read For Best Results Guide.",
        placeholder: "/instructions/6.png"
    },
    {
        number: "7",
        text: "Click on Commit, Sit Back and Relax While OK VEVO Cooks your Social Media Ready Video.",
        placeholder: "/instructions/7.png"
    },
    {
        number: "8",
        text: "Your AI Video Done in Minutes, Not Hours Not Days, Click on Secure Download to Download the Video on Your Device.",
        placeholder: "/instructions/8.png"
    },
    {
        number: "9",
        text: "Add Custom Disclaimer in Marquee Section, Add Custom Watermark and Generate a Custom Thumbnail.",
        placeholder: "/instructions/9.png"
    },
    {
        number: "10",
        text: "Download Branded Video and Custom Thumbnail.",
        placeholder: "/instructions/10.png"
    },
    {
        number: "11",
        text: "Sample Thumbnail.",
        placeholder: "/instructions/11.png"
    },
    {
        number: "12",
        text: "Sample of Branded AI Video.",
        placeholder: "/instructions/12.png"
    }
];

const BEST_RESULT_STEPS = [
    {
        category: "Video Capture Guidelines",
        icon: <Video className="w-5 h-5 text-orange-500" />,
        items: [
            {
                title: "Optimal Framing",
                text: "Position yourself so there is minimal headspace at the top of the frame. Excessive space above the head can degrade the AI's processing accuracy.",
                placeholder: "/instructions/best_result/1.png"
            },
            {
                title: "Stability is Key",
                text: "Keep the camera and your body as still as possible. Avoid walking or significant torso movement, as this ensures the AI focuses entirely on your facial expressions.",
                placeholder: "/instructions/best_result/2.png"
            },
            {
                title: "Enunciation",
                text: "Speak clearly. OkVevo analyzes your lip movements to replicate them realistically; precise mouth movements lead to better synchronization.",
                placeholder: "/instructions/best_result/3.png"
            },
            {
                title: "Lighting Quality",
                text: "Use soft, even lighting. Avoid harsh, direct light sources that cause shadows or a \"bleached\" eﬀect, which can obscure facial details in the final render.",
                placeholder: "/instructions/best_result/2.png"
            }
        ]
    },
    {
        category: "Audio Recording Standards",
        icon: <Target className="w-5 h-5 text-orange-500" />,
        items: [
            {
                title: "Equipment",
                text: "Use a dedicated microphone or a high-quality smartphone/computer setup.Record in a quiet space. Background noise or echoes will interfere with the clarity of the voice clone.",
                placeholder: "/instructions/best_result/5.png"
            },
            {
                title: "Language & Diction",
                text: "Currently, recordings should be in English for best results. Focus on crisp pronunciation and a steady pace.",
                placeholder: "/instructions/best_result/8.png"
            },
            {
                title: "Duration",
                text: "Keep recordings to approximately 10 seconds to maintain high-fidelity output.",
                placeholder: "/instructions/best_result/7.png"
            }
        ]
    },
    {
        category: "Scripting & Punctuation",
        icon: <Sparkles className="w-5 h-5 text-orange-500" />,
        items: [
            {
                title: "Structural Punctuation",
                text: "Use frequent commas and periods. OkVevo uses these marks to understand where to pause and emphasize words.",
                placeholder: "/instructions/best_result/9.png"
            },
            {
                title: "The Final Stop",
                text: "Always end your script with a full stop (period). This is a technical requirement for the AI to identify the natural conclusion of the speech.",
                placeholder: "/instructions/best_result/6.png"
            },
            {
                title: "Narrative Cues",
                text: "Start and end your scripts with clear, definitive words to help the AI depict a natural beginning and a polished \"sign-oﬀ.\"",
                placeholder: "/instructions/best_result/4.png"
            }
        ]
    },
    {
        category: "Pro Tip",
        icon: <Wand2 className="w-5 h-5 text-orange-500" />,
        items: [
            {
                title: "Pro Tip",
                text: "When editing scripts generated by OkVevo, increasing the number of sentences and adding varied punctuation will result in a more human-like, rhythmic performance.",
                placeholder: "/instructions/best_result/12.png"
            }
        ]
    }
];

const TABS = [
    { id: 'ai-influencer', label: 'AI-INFLUENCER' },
    { id: 'best-result', label: 'Best Result' }
];

export default function GuidePage() {
    const [activeTab, setActiveTab] = useState('ai-influencer');

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
            <StudioNavbar />
            
            <div className="max-w-[1200px] mx-auto px-6 pt-32 pb-40">
                {/* Header/Back Button */}
                <div className="mb-12">
                    <Link 
                        href="/workspace/ai-influencer"
                        className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-[12px] font-bold uppercase tracking-widest">Back to Studio</span>
                    </Link>
                </div>

                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Sidebar */}
                    <aside className="lg:w-64 lg:flex-shrink-0 relative">
                        <div className="lg:fixed lg:top-40 lg:z-50 space-y-4 bg-[#111111]/80 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] max-h-[70vh] overflow-y-auto custom-scrollbar shadow-[0_20px_50px_rgba(0,0,0,0.5)] lg:w-64">
                            <h2 className="text-[10px] font-black tracking-[0.3em] uppercase text-white/40 mb-4 ml-2">User Guides</h2>
                            <div className="flex flex-col gap-2">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className={`w-full text-left px-5 py-4 rounded-2xl transition-all duration-300 text-[12px] font-bold tracking-wider uppercase border ${
                                            activeTab === tab.id 
                                                ? 'bg-orange-600 border-orange-400 text-white shadow-[0_10px_30px_rgba(234,88,12,0.4)]' 
                                                : 'text-white/40 border-transparent hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>

                    {/* Content Area */}
                    <main className="flex-1 space-y-32">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                {activeTab === 'ai-influencer' && (
                                    <div className="space-y-24">
                                        {/* YouTube Video Tutorial */}
                                        <div>
                                            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-6 flex items-center gap-3">
                                                <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                                                    <Video className="w-5 h-5 text-orange-500" />
                                                </div>
                                                Video Tutorial
                                            </h2>
                                            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                                <iframe
                                                    width="100%"
                                                    height="100%"
                                                    src="https://www.youtube.com/embed/jwO-JdGpQQ4"
                                                    title="AI-Influencer Tutorial"
                                                    frameBorder="0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                    allowFullScreen
                                                    className="absolute inset-0"
                                                ></iframe>
                                            </div>
                                        </div>

                                        <h1 className="text-3xl font-black uppercase tracking-tight">AI Influencer Guide</h1>
                                        {AI_INFLUENCER_STEPS.map((step) => (
                                            <div key={step.number} className="space-y-8">
                                                <h2 className="text-xl font-medium text-white/90">
                                                    {step.number}. {step.text}
                                                </h2>
                                                <ImagePlaceholder src={step.placeholder} alt={step.text} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeTab === 'best-result' && (
                                    <div className="space-y-32">
                                        <h1 className="text-3xl font-black mb-16 uppercase tracking-tight">Best Result Guide</h1>
                                        {BEST_RESULT_STEPS.map((section, idx) => (
                                            <div key={idx} className="space-y-16">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                                                        {section.icon}
                                                    </div>
                                                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">{section.category}</h2>
                                                </div>
                                                <div className="space-y-20">
                                                    {section.items.map((item, itemIdx) => (
                                                        <div key={itemIdx} className="space-y-8 pl-4 border-l-2 border-orange-500/10 hover:border-orange-500/40 transition-colors duration-500">
                                                            <div className="space-y-2">
                                                                <h3 className="text-lg font-bold text-orange-500">{item.title}</h3>
                                                                <p className="text-white/70 leading-relaxed max-w-2xl">{item.text}</p>
                                                            </div>
                                                            <ImagePlaceholder src={item.placeholder} alt={item.title} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* Bottom Call to Action */}
                        <div className="mt-32 pt-20 border-t border-white/10 text-center">
                            <Link 
                                href="/workspace/ai-influencer"
                                className="inline-block px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-orange-500 hover:text-white transition-all transform active:scale-95"
                            >
                                Start Creating Now
                            </Link>
                        </div>
                    </main>
                </div>
            </div>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                
                body {
                    font-family: 'Inter', sans-serif;
                    background-color: black;
                }

                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}

function ImagePlaceholder({ src, alt }: { src: string; alt: string }) {
    return (
        <div className="w-full aspect-video rounded-xl bg-[#111]/50 border border-white/5 flex items-center justify-center overflow-hidden shadow-2xl relative group">
            <img 
                src={src} 
                alt={alt}
                className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 p-4"
                onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = '0';
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            
            {/* Fallback text if image missing - Moved to z-0 to be visible over background */}
            <div className="absolute inset-0 flex items-center justify-center z-0">
                <div className="text-white/10 text-[10px] uppercase font-black tracking-[0.4em] text-center px-4">
                    [ Image: {src} ]
                </div>
            </div>
            
            {/* Inner glow/border effect */}
            <div className="absolute inset-0 border border-white/[0.02] rounded-xl pointer-events-none" />
        </div>
    );
}
