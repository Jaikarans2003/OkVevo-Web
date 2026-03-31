'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import ButtonWithIconDemo from '@/components/ui/button-with-icon';

const tabs = [
    {
        name: 'Create',
        video: '/videos/script.mp4',
    },
    {
        name: 'Animate',
        video: '/videos/influencer.mp4',
    },
    {
        name: 'Publish',
        video: '/videos/aiproduct.mp4',
    }
];

const Showcase = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);


    // Cycle through tabs automatically every 9 seconds
    useEffect(() => {
        if (!mounted) return;
        const interval = setInterval(() => {
            setActiveTab((prevTab) => (prevTab + 1) % tabs.length);
        }, 9000);

        return () => clearInterval(interval);
    }, [mounted]);

    return (
        <section id="showcase" className="relative py-24 bg-[#020202] text-white selection:bg-orange-500/30">
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
                            className="text-5xl md:text-[70px] font-bold leading-[1.05] tracking-[-0.03em] text-white mb-6"
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
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab}
                                        initial={{ opacity: 0, scale: 1.02 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                        className="absolute inset-0 bg-[#080808]"
                                    >
                                        <div className="relative w-full h-full">
                                            <video
                                                key={tabs[activeTab].video}
                                                src={tabs[activeTab].video}
                                                autoPlay
                                                muted
                                                loop
                                                playsInline
                                                className="w-full h-full object-cover"
                                                suppressHydrationWarning
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Tabs Area */}
                    <div className="flex items-center justify-start md:justify-around gap-12 mt-12 overflow-x-auto custom-scrollbar border-t border-[#222] relative z-20">
                        {tabs.map((tab, index) => {
                            const isActive = activeTab === index;
                            return (
                                <button
                                    key={index}
                                    onClick={() => setActiveTab(index)}
                                    className={`relative py-8 px-8 text-2xl md:text-4xl font-semibold transition-colors duration-300 whitespace-nowrap ${
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
