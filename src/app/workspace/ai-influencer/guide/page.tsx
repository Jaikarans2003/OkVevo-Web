'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import StudioNavbar from '@/components/workspace/StudioNavbar';

const STEPS = [
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

export default function GuidePage() {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-orange-500/30">
            <StudioNavbar />
            
            <div className="max-w-[1000px] mx-auto px-6 pt-32 pb-40">
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

                <h1 className="text-3xl font-black mb-16 uppercase tracking-tight">AI Influencer Guide</h1>

                {/* Instructions List */}
                <div className="space-y-24">
                    {STEPS.map((step) => (
                        <div key={step.number} className="space-y-8">
                            <h2 className="text-xl font-medium text-white/90">
                                {step.number}. {step.text}
                            </h2>
                            
                            {/* Image Placeholder - Styled like the screenshot */}
                            <div className="w-full aspect-video rounded-xl bg-[#111] border border-white/5 flex items-center justify-center overflow-hidden shadow-2xl relative group">
                                <img 
                                    src={step.placeholder} 
                                    alt={step.text}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.opacity = '0';
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                                
                                {/* Fallback text if image missing */}
                                <div className="absolute inset-0 flex items-center justify-center -z-10">
                                    <div className="text-white/10 text-[10px] uppercase font-black tracking-[0.4em] text-center px-4">
                                        [ Image: {step.placeholder} ]
                                    </div>
                                </div>
                                
                                {/* Inner glow/border effect */}
                                <div className="absolute inset-0 border border-white/[0.02] rounded-xl pointer-events-none" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Call to Action */}
                <div className="mt-32 pt-20 border-t border-white/10 text-center">
                    <Link 
                        href="/workspace/ai-influencer"
                        className="inline-block px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-orange-500 hover:text-white transition-all transform active:scale-95"
                    >
                        Start Creating Now
                    </Link>
                </div>
            </div>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                
                body {
                    font-family: 'Inter', sans-serif;
                    background-color: black;
                }
            `}</style>
        </div>
    );
}
