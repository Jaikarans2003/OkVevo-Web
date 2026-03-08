'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

const Showcase = () => {
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        {
            name: 'Create',
            image: '/create.png',
        },
        {
            name: 'Animate',
            image: '/showcase_animate.jpg',
        },
        {
            name: 'Publish',
            image: '/showcase_publish.jpg',
        }
    ];

    return (
        <section id="showcase" className="relative py-24 bg-[#020202] text-white selection:bg-orange-500/30">
            <div className="max-w-[1300px] mx-auto px-6 md:px-12 relative z-10">
                
                {/* Header Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
                    {/* Left Typography */}
                    <div className="lg:col-span-7">
                        <h2 className="text-5xl md:text-[70px] font-bold leading-[1.05] tracking-[-0.03em] text-white mb-6">
                             <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">Go from</span> script to <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">video </span>
                            
                            faster with AI
                        </h2>
                    </div>
                    
                    {/* Right Typography */}
                    <div className="lg:col-span-5 flex flex-col justify-center">
                        <p className="text-lg md:text-[22px] text-[#a1a1aa] leading-[1.4] mb-6 font-medium max-w-lg">
                            Streamline your video creation pipeline by turning text into high-quality social media content, bringing your digital avatars to life without a camera, and optimizing content for every platform.
                        </p>
                        <div>
                            <a href="/workspace" className="inline-flex items-center gap-2 text-white font-medium hover:text-orange-400 transition-colors border-b border-white hover:border-orange-400 pb-1 w-max">
                                Discover OKVEVO AI 
                                <ArrowRight className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Showcase Interactive Area */}
                <div className="mt-8">
                    {/* Image Container */}
                    <div className="relative w-full h-[400px] md:h-[450px] lg:h-[700px] rounded-[24px] overflow-hidden bg-[#080808] border border-[#1a1a1a] shadow-2xl">
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
                                    <Image 
                                        src={tabs[activeTab].image} 
                                        alt={tabs[activeTab].name}
                                        fill
                                        className="object-cover"
                                        priority
                                    />
                                    {/* Optional gradient overlay to blend edges if needed */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                                </div>
                            </motion.div>
                        </AnimatePresence>
                        
                        
                    </div>

                    {/* Tabs Area */}
                    <div className="flex items-center justify-start md:justify-around gap-12 mt-12 overflow-x-auto custom-scrollbar border-t border-[#222]">
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
