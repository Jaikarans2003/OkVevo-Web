'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Sparkles, Zap, Target } from 'lucide-react';

const FeaturedShows = () => {
    return (
        <section className="bg-white text-black py-24 px-6 md:px-12 rounded-[50px] mx-4 md:mx-10 mb-12 shadow-sm border border-black/5 overflow-hidden">
            <div className="max-w-[1400px] mx-auto">
                
                {/* Header Row */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-xl font-bold font-serif opacity-30 tracking-tighter">02</span>
                            <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                        </div>
                        <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-none pr-4 text-black">
                            Explore Trending <br /> AI Fitness Styles
                        </h2>
                    </div>
                    
                    <div className="max-w-md pb-2">
                        <p className="text-lg font-medium leading-relaxed text-black/60 border-l-2 border-[#FF6B35] pl-6 py-2">
                            <span className="text-[#FF6B35]">Our booth features 15+ custom</span> styles designed specifically for MASIV members. Transform your gym selfies into cinematic masterpieces.
                        </p>
                    </div>
                </div>

                {/* Show Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 h-auto lg:h-[550px]">
                    
                    {/* Card 1: Cinematic Glow */}
                    <motion.div 
                        whileHover={{ y: -10 }}
                        className="bg-[#F8F8F8] rounded-[40px] p-8 flex flex-col h-full group border border-black/5"
                    >
                        <div className="w-full aspect-[4/3] rounded-[30px] overflow-hidden mb-8 relative">
                             <img 
                                src="https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&q=80" 
                                alt="Cinematic Style" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                            />
                            <div className="absolute inset-0 bg-black/40" />
                            <div className="absolute top-4 left-4 bg-[#FF6B35] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white">Popular</div>
                        </div>
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="text-2xl font-black tracking-tight mb-4 text-black">Cinematic Glow</h3>
                                <p className="text-black/50 font-medium leading-relaxed mb-6">
                                    Enhance your workouts with <span className="text-[#FF6B35] font-bold">dramatic lighting</span> and premium color grading techniques.
                                </p>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="font-black text-sm uppercase tracking-widest text-black/60 group-hover:text-black transition-colors cursor-pointer">Preview Style</span>
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-black/5 group-hover:bg-[#FF6B35] group-hover:text-white transition-colors cursor-pointer">
                                    <ArrowUpRight className="w-5 h-5 text-black group-hover:text-white" />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Card 2: Cyber Athlete (Orange/Purple) */}
                    <motion.div 
                        whileHover={{ y: -10 }}
                        className="bg-gradient-to-br from-[#FF6B35] to-[#7D53FF] rounded-[40px] p-8 flex flex-col h-full group relative overflow-hidden shadow-lg"
                    >
                        {/* Author/Featured Member Header */}
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/50">
                                <img src="https://i.pravatar.cc/100?u=fitness_pro" alt="Trainer" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/70 leading-none mb-1">Style Designer</span>
                                <span className="text-sm font-bold text-white uppercase tracking-tighter text-shadow-sm">MASIV Creative Team</span>
                            </div>
                        </div>

                        {/* Middle Visual Element */}
                        <div className="flex-1 flex items-center justify-center relative z-10 py-4">
                            <motion.svg viewBox="0 0 200 200" className="w-full max-w-[220px] text-white">
                                <motion.path 
                                    d="M40,160 C100,160 160,100 160,40 C160,10 100,10 80,60 C60,110 140,140 40,40" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="8" 
                                    strokeLinecap="round" 
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 2, ease: "easeOut" }}
                                />
                            </motion.svg>
                        </div>

                        {/* Card Info */}
                        <div className="relative z-10">
                            <h3 className="text-3xl font-black tracking-tight mb-4 text-white">Cyber Athlete</h3>
                            <p className="text-white/80 font-medium leading-relaxed mb-6">
                                Futuristic neon overlays and cyberpunk aesthetics for high-energy gym content.
                            </p>
                            <div className="flex justify-between items-center">
                                <span className="font-black text-sm uppercase tracking-widest text-white/90 group-hover:text-white transition-colors cursor-pointer">Try Style</span>
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white group-hover:text-[#FF6B35] transition-colors cursor-pointer">
                                    <ArrowUpRight className="w-5 h-5 text-white group-hover:text-[#FF6B35]" />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Card 3: Performance Trio */}
                    <div className="flex flex-col gap-8 h-full">
                        {/* Upper Small Card: Vector Prime */}
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            className="bg-white border border-black/5 rounded-[40px] p-8 flex-1 flex flex-col justify-between shadow-sm group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-2xl font-black tracking-tight text-black lg:max-w-[150px]">Vector Prime</h3>
                                <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-[#FF6B35] transition-colors">
                                    <Target className="w-4 h-4 text-black group-hover:text-white" />
                                </div>
                            </div>
                            <p className="text-black/50 font-medium leading-[1.4] pr-4">
                                Transform your images into <span className="text-[#FF6B35]">minimalist vector art</span> while maintaining your unique workout form.
                            </p>
                            <div className="flex justify-between items-end mt-4">
                                <span className="font-black text-sm uppercase tracking-widest text-black/60 group-hover:text-black transition-colors cursor-pointer">Load More</span>
                                <div className="w-10 h-10 rounded-full bg-white border border-black/10 flex items-center justify-center group-hover:bg-[#FF6B35] group-hover:text-white transition-colors cursor-pointer shadow-sm">
                                    <ArrowUpRight className="w-5 h-5 text-black group-hover:text-white" />
                                </div>
                            </div>
                        </motion.div>

                        {/* Lower Small Card (Energy CTA) */}
                        <motion.div 
                            whileHover={{ scale: 1.02 }}
                            className="bg-[#F8F8F8] border border-black/5 rounded-[40px] p-8 h-[160px] flex items-center justify-between group overflow-hidden relative"
                        >
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="w-16 h-16 rounded-3xl bg-[#FF6B35] flex items-center justify-center shadow-[0_5px_20px_rgba(255,107,53,0.3)]">
                                    <Zap className="w-8 h-8 text-white" />
                                </div>
                                <p className="text-base font-black text-black leading-tight max-w-[160px]">
                                    Unleash your potential with AI-driven visuals.
                                </p>
                            </div>
                            {/* Visual Arrow Background */}
                            <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ArrowUpRight size={160} strokeWidth={4} color="#FF6B35" />
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default FeaturedShows;
