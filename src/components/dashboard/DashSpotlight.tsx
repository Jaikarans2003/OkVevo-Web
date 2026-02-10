'use client';

import { motion } from 'framer-motion';

const topCreators = [
    { name: "@alex_edit", color: "bg-purple-500" },
    { name: "@sarah.vlogs", color: "bg-pink-500" },
    { name: "@mike_moves", color: "bg-blue-500" },
    { name: "@create_daily", color: "bg-green-500" },
    { name: "@visual_flow", color: "bg-yellow-500" },
    { name: "@edit_hub", color: "bg-red-500" },
    { name: "@pixel_art", color: "bg-indigo-500" },
];

const DashSpotlight = () => {
    return (
        <section className="relative py-24 bg-[#050505] overflow-hidden border-t border-white/5">
            <div className="container mx-auto px-6 mb-12 text-center">
                <span className="text-xs font-black uppercase tracking-[0.3em] text-white/50 mb-4 block">Community Spotlight</span>
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">
                    Top Creators <br /> This Week
                </h2>
            </div>

            {/* Marquee Container */}
            <div className="relative flex overflow-x-hidden group">
                {/* Gradient Masks */}
                <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />

                {/* Scrolling Content - Duplicated for seamless loop */}
                <motion.div
                    className="flex gap-8 py-4 w-max"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{
                        repeat: Infinity,
                        ease: "linear",
                        duration: 20
                    }}
                >
                    {[...topCreators, ...topCreators].map((creator, index) => (
                        <div key={index} className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-full px-8 py-4 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-pointer">
                            <div className={`w-10 h-10 rounded-full ${creator.color} shadow-lg`} />
                            <span className="text-lg font-bold text-white tracking-tight">{creator.name}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default DashSpotlight;
