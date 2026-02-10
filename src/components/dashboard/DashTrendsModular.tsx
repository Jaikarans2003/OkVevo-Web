'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';
import { Instagram, Star, Sparkles, Music, ChevronRight, Zap, ArrowUpRight } from 'lucide-react';

const trends = [
    {
        title: "Day in Life",
        category: "Vlog Template",
        icon: <Instagram className="w-12 h-12 text-white" />,
        stats: "1.2M Uses",
        color: "bg-[#FF4D4D]", // Solid Red
        textColor: "text-white"
    },
    {
        title: "2024 Recap",
        category: "Compilation",
        icon: <Sparkles className="w-12 h-12 text-white" />,
        stats: "850K Reels",
        color: "bg-[#9B4DFF]", // Solid Purple
        textColor: "text-white"
    },
    {
        title: "Gym Motivation",
        category: "Fitness",
        icon: <Zap className="w-12 h-12 text-black" />,
        stats: "2.5M Uses",
        color: "bg-[#E2FF4D]", // Solid Lime
        textColor: "text-black"
    },
    {
        title: "Travel Dump",
        category: "Lifestyle",
        icon: <Star className="w-12 h-12 text-white" />,
        stats: "500K Saves",
        color: "bg-[#4D79FF]", // Solid Blue
        textColor: "text-white"
    },
    {
        title: "GRWM Fast",
        category: "Fashion",
        icon: <Music className="w-12 h-12 text-black" />,
        stats: "1M+ Views",
        color: "bg-white", // Solid White
        textColor: "text-black"
    }
];

const DashTrendsModular = () => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = direction === 'left' ? -400 : 400;
            scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <section className="relative min-h-[60vh] bg-[#050505] text-white overflow-hidden pt-48 pb-24 flex flex-col justify-center border-t border-white/5">

            <div className="container px-6 mx-auto mb-5 flex items-end justify-between relative z-10">
                <div>
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-white/50 mb-4 block">Viral Radar</span>
                    <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9]">
                        Trending on <br />
                        {/* Cursive Instagram with Gradient */}
                        <span
                            className="font-cursive text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500"
                            style={{ fontFamily: '"Dancing Script", cursive' }} // Simple cursive fallback
                        >
                            Instagram
                        </span>
                    </h2>
                </div>

                <div className="hidden md:flex gap-2">
                    <button
                        onClick={() => scroll('left')}
                        className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-colors"
                    >
                        <ChevronRight className="rotate-180" size={20} />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Horizontal Scroll Container - Reduced pt for tighter layout but kept safely for hover */}
            <div
                ref={scrollContainerRef}
                className="w-full overflow-x-auto pb-12 pt-20 scrollbar-hide"
            >
                <div className="flex gap-6 px-6 md:px-0 w-max md:ml-[max(2rem,calc((100vw-1200px)/2))]">
                    {trends.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            whileHover={{ y: -10 }}
                            className={`w-[280px] md:w-[320px] aspect-[4/5] rounded-[40px] relative overflow-hidden group cursor-pointer ${item.color} shadow-2xl flex flex-col justify-between p-8`}
                        >
                            {/* Top Content */}
                            <div className="flex justify-between items-start">
                                <div className={`p-4 rounded-full bg-black/10 backdrop-blur-md border border-black/5`}>
                                    {item.icon}
                                </div>
                                <ArrowUpRight size={24} className={`${item.textColor} opacity-50 group-hover:opacity-100 transition-opacity`} />
                            </div>

                            {/* Bottom Content */}
                            <div>
                                <div className={`inline-block px-3 py-1 rounded-full bg-black/10 backdrop-blur-md border border-black/5 mb-4`}>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${item.textColor}`}>{item.category}</span>
                                </div>
                                <h3 className={`text-4xl font-black tracking-tighter leading-[0.9] mb-2 ${item.textColor}`}>{item.title}</h3>
                                <p className={`text-sm font-bold opacity-70 ${item.textColor}`}>{item.stats}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Load Google Font for Cursive */}
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');
                .font-cursive {
                    font-family: 'Dancing Script', cursive;
                }
            `}</style>
        </section>
    );
};

export default DashTrendsModular;
