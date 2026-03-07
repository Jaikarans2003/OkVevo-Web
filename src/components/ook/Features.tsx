'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Image from 'next/image';

const HowItWorks = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    const steps = [
        {
            shortTitle: "AI Influencers",
            fullText: "Create talking avatar videos in seconds — upload your avatar, generate a script and produce social media ready videos instantly.",
            img: "/avatar.png",
        },
        {
            shortTitle: "Product Studio",
            fullText: "Create stunning product photos without a studio — upload your product and generate lifestyle images and marketing visuals instantly.",
            img: "/movie-scene.png",
        },
        {
            shortTitle: "Social Media",
            fullText: "Generate viral short-form videos — effortlessly optimized for Instagram Reels, TikTok, and YouTube Shorts.",
            img: "/ai-engine.png",
        }
    ];

    return (
        <section id="features" data-section-theme="dark" className="relative py-32 bg-[#020202] text-white selection:bg-orange-500/30 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-4xl h-[400px] rounded-full bg-[#FF6600]/15 blur-[120px] -z-10 pointer-events-none" />

            <div className="max-w-[1300px] mx-auto px-6 md:px-12 relative z-10">
                
                {/* Header Section */}
                <div className="mb-24">
                    <div className="text-5xl md:text-[80px] font-bold leading-[1.1] tracking-[-0.03em] text-white">
                        Everything{' '}
                        <span className="inline-flex items-center justify-between border border-white/20 rounded-xl px-5 py-2 md:px-6 md:py-3 mb-2 md:mb-0 align-middle">
                            <span>creators</span>
                            
                        </span>
                        <br />
                        love about OKVEVO
                    </div>
                </div>

                {/* Content Grid */}
                <div className="flex flex-col lg:flex-row gap-16 lg:gap-32">
                    
                    {/* Left side: Category and List */}
                    <div className="w-full lg:w-[45%] flex flex-col md:flex-row gap-8 lg:gap-16 pt-2">
                        
                        {/* Category Label */}
                        <div className="w-full md:w-[140px] flex-shrink-0">
                           <span className="text-[#a1a1aa] text-lg font-medium">
                               Creative freedom
                           </span>
                        </div>
                        
                        {/* Feature List */}
                        <div className="flex-1 flex flex-col">
                           {steps.map((step, index) => {
                               const isActive = activeIndex === index;
                               return (
                                  <div 
                                     key={index} 
                                     onMouseEnter={() => setActiveIndex(index)}
                                     className={`cursor-pointer flex items-start justify-between group border-[#222] transition-all duration-500 ease-out border-b
                                        ${index === 0 ? 'border-t-0' : ''} 
                                        ${isActive ? 'py-10' : 'py-6 hover:border-[#444]'}
                                     `}
                                  >
                                     <div className="pr-8 h-full flex flex-col justify-center">
                                       <AnimatePresence mode="wait">
                                           {isActive ? (
                                               <motion.div 
                                                   key="active"
                                                   initial={{ opacity: 0, y: 5 }}
                                                   animate={{ opacity: 1, y: 0 }}
                                                   exit={{ opacity: 0, y: -5 }}
                                                   transition={{ duration: 0.3 }}
                                                   className="text-white text-xl md:text-[22px] leading-[1.4] font-medium"
                                               >
                                                   {step.fullText}
                                               </motion.div>
                                           ) : (
                                               <motion.div 
                                                   key="inactive"
                                                   initial={{ opacity: 0 }}
                                                   animate={{ opacity: 1 }}
                                                   exit={{ opacity: 0 }}
                                                   className="text-[#a1a1aa] text-base md:text-[17px] font-medium group-hover:text-[#e1e1e1] transition-colors"
                                               >
                                                   {step.shortTitle}
                                               </motion.div>
                                           )}
                                       </AnimatePresence>
                                     </div>
                                     
                                     {/* Arrow icon shown if inactive */}
                                     {isActive ? null : (
                                        <div className="mt-0 flex-shrink-0">
                                            <ArrowRight className="w-[18px] h-[18px] text-[#555] group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                                        </div>
                                     )}
                                  </div>
                               )
                           })}
                        </div>
                    </div>

                    {/* Right side: Image Display */}
                    <div className="w-full lg:w-[55%] h-[400px] md:h-[600px] relative rounded-[24px] overflow-hidden bg-[#080808] border border-[#1a1a1a]">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={activeIndex}
                                initial={{ opacity: 0, scale: 1.02 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent flex items-center justify-center p-8 md:p-16"
                            >
                                <div className="relative w-full h-full">
                                    <Image 
                                        src={steps[activeIndex].img} 
                                        alt={steps[activeIndex].shortTitle}
                                        fill
                                        className="object-contain drop-shadow-2xl"
                                        priority
                                    />
                                </div>
                            </motion.div>
                        </AnimatePresence>
                        
                        {/* Made in OKVEVO Badge */}
                        <div className="absolute bottom-6 right-6 px-4 py-2 rounded-full bg-[#111]/80 backdrop-blur-md border border-white/10 flex items-center gap-2">
                            <div className="w-[18px] h-[18px] rounded-full bg-black flex items-center justify-center border border-[#333]">
                                <div className="w-[10px] h-[10px] rounded-full bg-orange-500" />
                            </div>
                            <span className="text-xs font-semibold tracking-wide text-white/90">Made in OKVEVO</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
