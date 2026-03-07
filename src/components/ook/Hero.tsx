'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Play, Sparkles, UserCheck } from 'lucide-react';

interface HeroProps {
    onJoinClick: () => void;
}

const services = [
    {
        id: 'product-ads',
        title: 'AI Product Ads',
        description: 'Create cinematic product showcases in seconds.',
        video: '/videos/aiproduct.mp4',
        icon: <Sparkles className="w-5 h-5" />,
    },
    {
        id: 'script-video',
        title: 'Script-to-Video',
        description: 'Transform text stories into high-fidelity visuals.',
        video: '/videos/script.mp4',
        icon: <Play className="w-5 h-5" />,
    },
    {
        id: 'ai-influencers',
        title: 'AI Influencers',
        description: 'Scale your brand with digital-human ambassadors.',
        video: '/videos/influencer.mp4',
        icon: <UserCheck className="w-5 h-5" />,
    },
];

const Hero = ({ onJoinClick }: HeroProps) => {
    const [activeService, setActiveService] = useState(services[0]);

    return (
        <section className="relative min-h-screen bg-black">
            {/* Top Text Section with Soft Glow */}
            <div className="relative pt-32 pb-12 px-6 overflow-hidden text-white flex flex-col items-center justify-center min-h-[50vh]">
                {/* Highly Visible Orange Glow Background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-5xl h-[300px] md:h-[500px] rounded-full bg-[#FF6600]/40 blur-[100px] md:blur-[140px] -z-10 pointer-events-none" />

                <div className="max-w-7xl mx-auto flex flex-col items-center text-center w-full z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full flex flex-col items-center relative"
                    >
                        <h1 className="mt-6 text-[5rem] md:text-[10rem] tracking-tight flex flex-col items-center leading-[0.9] pb-12 md:pb-24 relative z-10 font-bold">
                            <span className="text-white relative z-20 px-8">Zero Camera,</span>
                            <span className="text-cursive italic text-accent-orange text-[6.5rem] md:text-[13rem] -mt-2 md:-mt-4 lowercase relative z-10 font-medium">Infinite Vision.</span>
                        </h1>


                    </motion.div>
                </div>
            </div>

            {/* Video Showcase Section */}
            <div data-section-theme="dark" className="relative px-4 pb-12 md:px-6 md:pb-20 bg-black">
                <div className="relative aspect-[16/9] w-full max-h-[80vh] rounded-[2.5rem] md:rounded-[4rem] overflow-hidden group border border-white/5 bg-black shadow-2xl">
                    {/* Background Video Transitions */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeService.id}
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0 w-full h-full"
                        >
                            <video
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover"
                                src={activeService.video}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        </motion.div>
                    </AnimatePresence>

                    {/* Content Overlay */}
                    <div className="absolute inset-0 flex flex-col justify-between p-8 md:p-16 lg:p-20">
                        {/* Empty spacing for branding/top elements if needed */}
                        <div />

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
                            {/* Left: Headline & Primary Action */}
                            <div className="lg:col-span-12 space-y-6">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeService.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.5 }}
                                        className="max-w-4xl"
                                    >
                                        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[0.95] tracking-tight mb-4">
                                            {activeService.title}
                                        </h2>
                                        <p className="text-lg md:text-xl text-white/60 font-medium max-w-xl">
                                            {activeService.description}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>

                                <div className="flex flex-wrap items-center gap-4">
                                    <button
                                        onClick={onJoinClick}
                                        className="bg-white text-black px-10 py-5 rounded-full font-bold flex items-center gap-2 hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        Try Now
                                        <ArrowUpRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vertical Service Navigation (Right Side) */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-3 z-30">
                        {services.map((service) => (
                            <button
                                key={service.id}
                                onMouseEnter={() => setActiveService(service)}
                                className={`group flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 border
                                    ${activeService.id === service.id
                                        ? 'bg-white/10 backdrop-blur-xl border-white/20 shadow-xl'
                                        : 'bg-black/20 backdrop-blur-sm border-transparent hover:bg-white/5'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                                    ${activeService.id === service.id ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                                    {service.icon}
                                </div>
                                <div className="text-left">
                                    <p className={`text-sm font-bold transition-colors ${activeService.id === service.id ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
                                        {service.title}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile Service Selector */}
                <div className="lg:hidden mt-6 bg-black p-4 rounded-3xl grid grid-cols-3 gap-2">
                    {services.map((service) => (
                        <button
                            key={service.id}
                            onClick={() => setActiveService(service)}
                            className={`p-3 rounded-2xl text-[10px] font-bold transition-all border
                                ${activeService.id === service.id
                                    ? 'bg-white/10 border-white/20 text-white'
                                    : 'bg-white/5 border-transparent text-white/40'}`}
                        >
                            {service.title.split(' ')[0]}
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Hero;
