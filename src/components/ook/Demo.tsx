'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import ButtonWithIconDemo from '@/components/ui/button-with-icon';

const tabs = [
    // {
    //     name: 'Concept',
    //     video: 'https://firebasestorage.googleapis.com/v0/b/okvevo-testing.firebasestorage.app/o/videoforwebsite%2FfirstPart.mp4?alt=media&token=b733b4d7-410c-4b41-b3c0-e2408345cb8f',
    // },
    // {
    //     name: 'Create',
    //     video: 'https://firebasestorage.googleapis.com/v0/b/okvevo-testing.firebasestorage.app/o/videoforwebsite%2Fsecondddd.mp4?alt=media&token=8ddb26de-79d5-46b2-9013-c7843de5ab73',
    // },
    {
        name: 'Concept to Result',
        video: 'https://firebasestorage.googleapis.com/v0/b/okvevo-testing.firebasestorage.app/o/videoforwebsite%2FOkVevo%20Demos.mp4?alt=media&token=42d539e8-f646-4f3d-93eb-9caf9c61488b',
    }
];

const Showcase = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [mounted, setMounted] = useState(false);
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        videoRefs.current.forEach((video, index) => {
            if (!video) return;
            if (index === activeTab) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch((e) => console.log("Play interrupted:", e));
                }
            } else {
                video.pause();
                if (video.currentTime > 0) {
                    video.currentTime = 0;
                }
            }
        });
    }, [activeTab, mounted]);

    return (
        <section id="demo" className="relative py-24 bg-[#020202] text-white selection:bg-orange-500/30">
            <div className="max-w-[1300px] mx-auto px-6 md:px-12 relative z-10">
                
                {/* Header Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
                    {/* Left Typography */}
                    <div className="lg:col-span-7">
                        <motion.h2 
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                            className="text-4xl md:text-[70px] font-bold leading-[1.05] tracking-[-0.03em] text-white mb-6"
                        >
                             <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">Go from</span> script to <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">legendary </span>
                            
                            faster with OKVEVO
                        </motion.h2>
                    </div>
                    
                    {/* Right Typography */}
                    <div className="lg:col-span-5 flex flex-col justify-center">
                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="text-lg md:text-[22px] text-[#a1a1aa] leading-[1.4] mb-6 font-medium max-w-lg"
                        >
                            Streamline your creation pipeline with OKVEVO neural engines. Bring your digital twins to life without a camera and own the algorithm on every platform.
                        </motion.p>
                        <div className="pt-4">
                            <Link href="/workspace">
                                <ButtonWithIconDemo />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Showcase Interactive Area */}
                <div className="mt-8">
                    {/* Glowing Media Container */}
                    <div className="relative group">
                        {/* Elegant Glow Effect */}
                        <div className="absolute -inset-4 bg-gradient-to-r from-[#FF6B35]/20 via-orange-500/10 to-[#FF6B35]/20 blur-3xl rounded-[30px] opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform-gpu" />
                        
                        {/* Image Container */}
                        <div className="relative z-10 w-full h-[400px] md:h-[450px] lg:h-[700px] rounded-[24px] overflow-hidden bg-[#080808] border border-[#1a1a1a] group-hover:border-white/10 shadow-[0_0_40px_rgba(255,107,53,0.1)] group-hover:shadow-[0_0_80px_rgba(255,107,53,0.2)] transition-all duration-700">
                            {!mounted ? (
                                // Server-rendered static fallback — avoids hydration mismatch
                                <div className="absolute inset-0 bg-[#080808]">
                                    <div className="relative w-full h-full">
                                        <video
                                            src={tabs[0].video}
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                            className="w-full h-full object-cover"
                                            suppressHydrationWarning
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {tabs.map((tab, index) => (
                                        <motion.div
                                            key={tab.video}
                                            initial={false}
                                            animate={{ opacity: activeTab === index ? 1 : 0, scale: activeTab === index ? 1 : 1.02 }}
                                            transition={{ duration: 0.4, ease: "easeOut" }}
                                            className={`absolute inset-0 bg-[#080808] ${activeTab === index ? "z-10 pointer-events-auto" : "z-0 pointer-events-none"}`}
                                        >
                                            <div className="relative w-full h-full">
                                                <video
                                                    ref={(el) => {
                                                        videoRefs.current[index] = el;
                                                    }}
                                                    src={tab.video}
                                                    preload="auto"
                                                    muted
                                                    loop
                                                    playsInline
                                                    className="w-full h-full object-cover"
                                                    suppressHydrationWarning
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Tabs Area */}
                    <div className="flex items-center justify-start md:justify-around gap-8 md:gap-12 mt-12 overflow-x-auto scrollbar-hide border-t border-[#222] relative z-20 px-4">
                        {tabs.map((tab, index) => {
                            const isActive = activeTab === index;
                            return (
                                <button
                                    key={index}
                                    onClick={() => setActiveTab(index)}
                                    className={`relative py-6 md:py-8 px-4 md:px-8 text-xl md:text-4xl font-semibold transition-colors duration-300 whitespace-nowrap ${
                                        isActive ? 'text-white' : 'text-[#555] hover:text-[#888]'
                                    }`}
                                >
                                    {tab.name}
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeTabIndicator"
                                            className="absolute top-0 left-0 right-0 h-[2px] bg-white"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

            </div>
        </section>
    );
};

export default Showcase;
