import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Play, ImageIcon, Search, X, Loader2 } from 'lucide-react';
import { TREND_DEFINITIONS, type TrendDefinition } from '@/data/trendDefinitions';

export const TrendCard = ({ trend, index, onClick }: { trend: TrendDefinition, index: number, onClick: () => void }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClick}
            className="group relative bg-[#151518] rounded-[2rem] border border-[#222] overflow-hidden cursor-pointer transition-all duration-500 hover:border-white/20 h-[420px] md:h-[480px] flex flex-col"
        >
            <div className="h-[240px] md:h-[320px] relative overflow-hidden shrink-0">
                <Image
                    src={trend.image}
                    alt={trend.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                
                {/* Type Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transform scale-90 group-hover:scale-100 transition-transform duration-500">
                        {trend.videoPrompts.length > 0 ? <Play fill="currentColor" size={24} /> : <ImageIcon size={24} />}
                    </div>
                </div>

                {/* Type badge */}
                <div className="absolute top-4 right-4">
                    <div className="px-2.5 py-1 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center gap-1.5">
                        {trend.videoPrompts.length > 0 ? (
                            <>
                                <Play size={10} fill="currentColor" className="text-[#FF6B35]/80" />
                                <span className="text-[10px] font-black text-[#FF6B35] uppercase tracking-wider">{trend.imagePrompts.length} Shots + Video</span>
                            </>
                        ) : (
                            <>
                                <ImageIcon size={10} className="text-white/60" />
                                <span className="text-[9px] font-black text-white/60">{trend.imagePrompts.length} Shots</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 md:p-8 space-y-4 flex-1 flex flex-col justify-between overflow-hidden">
                <div className="flex flex-wrap gap-2 h-6 items-start overflow-hidden shrink-0">
                    {trend.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-white/30">
                            #{tag}
                        </span>
                    ))}
                </div>
                <div className="flex-1 flex flex-col justify-center overflow-hidden">
                    <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mb-2 group-hover:text-white transition-colors line-clamp-1 shrink-0">
                        {trend.title}
                    </h3>
                    <p className="text-[10px] md:text-xs text-white/40 font-medium leading-relaxed line-clamp-2">
                        {trend.description}
                    </p>
                </div>
            </div>

            {/* Subtle Inner Glow on Hover */}
            <div className="absolute inset-0 border-2 border-white/0 group-hover:border-white/5 transition-colors duration-500 pointer-events-none rounded-[2.5rem]" />
        </motion.div>
    );
};

const TrendGrid = ({ onSelect }: { onSelect: (trend: TrendDefinition) => void }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTrends = TREND_DEFINITIONS.filter(trend =>
        trend.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trend.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <section id="trends" className="max-w-7xl mx-auto px-6 py-24 overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                <div className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                        Trend <span className="text-white/20">Studio</span>
                    </h2>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest shrink-0">
                        Showing {filteredTrends.length} of {TREND_DEFINITIONS.length}
                    </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-96 group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Loader2 className="w-8 h-8 text-[#FF6B35]/40 animate-spin" />
                    </div>
                    <input
                        type="text"
                        placeholder="SEARCH TRENDS..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-[10px] font-black tracking-[0.2em] text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all uppercase"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-4 flex items-center hover:shadow-lg hover:shadow-[#FF6B35]/25 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4 text-white/30 hover:text-white transition-colors" />
                        </button>
                    )}
                </div>
            </div>

            {/* Trends Row */}
            <div className="space-y-8 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-orange-500 flex items-center gap-3">
                        <Play size={14} fill="currentColor" />
                        Available Trends
                    </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {filteredTrends.map((trend, idx) => (
                        <TrendCard key={trend.id} trend={trend} index={idx} onClick={() => onSelect(trend)} />
                    ))}
                    {filteredTrends.length === 0 && (
                        <div className="col-span-full py-12 text-center text-white/20 text-xs font-black uppercase tracking-widest">No trends found</div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default TrendGrid;
