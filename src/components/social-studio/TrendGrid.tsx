import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Play, ImageIcon, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Trend {
    id: string;
    title: string;
    description: string;
    image: string;
    tags: string[];
    type: 'video' | 'image';
}

export const TrendCard = ({ trend, index, onClick }: { trend: Trend, index: number, onClick: () => void }) => {
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
                    className="object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#151518] via-transparent to-transparent opacity-60" />

                {/* Type Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transform scale-90 group-hover:scale-100 transition-transform duration-500">
                        {trend.type === 'video' ? <Play fill="currentColor" size={24} /> : <ImageIcon size={24} />}
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

const TrendGrid = ({ onSelect }: { onSelect: (trend: Trend) => void }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const scrollAmount = 400;
        scrollRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    const trends: Trend[] = [
        {
            id: '1',
            title: 'Neural Glow',
            description: 'Dynamic lighting shifts and ethereal aura synthesis for fashion reels.',
            image: 'https://images.unsplash.com/photo-1649937801620-d31db7fb3ab3?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8bmV1cmFsJTIwZ2xvd3xlbnwwfHwwfHx8MA%3D%3D',
            tags: ['ReelTrend', 'ViralEdit', 'Fashion'],
            type: 'video'
        },
        {
            id: '2',
            title: 'CyberFlow',
            description: 'Transform portraits into high-end cyberpunk cinematics.',
            image: 'https://i.pinimg.com/736x/7d/d2/c1/7dd2c173e396bc75f34f1ff3acd07730.jpg',
            tags: ['Cyberpunk', 'Cinematic', 'AI'],
            type: 'video'
        },
        {
            id: '3',
            title: 'Expansion',
            description: 'Expand your photos into immersive landscapes using neural fill.',
            image: 'https://images.unsplash.com/photo-1634942537040-f7ba41298016?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGluc3RhZ3JhbSUyMHRyZW5kc3xlbnwwfHwwfHx8MA%3D%3D',
            tags: ['AIExpansion', 'Landscape', 'Viral'],
            type: 'image'
        },
        {
            id: '4',
            title: 'Prism Drift',
            description: 'Kaleidoscopic lens flares and dreamlike motion for artistic storytelling.',
            image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&auto=format&fit=crop&q=60',
            tags: ['Abstract', 'Motion', 'Story'],
            type: 'video'
        },
        {
            id: '5',
            title: 'Grain Motion',
            description: 'Retro 8mm film aesthetics with intelligent frame synthesis.',
            image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900&auto=format&fit=crop&q=60',
            tags: ['Retro', 'Vintage', 'Film'],
            type: 'image'
        },
        {
            id: '6',
            title: 'Voxel Rush',
            description: 'Turn organic motion into block-based 3D digital artifacts.',
            image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900&auto=format&fit=crop&q=60',
            tags: ['3D', 'Digital', 'Voxel'],
            type: 'image'
        },
        {
            id: '7',
            title: 'Aero Static',
            description: 'Low-gravity character physics with high-altitude atmospheric lighting.',
            image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900&auto=format&fit=crop&q=60',
            tags: ['Physics', 'Space', 'Future'],
            type: 'video'
        },
        {
            id: '8',
            title: 'Shadow Synth',
            description: 'Project neural shadows that react to virtual light sources in real-time.',
            image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=900&auto=format&fit=crop&q=60',
            tags: ['Shadows', 'Lighting', 'Realtime'],
            type: 'image'
        }
    ];

    const filteredTrends = trends.filter(trend =>
        trend.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trend.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const videoTrends = filteredTrends.filter(t => t.type === 'video');
    const imageTrends = filteredTrends.filter(t => t.type === 'image');

    const videoScrollRef = useRef<HTMLDivElement>(null);
    const imageScrollRef = useRef<HTMLDivElement>(null);

    const scrollSpecific = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
        if (!ref.current) return;
        const scrollAmount = 400;
        ref.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    return (
        <section id="trends" className="max-w-7xl mx-auto px-6 py-24 overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                <div className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                        Trending <span className="text-white/20">Studio</span>
                    </h2>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest shrink-0">
                        Showing {filteredTrends.length} of {trends.length} Presets
                    </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-96 group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-white/30 group-focus-within:text-white transition-colors" />
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
                            className="absolute inset-y-0 right-4 flex items-center"
                        >
                            <X className="w-4 h-4 text-white/30 hover:text-white transition-colors" />
                        </button>
                    )}
                </div>
            </div>

            {/* Video Trends Row */}
            <div className="space-y-8 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[#FF0080] flex items-center gap-3">
                        <Play size={14} fill="currentColor" />
                        Video Trends
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => scrollSpecific(videoScrollRef, 'left')}
                            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all text-white/40 hover:text-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => scrollSpecific(videoScrollRef, 'right')}
                            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all text-white/40 hover:text-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
                <div
                    ref={videoScrollRef}
                    className="flex gap-6 md:gap-8 overflow-x-auto overflow-y-hidden scrollbar-hide -mx-6 px-6 snap-x snap-mandatory touch-pan-x"
                >
                    {videoTrends.map((trend, idx) => (
                        <div key={trend.id} className="min-w-[280px] md:min-w-[340px] flex-shrink-0 snap-start">
                            <TrendCard trend={trend} index={idx} onClick={() => onSelect(trend)} />
                        </div>
                    ))}
                    {videoTrends.length === 0 && (
                        <div className="w-full py-12 text-center text-white/20 text-xs font-black uppercase tracking-widest">No video trends found</div>
                    )}
                </div>
            </div>

            {/* Image Trends Row */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white flex items-center gap-3">
                        <ImageIcon size={14} />
                        Image Trends
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => scrollSpecific(imageScrollRef, 'left')}
                            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all text-white/40 hover:text-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => scrollSpecific(imageScrollRef, 'right')}
                            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all text-white/40 hover:text-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
                <div
                    ref={imageScrollRef}
                    className="flex gap-6 md:gap-8 overflow-x-auto overflow-y-hidden scrollbar-hide -mx-6 px-6 snap-x snap-mandatory touch-pan-x"
                >
                    {imageTrends.map((trend, idx) => (
                        <div key={trend.id} className="min-w-[280px] md:min-w-[340px] flex-shrink-0 snap-start">
                            <TrendCard trend={trend} index={idx} onClick={() => onSelect(trend)} />
                        </div>
                    ))}
                    {imageTrends.length === 0 && (
                        <div className="w-full py-12 text-center text-white/20 text-xs font-black uppercase tracking-widest">No image trends found</div>
                    )}
                </div>
            </div>

            {/* Scroll Indication Dots (Simplified for 2 rows) */}
            <div className="flex justify-center mt-12 gap-8">
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#FF0080]/60">Videos</span>
                    <div className="w-12 h-[2px] bg-[#FF0080]/20 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-[#FF0080]"
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2 }}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Images</span>
                    <div className="w-12 h-[2px] bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-white/40"
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2, delay: 0.2 }}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TrendGrid;
