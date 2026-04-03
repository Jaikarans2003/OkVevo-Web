'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Dumbbell, Plus, Zap, Activity, Eye } from 'lucide-react';
import Image from 'next/image';

const MasivHero = () => {
    return (
        <section className="bg-black text-white pt-6 pb-20 px-6 md:px-12 rounded-[50px] mx-4 md:mx-10 mb-12 overflow-hidden border border-white/5 relative">
            <div className="max-w-[1200px] mx-auto flex flex-col gap-16">

                {/* --- Top Layout Row: Sidebar, Blog, and Headline --- */}
                <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-20">
                    {/* Right Part: Main Headline & CTA */}
                    <div className="flex-1 flex flex-col md:flex-row items-end gap-12 justify-between w-full">
                        <div className="flex-1">
                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 1 }}
                                className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.85] text-white"
                            >
                                Unlimited <br />
                                <span className="text-[#FF6B35]">fitness trends</span> that <br />
                                humanize <span className="text-[#FF6B35]">your body</span>
                            </motion.h1>
                        </div>

                        <div className="flex flex-col gap-6 md:pb-2 lg:max-w-[300px]">
                            <p className="text-[10px] font-bold uppercase leading-relaxed text-white/40 border-l border-white/20 pl-4">
                                <span className="text-white">Live in Bangalore</span>. We've transformed over 1,200 members with powerful AI-driven workout visuals.
                            </p>
                            <button className="bg-[#FF6B35] text-white px-8 py-4 rounded-full flex items-center gap-4 hover:bg-[#FF451A] transition-all group w-fit">
                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest">Try Trend Now</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- 5-Column Bento Grid Row --- */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:h-[420px]">

                    {/* Column 1: Dual Info Cards */}
                     <div className="flex flex-col gap-4">
                        <div className="rounded-[30px] aspect-square flex items-center justify-center shadow-lg group relative overflow-hidden">
                            <Image
                                src="/yoga.jpeg"
                                alt="MASIV Member"
                                fill
                                sizes="(max-width: 768px) 50vw, 20vw"
                                className="object-cover rounded-[30px]"
                            />
                        </div>
                         <div className="bg-[#FF5F1F] rounded-[30px] aspect-square flex items-center justify-center shadow-lg group relative overflow-hidden">
                            <Image
                                src="/gym-avatar.png"
                                alt="MASIV Member"
                                fill
                                sizes="(max-width: 768px) 50vw, 20vw"
                                className="object-contain mt-2 rounded-[30px]"
                            />
                        </div>
                    </div>
                    {/* Column 2: Tall Action Photo */}
                    <div className="bg-[#1A1A1A] rounded-[35px] overflow-hidden group shadow-2xl lg:h-full h-[350px] relative">
                        <Image
                            src="/masiv_ai_fitness.png"
                            alt="Fitness Professional"
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover group-hover:scale-110 transition-all duration-1000"
                        />
                    </div>

                    {/* Column 3: Red Sparkle + Tech Waveform */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-[#FF0000] rounded-[30px] aspect-square flex items-center justify-center shadow-lg group relative overflow-hidden">
                            <Image
                                src="/gym.png"
                                alt="MASIV Member"
                                fill
                                sizes="(max-width: 768px) 50vw, 20vw"
                                className="object-contain rounded-[30px]"
                            />
                        </div>
                         <div className="bg-[#FF4D6D] rounded-[30px] aspect-square flex items-center justify-center shadow-lg group relative overflow-hidden">
                            <Image
                                src="/booth.png"
                                alt="MASIV Member"
                                fill
                                sizes="(max-width: 768px) 50vw, 20vw"
                                className="object-contain rounded-[30px]"
                            />
                        </div>
                    </div>

                    {/* Column 4: App Card + Featured Member */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-[#BF00FF] rounded-[30px] aspect-square flex items-center justify-center shadow-lg group relative overflow-hidden">
                            <Image
                                src="/weight.png"
                                alt="MASIV Member"
                                fill
                                sizes="(max-width: 768px) 50vw, 20vw"
                                className="object-contain rounded-[30px]"
                            />
                        </div>
                        <div className="bg-black/90 rounded-[30px] flex-1 overflow-hidden group relative">
                            <Image
                                src="/masiv_cyber_athlete.png"
                                alt="MASIV Member"
                                fill
                                sizes="(max-width: 768px) 50vw, 20vw"
                                className="object-cover brightness-75 group-hover:scale-110 transition-all duration-700"
                            />
                            {/* Purple Overlay */}
                            {/* <div className="absolute inset-0 bg-purple-600/20 mix-blend-color group-hover:bg-purple-600/10 transition-colors" /> */}
                        </div>
                    </div>

                    {/* Column 5: Large Text Card + Wavy Energy */}
                    <div className="bg-[#151515] rounded-[35px] flex flex-col p-6 border border-white/5 shadow-2xl h-full overflow-hidden relative">
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="flex flex-col">
                                <span className="text-[#FF6B35] text-xs font-black uppercase tracking-widest mb-2">Member Success</span>
                                <h3 className="text-white text-2xl md:text-2xl font-black leading-none tracking-tighter">
                                    50+ SUCCESSFUL <br />
                                    <span className="text-white/40 tracking-normal">TRANSFORMS</span>
                                </h3>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 overflow-hidden relative">
                                            <Image src={`https://i.pravatar.cc/100?u=success_${i}`} alt="user" fill sizes="32px" className="object-cover" />
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6B35]">Check them out</span>
                            </div>
                        </div>

                        {/* Wavy Pattern at bottom */}
                        <div className="absolute inset-x-0 bottom-0 h-1/2 flex items-end pointer-events-none">
                            <div className="w-full h-full flex justify-between px-2 pb-4">
                                {[...Array(15)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        className="w-1.5 bg-gradient-to-t from-[#FF6B35] to-transparent rounded-full"
                                        animate={{ height: ['20%', '100%', '20%'] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default MasivHero;
