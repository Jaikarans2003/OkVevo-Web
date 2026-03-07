'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import TubesBackground from '@/components/TubesBackground';

interface HeroProps {
    onJoinClick: () => void;
}

const Hero = ({ onJoinClick }: HeroProps) => {
    return (
        <section data-section-theme="dark" className="relative min-h-screen overflow-hidden">
            <TubesBackground enableClickInteraction={true}>
                <div className="relative min-h-screen pt-48 pb-20 flex flex-col items-center pointer-events-none">
                    {/* Massive Cuberto-style Heading */}
                    <div className="container relative z-10 flex flex-col items-center text-center px-6 mb-20 pointer-events-auto">
                <motion.h1
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="text-[12vw] md:text-[10vw] leading-[0.85] tracking-[-0.06em] text-white max-w-[12ch] relative"
                    style={{ fontFamily: '"MuseoModerno"', fontOpticalSizing: 'auto', fontWeight: 700 }}
                >
                    Zero Canvas, Infinite Vision
                </motion.h1>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-12 max-w-2xl"
                >
                    <p className="text-xl md:text-2xl text-white/70 font-medium leading-tight">
                        Turn ideas into stories that move.
                    </p>
                </motion.div>
                    </div>
                    
                    {/* Sub-description Grid below visual */}
                    <div className="container px-6 md:px-12 mt-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-end pointer-events-auto">
                        <motion.div
                            whileHover={{ x: 10 }}
                            onClick={onJoinClick}
                            className="flex items-center gap-6 cursor-pointer group"
                        >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:bg-accent-orange group-hover:border-accent-orange group-hover:text-white transition-all duration-500">
                        <ArrowRight size={24} />
                    </div>
                    <div>
                        <p className="text-xl font-bold tracking-tight text-white">
                            Start Your <br /> Digital Journey
                        </p>
                        <span className="text-[10px] font-black tracking-widest uppercase text-accent-orange opacity-0 group-hover:opacity-100 transition-opacity">Apply Now</span>
                    </div>
                </motion.div>
                        <div className="text-left md:text-right">
                            <p className="text-white/60 font-medium max-w-sm ml-auto">
                                Our technology allows creators to bypass traditional production
                                bottlenecks and focus purely on the vision.
                            </p>
                        </div>
                    </div>
                </div>
            </TubesBackground>
        </section>
    );
};

export default Hero;
