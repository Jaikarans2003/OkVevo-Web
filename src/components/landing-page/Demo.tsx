'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import ButtonWithIconDemo from '@/components/ui/button-with-icon';
import { env } from '@/config/env';

const Showcase = () => {
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
                             <span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">Go from</span> lecture
                             to <span className="bg-gradient-to-r from-orange-500 to-orange-400 bg-clip-text text-transparent">LMS-ready </span>
                             with OKVEVO
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
                            Upload a lecture recording and Nia automatically creates an educational video with animations, captions, and visual explanations. Edit anything using natural language, no timeline or prompts required.
                        </motion.p>
                        <div className="pt-4">
                            <Link href="/workspace">
                                <ButtonWithIconDemo />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Video Player */}
                <div className="mt-8">
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-gradient-to-r from-[#FF6B35]/20 via-orange-500/10 to-[#FF6B35]/20 blur-3xl rounded-[30px] opacity-60 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform-gpu" />
                        
                        <div className="relative z-10 w-full h-[400px] md:h-[450px] lg:h-[700px] rounded-[24px] overflow-hidden bg-[#080808] border border-[#1a1a1a] group-hover:border-white/10 shadow-[0_0_40px_rgba(255,107,53,0.1)] group-hover:shadow-[0_0_80px_rgba(255,107,53,0.2)] transition-all duration-700">
                            <div className="relative w-full h-full">
                                <video
                                    src={env.demoVideoUrl || undefined}
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
                    </div>
                </div>

            </div>
        </section>
    );
};

export default Showcase;
