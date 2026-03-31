'use client';

import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ShoppingCart, Upload, Check, Trash2, Search, Sparkles, Play, ArrowUpRight, ArrowRight, ArrowLeft, Camera, RotateCcw, ChevronDown } from 'lucide-react';
import { db, storage } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import FeaturedShows from '@/components/masiv/FeaturedShows';
import Link from 'next/link';
import SessionStatus from '@/components/booth/SessionStatus';
import { 
  createPhotoRequest, 
  listenToResponse, 
  resetSession, 
  joinSession,
  isCameraConnected,
  PhotoResponse 
} from '@/lib/boothSession';

// Razorpay TypeScript declaration
declare global {
    interface Window {
        Razorpay: any;
    }
}

interface MasivProduct {
    id: string;
    name: string;
    type: 'photo' | 'video'
    thumbnails: string[];
    description: string;
    price: number;
    badge1: string;
    badge2: string;
    level?: number;
}

interface MasivBanner {
    id: string;
    title: string;
    description: string;
    mediaUrl: string;
    type: 'photo' | 'video';
    badge: string;
    level: number;
}

 
const isVideo = (url: string) => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('.mp4') || lowerUrl.includes('.webm') || lowerUrl.includes('.mov');
};

const bgColors = [
    'bg-[#FF6A00]', // Bright Orange
    'bg-[#F5F1E8]', // Cream
    'bg-[#E5E5E5]', // Grey
    'bg-[#E5E5E5]',//Grey
    'bg-[#FF6A00]', // Bright Orange
    'bg-[#F5F1E8]', // Cream
    
];

interface CartItem {
    id: string;
    name: string;
    price: number;
    trendType: string;
    fullBodyImageUrl: string;
    faceImageUrl: string | null;
}

const ThumbnailScroller = memo(({ images, isHovered, isMuted = true, onVideoClick }: { images: string[], isHovered?: boolean, isMuted?: boolean, onVideoClick?: (e: React.MouseEvent) => void }) => {
    const [index, setIndex] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        // ROTATION: Automatic change every 5 seconds regardless of hover
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % images.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [images.length]);

    useEffect(() => {
        // Update muted state when prop changes
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
        }
    }, [isMuted]);

    const getLabel = (idx: number) => {
        if (images.length === 2) return idx === 0 ? "MALE" : "FEMALE";
        return `PREVIEW ${idx + 1}`;
    };

    const mediaUrl = images[index];
    const isMediaVideo = isVideo(mediaUrl);
    // REMOVED fragment to avoid Error 208 on certain devices
    const sourceUrl = mediaUrl;
    
    // Debug logging
    if (isMediaVideo) {
        console.log('🎬 Rendering video:', {
            url: sourceUrl,
            isVideo: isMediaVideo,
            urlLength: sourceUrl.length,
            hasToken: sourceUrl.includes('token='),
            hasAltMedia: sourceUrl.includes('alt=media')
        });
    }

    return (
        <div className="w-full h-full relative bg-[#0a0a0a] overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={sourceUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full flex items-center justify-center"
                >
                    {isMediaVideo ? (
                        <video 
                            ref={videoRef}
                            key={sourceUrl}
                            src={sourceUrl}
                            autoPlay
                            muted={isMuted}
                            loop 
                            playsInline 
                            preload="auto"
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={onVideoClick}
                            onError={(e) => {
                                console.error('❌ Video failed to load:', sourceUrl);
                                const error = e.currentTarget.error;
                                if (error) {
                                    console.error('Error code:', error.code);
                                    console.error('Error message:', error.message);
                                }
                            }}
                            onLoadedData={() => {
                                console.log('✅ Video loaded successfully:', sourceUrl);
                            }}
                            onCanPlay={() => {
                                console.log('✅ Video can play:', sourceUrl);
                            }}
                        />
                    ) : (
                        <img 
                            src={sourceUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover" 
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Pagination Dots for Thumbnails (Sleek) */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                {images.map((_, i) => (
                    <div 
                        key={i} 
                        className={`h-1 rounded-full transition-all duration-500 ${
                            i === index ? 'w-4 bg-[#FF6B35]' : 'w-1 bg-white/20'
                        }`} 
                    />
                ))}
            </div>

            <div className="absolute top-3 left-3 z-30">
                <span className="bg-black/40 backdrop-blur-md text-[8px] font-black text-white/50 px-2 py-0.5 rounded-full border border-white/5 tracking-[0.2em] uppercase">
                    {getLabel(index)}
                </span>
            </div>
        </div>
    );
});

ThumbnailScroller.displayName = 'ThumbnailScroller';

const ProductCard = memo(({ product, index, isInCart, addToCart, setSelectedCard, playingAudioProductId, setPlayingAudioProductId }: { 
    product: MasivProduct, 
    index: number, 
    isInCart: (id: string) => boolean,
    addToCart: (p: MasivProduct) => void,
    setSelectedCard: (id: string) => void,
    playingAudioProductId: string | null,
    setPlayingAudioProductId: (id: string | null) => void
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const isMuted = playingAudioProductId !== product.id;

    const handleVideoClick = (e: React.MouseEvent) => {
        // Don't stop propagation - let the card click handler open the modal
        if (playingAudioProductId === product.id) {
            setPlayingAudioProductId(null);
        } else {
            setPlayingAudioProductId(product.id);
        }
    };
    
    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => setSelectedCard(product.id)}
            className="group relative p-4 rounded-[32px] overflow-hidden cursor-pointer flex flex-col min-h-[580px] bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.05] transition-all duration-300 transform-gpu hover:-translate-y-1"
        >
            {/* ---- TOP SECTION ---- */}
            <div className="z-10 relative flex flex-col h-[85px] shrink-0 px-1 ">
                <div className="flex gap-2 justify-between items-start mb-3 w-full">
                    <div className="flex gap-2">
                        <span className="px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase bg-white/5 text-white/50 border border-white/5 transition-colors group-hover:border-white/10 group-hover:text-white/80">
                            {product.badge1 || 'Trend'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase bg-white/5 text-white/50 border border-white/5 transition-colors group-hover:border-white/10 group-hover:text-white/80">
                            {product.badge2 || 'New'}
                        </span>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/5 transition-colors group-hover:border-white/10">
                        <img src="/OKVEVO WithOut BackGrounds/White.svg" alt="" className="h-2.5 object-contain opacity-30 group-hover:opacity-60 transition-opacity" />
                    </div>
                </div>

                <h3 className="text-xl lg:text-2xl font-black tracking-tighter leading-[1] text-white/90 group-hover:text-white transition-colors text-balance">
                    {product.name}
                </h3>
            </div>

            {/* ---- MIDDLE THUMBNAIL ---- */}
            <div className="relative w-full h-[430px] rounded-[24px] overflow-hidden z-0 shrink-0 shadow-lg group">
                <div className="w-full h-full relative">
                    <ThumbnailScroller 
                        images={product.thumbnails} 
                        isHovered={isHovered}
                        isMuted={isMuted}
                        onVideoClick={handleVideoClick}
                    />
                </div>
            </div>

            {/* ---- BOTTOM SECTION ---- */}
            <div className="z-10 w-full relative flex flex-col flex-1 mt-4 justify-end gap-3">
                <p className="text-[11px] leading-relaxed font-medium text-white/40 line-clamp-2 group-hover:text-white/60 transition-colors">
                    {product.description}
                </p>
                
                <div className="flex items-center justify-between mt-auto">
                    <div className="font-black text-xl tracking-tighter text-white/90 group-hover:text-white transition-colors">
                        {product.price === 0 ? "Free" : `₹${product.price}`}
                    </div>

                    <button
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isInCart(product.id)
                                ? 'bg-green-500/20 text-green-500 cursor-default'
                                : 'bg-white/5 text-white/40 hover:bg-[#FF6B35] hover:text-white'
                        }`}
                        disabled={isInCart(product.id)}
                        onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                        }}
                    >
                        {isInCart(product.id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
});

ProductCard.displayName = 'ProductCard';


const FeaturedCarousel = ({ items, onTryTrend }: { items: any[], onTryTrend: (product: any) => void }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % items.length);
        }, 8000); 
        return () => clearInterval(interval);
    }, [items.length]);

    return (
        <div className="relative w-full h-[600px] md:h-[700px] rounded-[32px] md:rounded-[48px] overflow-hidden group shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_150px_rgba(255,107,53,0.25)] border border-white/5 bg-[#0a0a0a]">
            {/* 1. IMMERSIVE BACKGROUND LAYER */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`bg-${index}`}
                    initial={{ opacity: 0, scale: 1.2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 z-0"
                >
                    {isVideo(items[index].image) ? (
                        <video 
                            key={items[index].image}
                            src={items[index].image} 
                            autoPlay 
                            muted
                            loop 
                            playsInline 
                            preload="auto"
                            className="w-full h-full object-cover brightness-[0.9]"
                            onError={(e) => {
                                console.error('❌ Banner video failed to load:', items[index].image);
                            }}
                            onLoadedData={() => {
                                console.log('✅ Banner video loaded:', items[index].image);
                            }}
                        />
                    ) : (
                        <img 
                            src={items[index].image} 
                            alt="" 
                            className="w-full h-full object-cover brightness-[0.7]" 
                        />
                    )}
                    {/* Dark gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                </motion.div>
            </AnimatePresence>

            {/* 2. HERO CONTENT (LEFT SIDE) */}
            <div className="absolute inset-0 z-10 flex flex-col justify-center px-8 md:px-20 max-w-4xl">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`content-${index}`}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="space-y-6 md:space-y-10"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-[2px] w-12 bg-[#FF6B35]" />
                            <span className="text-[#FF6B35] font-black tracking-[0.4em] uppercase text-[10px] md:text-xs">
                                {items[index].badge || "Global Destination"}
                            </span>
                        </div>

                        <h1 className="text-5xl md:text-[7rem] font-black leading-[0.85] text-white tracking-tighter uppercase max-w-min">
                            <span dangerouslySetInnerHTML={{ __html: items[index].title }} />
                        </h1>

                        <p className="text-white/40 text-sm md:text-lg font-medium max-w-md leading-relaxed">
                            {items[index].description || "Experience the pinnacle of creative excellence. Our global community curates only the most elite digital assets."}
                        </p>

                        <div className="flex items-center gap-8 pt-6">
                            <button className="px-8 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-white text-xs font-black tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-all duration-500 overflow-hidden group/btn">
                                <span className="relative z-10">Discover Project</span>
                            </button>
                            
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group/play cursor-pointer hover:bg-[#FF6B35] transition-all">
                                    <Play className="w-4 h-4 text-white fill-white/10" />
                                </div>
                                <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">Watch Reel</span>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* 3. INTERACTIVE THUMBNAILS (LAYOUT-DRIVEN SMOOTH TRANSITIONS) */}
            <div className="absolute bottom-10 right-12 z-20 flex items-end gap-5 overflow-visible max-w-[50%] justify-end">
                {[0, 1, 2].map((offset) => {
                    const itemIndex = (index + offset) % items.length;
                    const item = items[itemIndex];
                    return (
                        <motion.div
                            key={item.id}
                            layout
                            layoutId={item.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ 
                                opacity: offset === 0 ? 1 : 0.4, 
                                x: 0, 
                                scale: offset === 0 ? 1.05 : 1, 
                                y: offset === 0 ? -10 : 0 
                            }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ 
                                layout: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                                opacity: { duration: 0.6 },
                                scale: { duration: 0.6 }
                            }}
                            onClick={() => setIndex(itemIndex)}
                            className={`relative w-32 md:w-52 aspect-[4/5] rounded-3xl md:rounded-[10px] overflow-hidden cursor-pointer border-2 transition-all duration-700 shadow-[0_20px_60px_rgba(0,0,0,0.8)] ${
                                offset === 0 ? 'border-white/40' : 'border-white/5 grayscale hover:grayscale-0'
                            }`}
                        >
                            <img src={item.image} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-6 left-6 right-6 text-[10px] md:text-[12px] font-black text-white leading-tight uppercase tracking-widest z-10">
                                {item.title.replace(/<[^>]*>?/gm, '')}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* 4. NAVIGATION & INDICATORS */}
            <div className="absolute bottom-12 left-8 md:left-20 z-20 flex items-center gap-10">
                {/* Arrow Nav */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIndex((index - 1 + items.length) % items.length)}
                        className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all text-white/40 hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setIndex((index + 1) % items.length)}
                        className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all text-white/40 hover:text-white"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Big Number Counter */}
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tighter">0{index + 1}</span>
                    <div className="h-px w-10 bg-white/20" />
                    <span className="text-sm font-black text-white/20 tracking-tighter">0{items.length}</span>
                </div>
            </div>
        </div>
    );
};const AdsSection = ({ banners }: { banners: MasivBanner[] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const nextAd = useCallback(() => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentIndex((prev) => (prev + 1) % (banners.length || 1));
        setTimeout(() => setIsTransitioning(false), 850);
    }, [isTransitioning, banners.length]);

    const prevAd = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentIndex((prev) => (prev - 1 + (banners.length || 1)) % (banners.length || 1));
        setTimeout(() => setIsTransitioning(false), 850);
    };

    // Auto-cycle logic
    useEffect(() => {
        const timer = setInterval(() => {
            nextAd();
        }, 7000);
        return () => clearInterval(timer);
    }, [nextAd]);

    if (!banners.length) return null;

    const currentAd = banners[currentIndex];

    return (
        <div className="w-full flex justify-center px-4 md:px-10">
            <motion.section 
                className="w-full md:w-[92%] max-w-[1700px] h-[60vh] md:h-[75vh] relative overflow-hidden bg-black flex items-center mt-[100px] md:mt-[140px] mb-[20px] rounded-[1.5rem] md:rounded-[3rem] shadow-[0_0_80px_rgba(255,107,53,0.15)] ring-1 ring-[#FF6B35]/20 border border-white/5 px-6 md:px-10 py-10 md:py-16 mx-auto"
            >
                {/* 0. Proactive Media Preloader (Zero-Latency Bridge) */}
                <div className="hidden pointer-events-none opacity-0">
                    <img src={banners[(currentIndex + 1) % banners.length].mediaUrl} alt="" />
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div 
                        key={currentAd.mediaUrl}
                        initial={{ 
                            opacity: 0, 
                            clipPath: "inset(15% round 2rem)",
                            scale: 1.12
                        }}
                        animate={{ 
                            opacity: 1, 
                            clipPath: "inset(0% round 0rem)",
                            scale: 1
                        }}
                        exit={{ 
                            opacity: 0, 
                            scale: 1.05,
                            transition: { duration: 0.4 }
                        }}
                        transition={{ 
                            duration: 0.85, 
                            ease: [0.22, 1, 0.36, 1] 
                        }}
                        className="absolute inset-0 z-0 will-change-[transform,opacity,clip-path]"
                    >
                        {currentAd.type === 'video' ? (
                            /* Full-Bleed Immersive Video (Zero-Latency Bridge) */
                            <div className="absolute inset-0 bg-black">
                                <img 
                                    src={currentAd.mediaUrl} 
                                    className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm scale-110" 
                                    alt="" 
                                />
                                <video 
                                    src={currentAd.mediaUrl} 
                                    autoPlay muted loop playsInline 
                                    preload="auto"
                                    poster={currentAd.mediaUrl}
                                    className="relative w-full h-full object-cover z-10"
                                />
                                {/* Deep Vignette for Full Video */}
                                <div className="absolute inset-0 z-20 bg-black/30" />
                            </div>
                        ) : (
                          /* PHOTO: Portrait-to-Landscape Gradient Blur Tech */
                        <>
                            <div className="absolute inset-0 overflow-hidden">
                                {/* Layer 0: Ambient Color Leaks (The 'Different Colours' Base) */}
                                <div className="absolute top-0 -left-[10%] w-[40%] h-full bg-[#FF6B35]/20 blur-[200px] rounded-full animate-pulse" />
                                <div className="absolute bottom-0 -right-[10%] w-[40%] h-full bg-blue-500/10 blur-[200px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />

                                {/* Layer 1: Base sharp/slight-blur background */}
                                <img 
                                    src={currentAd.mediaUrl} 
                                    className="absolute inset-0 w-full h-full object-cover scale-[1.3] brightness-[0.8] contrast-[1.1] saturate-[150%] blur-[80px]" 
                                    alt="" 
                                />
                                {/* Layer 2: Deep Blur layer with gradient mask */}
                                <img 
                                    src={currentAd.mediaUrl} 
                                    className="absolute inset-0 w-full h-full object-cover blur-[160px] scale-[1.5] brightness-[1.1] contrast-[1.2] saturate-[200%]" 
                                    style={{
                                        maskImage: "linear-gradient(to right, black 0%, transparent 40%, transparent 60%, black 100%)",
                                        WebkitMaskImage: "linear-gradient(to right, black 0%, transparent 40%, transparent 60%, black 100%)"
                                    }}
                                    alt="" 
                                />
                                {/* Subtle vignetting to keep focus */}
                                <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20" />
                            </div>
                            <div className="relative h-full w-full flex justify-center items-center">
                                <div className="h-full aspect-[9/16] relative shadow-[0_0_120px_rgba(0,0,0,0.9)] border-x border-white/10 z-10 transition-transform duration-700">
                                    <img 
                                        src={currentAd.mediaUrl} 
                                        className="w-full h-full object-cover" 
                                        alt={currentAd.title}
                                    />
                                </div>
                            </div>
                        </>
                        )}
                        {/* Universal Cinematic Overlays */}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-black/80 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
                    </motion.div>
                </AnimatePresence>

                {/* 2. Primary Typography Overlay (Positioned lower and even further left) */}
                <div className="relative z-10 w-full px-4 md:px-0 pt-48 pointer-events-none">
                    <div className="max-w-4xl pl-2 md:pl-4">
                        <motion.div
                            key={`meta-${currentIndex}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                        >
                            <span className="text-[#FF6B35] font-black tracking-[0.4em] uppercase text-[9px] mb-2 block">OKVEVO X MASIV</span>
                            <div className="h-[1.5px] w-8 bg-white/30 mb-6" />
                        </motion.div>
                        
                        <motion.h1
                            key={`title-${currentIndex}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                            className="text-white text-4xl md:text-6xl font-black leading-[0.95] tracking-tighter uppercase select-none drop-shadow-2xl"
                        >
                            <span dangerouslySetInnerHTML={{ 
                                __html: currentAd.title.includes(' ') 
                                    ? currentAd.title.replace(' ', '<br/>') 
                                    : currentAd.title 
                            }} />
                        </motion.h1>
                        
                        <motion.p
                            key={`desc-${currentIndex}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 0.4, x: 0 }}
                            transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
                            className="text-white text-[11px] md:text-[13px] font-bold tracking-[0.15em] uppercase mt-10 max-w-lg leading-relaxed"
                        >
                            {currentAd.description}
                        </motion.p>
                    </div>
                </div>
                
                {/* 3. Controls & Progress Bar */}


            <div className="absolute bottom-6 left-10 right-10 z-30 flex items-center justify-between border-t border-white/10 pt-4">
                <div className="flex items-center gap-12">
                    {/* Navigation Buttons */}
                    <div className="flex gap-4">
                        <button onClick={prevAd} className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-all group active:scale-95">
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <button onClick={nextAd} className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-all group active:scale-95">
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-64 h-[2px] bg-white/10 relative overflow-hidden hidden md:block">
                        <motion.div 
                            key={currentIndex}
                            initial={{ x: "-100%" }}
                            animate={{ x: "0%" }}
                            transition={{ duration: 7, ease: "linear" }}
                            className="absolute inset-0 bg-[#FF6B35]" 
                        />
                    </div>
                </div>

                {/* Counter */}
                <div className="flex items-baseline gap-3">
                    <span className="text-white text-3xl font-black tracking-tighter italic">0{currentIndex + 1}</span>
                    <span className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">/ 0{banners.length}</span>
                </div>
            </div>

            {/* Animated Light Leaks Layer */}
            <div className="absolute inset-0 pointer-events-none z-5">
                <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-[#FF6B35]/5 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>
            </motion.section>
        </div>
    );
};

export default function OkvevoMasivPage() {
    const { user, loading: authLoading, isAuthenticated } = useAuth();
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [userName, setUserName] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [email, setEmail] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successOrderId, setSuccessOrderId] = useState('');
    const router = useRouter();

    const [products, setProducts] = useState<MasivProduct[]>([]);
    const [banners, setBanners] = useState<MasivBanner[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [playingAudioProductId, setPlayingAudioProductId] = useState<string | null>(null);
    const [loadingBanners, setLoadingBanners] = useState(true);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated()) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        
        return () => {
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    // Fetch Products from Firestore
    useEffect(() => {
        console.log('🔍 Fetching products from masiv_products collection...');
        const q = query(collection(db, 'masiv_products'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`📦 Received ${snapshot.docs.length} products from Firestore`);
            const fetchedProducts = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log(`Product: ${doc.id}`, data);
                return {
                    id: doc.id,
                    ...data
                } as MasivProduct;
            });
            console.log('✅ Products set:', fetchedProducts);
            setProducts(fetchedProducts);
            setLoadingProducts(false);
        }, (error) => {
            console.error("❌ Error fetching masiv_products:", error);
            setLoadingProducts(false);
        });

        return () => unsubscribe();
    }, []);

    // Lenis removed for maximum native performance
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'photo' | 'video'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Booth Camera System State
    const [boothSessionId, setBoothSessionId] = useState<string>('');
    const [showSessionConfig, setShowSessionConfig] = useState(false);
    const [cameraConnected, setCameraConnected] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<Map<string, string>>(new Map()); // requestId -> slotId
    const [capturedPhotos, setCapturedPhotos] = useState<{fullBody: string | null, face: string | null}>({
        fullBody: null,
        face: null
    });
    const [photoAttempts, setPhotoAttempts] = useState<{fullBody: number, face: number}>({
        fullBody: 0,
        face: 0
    });

    // Fetch Banners from Firestore
    useEffect(() => {
        const q = query(collection(db, 'masiv_banners'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedBanners = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MasivBanner[];
            setBanners(fetchedBanners.sort((a, b) => (a.level || 0) - (b.level || 0)));
            setLoadingBanners(false);
        }, (error) => {
            console.error("Error fetching masiv_banners:", error);
            setLoadingBanners(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredProducts = useMemo(() => {
        return products
            .filter(product => {
                const matchesCategory = activeFilter === 'all' || product.type === activeFilter;
                const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      product.description.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
            })
            .sort((a, b) => (a.level || 0) - (b.level || 0)); // Sort by level (ascending)
    }, [products, activeFilter, searchQuery]);

    // Initialize booth session from localStorage
    useEffect(() => {
        const savedSessionId = localStorage.getItem('masivBoothSessionId');
        if (savedSessionId) {
            setBoothSessionId(savedSessionId);
            joinSession(savedSessionId).catch(err => {
                console.error('Error joining booth session:', err);
            });
        }
    }, []);

    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);

    // Image Upload State
    const [fullBodyImage, setFullBodyImage] = useState<string | null>(null);
    const [faceCloseUpImage, setFaceCloseUpImage] = useState<string | null>(null);

    // Refs for hidden inputs
    const fullBodyInputRef = useRef<HTMLInputElement>(null);
    const faceInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!activeRequestId) return;

        // Listen for the specific request document to get the resultUrl
        const unsubscribe = onSnapshot(doc(db, 'trend_requests', activeRequestId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.resultUrl) {
                    setResultImage(data.resultUrl);
                    setIsSubmitting(false); // Stop loading once result is here
                }
            }
        });

        return () => unsubscribe();
    }, [activeRequestId]);

    // Reset success state after a delay
    useEffect(() => {
        if (submitSuccess) {
            const timer = setTimeout(() => setSubmitSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [submitSuccess]);

    const handleTryTrend = async (product: MasivProduct) => {
        if (!fullBodyImage) {
            alert('Please upload a full body photo first.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (!user?.uid) {
                alert('Please sign in to continue.');
                return;
            }
            const timestamp = Date.now();
            const userId = user.uid;
            
            // 1. Upload Full Body Image
            const fullBodyRef = ref(storage, `trend_requests/${userId}/${timestamp}_full_body.jpg`);
            await uploadString(fullBodyRef, fullBodyImage, 'data_url');
            const fullBodyUrl = await getDownloadURL(fullBodyRef);

            // 2. Upload Face Image (if present)
            let faceUrl = '';
            if (faceCloseUpImage) {
                const faceRef = ref(storage, `trend_requests/${userId}/${timestamp}_face.jpg`);
                await uploadString(faceRef, faceCloseUpImage, 'data_url');
                faceUrl = await getDownloadURL(faceRef);
            }

            // 3. Save Request to Firestore
            const docRef = await addDoc(collection(db, 'trend_requests'), {
                userId,
                userEmail: user?.email || 'anonymous',
                userName: user?.displayName || 'Anonymous User',
                trendId: product.id,
                trendName: product.name,
                price: product.price,
                fullBodyUrl,
                faceUrl,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            setActiveRequestId(docRef.id);
            // setSubmitSuccess(true); // We don't close yet, we wait for results
            // setSelectedCard(null); 
            // setFullBodyImage(null);
            // setFaceCloseUpImage(null);
        } catch (error) {
            console.error('Error submitting trend request:', error);
            alert('Failed to submit request. Please try again.');
        } finally {
            // setIsSubmitting(false); // We keep loading until resultUrl arrives
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'full' | 'face') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (type === 'full') setFullBodyImage(reader.result as string);
                else setFaceCloseUpImage(reader.result as string);
            };
            reader.readAsDataURL(file);
            // Reset input value to allow selecting the same file again if needed
            e.target.value = '';
        }
    };

    // Booth Camera: Request photo capture
    const requestPhotoCapture = async (slotId: 'fullBody' | 'face') => {
        if (!boothSessionId) {
            alert('Please configure booth session first');
            setShowSessionConfig(true);
            return;
        }

        const connected = await isCameraConnected(boothSessionId);
        if (!connected) {
            alert('Camera is not connected. Please check iPhone.');
            return;
        }

        const attemptCount = slotId === 'fullBody' ? photoAttempts.fullBody + 1 : photoAttempts.face + 1;
        
        if (attemptCount > 3) {
            alert('Maximum 3 attempts reached for this photo');
            return;
        }

        try {
            const requestId = await createPhotoRequest(boothSessionId, slotId, attemptCount);
            
            // Track pending request
            setPendingRequests(prev => new Map(prev).set(requestId, slotId));
            
            // Update attempt count
            setPhotoAttempts(prev => ({
                ...prev,
                [slotId]: attemptCount
            }));

            // Listen for response
            const unsubscribe = listenToResponse(boothSessionId, requestId, (response) => {
                if (response && response.status === 'success') {
                    // Update captured photos
                    setCapturedPhotos(prev => ({
                        ...prev,
                        [slotId]: response.imageUrl
                    }));

                    // Also set the old state for compatibility with existing cart logic
                    if (slotId === 'fullBody') {
                        setFullBodyImage(response.imageUrl);
                    } else {
                        setFaceCloseUpImage(response.imageUrl);
                    }

                    // Remove from pending
                    setPendingRequests(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(requestId);
                        return newMap;
                    });

                    unsubscribe();
                }
            });
        } catch (error) {
            console.error('Error requesting photo capture:', error);
            alert('Failed to request photo capture');
        }
    };

    // Booth Camera: Reset session
    const handleResetSession = async () => {
        if (!boothSessionId) return;
        
        if (confirm('Reset booth session? This will clear all photos and start fresh.')) {
            try {
                await resetSession(boothSessionId);
                setCapturedPhotos({ fullBody: null, face: null });
                setFullBodyImage(null);
                setFaceCloseUpImage(null);
                setPhotoAttempts({ fullBody: 0, face: 0 });
                setPendingRequests(new Map());
                setCart([]);
                alert('Session reset successfully');
            } catch (error) {
                console.error('Error resetting session:', error);
                alert('Failed to reset session');
            }
        }
    };

    // Booth Camera: Configure session
    const handleSessionConfig = (newSessionId: string) => {
        const cleanSessionId = newSessionId.trim().toUpperCase();
        if (cleanSessionId && !cleanSessionId.includes('/') && !cleanSessionId.includes(':') && !cleanSessionId.includes('.')) {
            localStorage.setItem('masivBoothSessionId', cleanSessionId);
            setBoothSessionId(cleanSessionId);
            joinSession(cleanSessionId);
            setShowSessionConfig(false);
        } else {
            alert('Invalid session ID. Please enter only letters and numbers (e.g., BOOTH1)');
        }
    };

    const addToCart = async (product: MasivProduct) => {
        // Validate that photos are uploaded
        if (!fullBodyImage) {
            alert('Please upload a full body photo before adding to cart.');
            return;
        }

        try {
            if (!user?.uid) {
                alert('Please sign in to add items to cart.');
                return;
            }
            const timestamp = Date.now();
            const userId = user.uid;
            
            let fullBodyUrl: string;
            let faceUrl = '';

            // Check if fullBodyImage is already a Firebase Storage URL (from booth camera)
            if (fullBodyImage.startsWith('https://')) {
                // Already a Firebase Storage URL, use it directly
                fullBodyUrl = fullBodyImage;
            } else {
                // It's a data URL, upload it to Storage
                const fullBodyRef = ref(storage, `masiv_orders/${userId}/${timestamp}_${product.id}_full_body.jpg`);
                await uploadString(fullBodyRef, fullBodyImage, 'data_url');
                fullBodyUrl = await getDownloadURL(fullBodyRef);
            }

            // Handle face image similarly
            if (faceCloseUpImage) {
                if (faceCloseUpImage.startsWith('https://')) {
                    // Already a Firebase Storage URL
                    faceUrl = faceCloseUpImage;
                } else {
                    // It's a data URL, upload it
                    const faceRef = ref(storage, `masiv_orders/${userId}/${timestamp}_${product.id}_face.jpg`);
                    await uploadString(faceRef, faceCloseUpImage, 'data_url');
                    faceUrl = await getDownloadURL(faceRef);
                }
            }

            // Add to cart with photo URLs (no Firestore write yet - will be created after payment)
            if (!cart.find(item => item.id === product.id)) {
                setCart([...cart, { 
                    id: product.id, 
                    name: product.name, 
                    price: product.price,
                    trendType: product.type,
                    fullBodyImageUrl: fullBodyUrl,
                    faceImageUrl: faceUrl || null
                }]);
            }
            
            // Clear uploaded images after successful submission
            setFullBodyImage(null);
            setFaceCloseUpImage(null);
            setCapturedPhotos({ fullBody: null, face: null });
            setPhotoAttempts({ fullBody: 0, face: 0 });
            
            alert('Successfully added to cart with your photos!');
            setSelectedCard(null);
            setPlayingAudioProductId(null); // Stop audio when added to cart
        } catch (error) {
            console.error('Error adding to cart:', error);
            alert('Failed to add to cart. Please try again.');
        }
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleCheckout = async () => {
        // Validate inputs
        if (!userName || !whatsappNumber) {
            alert('Please fill in all required fields (Name and WhatsApp Number)');
            return;
        }

        if (!user?.uid) {
            alert('Please sign in to proceed with checkout');
            return;
        }

        setIsProcessingPayment(true);

        try {
            // Call backend to create Razorpay order + Firestore doc
            const response = await fetch('/api/razorpay/create-masiv-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    customerName: userName,
                    whatsappNumber,
                    email: email || null,
                    items: cart,
                    totalAmount: totalPrice,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create order');
            }

            const { orderId, key, amount, currency } = await response.json();

            // Check if Razorpay script is loaded
            if (!window.Razorpay) {
                throw new Error('Razorpay SDK not loaded. Please refresh the page.');
            }

            // Initialize Razorpay checkout
            const options = {
                key,
                amount,
                currency,
                name: 'OKVEVO MASIV',
                description: 'Photo/Video Trend Order',
                order_id: orderId,
                prefill: {
                    name: userName,
                    contact: whatsappNumber,
                    email: email || '',
                },
                theme: {
                    color: '#FF6B35',
                },
                handler: function (response: any) {
                    // Payment successful
                    console.log('Payment successful:', response);
                    setSuccessOrderId(orderId);
                    setShowSuccessPopup(true);
                    setCart([]);
                    setUserName('');
                    setWhatsappNumber('');
                    setEmail('');
                    setCapturedPhotos({ fullBody: null, face: null });
                    setPhotoAttempts({ fullBody: 0, face: 0 });
                    setShowCart(false);
                    
                    // Auto-close popup after 3 seconds
                    setTimeout(() => {
                        setShowSuccessPopup(false);
                    }, 3000);
                },
                modal: {
                    ondismiss: function () {
                        setIsProcessingPayment(false);
                        console.log('Payment modal closed');
                    },
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();

        } catch (error: any) {
            console.error('Checkout error:', error);
            alert(`Failed to initiate payment: ${error.message}\n\nPlease try again.`);
            setIsProcessingPayment(false);
        }
    };

    const isInCart = (id: string) => cart.some(item => item.id === id);
    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#FF6B35]/30 overflow-x-hidden relative scroll-smooth">
            {/* Minimal Background (Non-fixed to prevent paint lag) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#1a0a05_0%,#050505_100%)] pointer-events-none z-0" />

            {/* Custom Floating Pill Navbar (Landing Page style) */}
            <nav className="fixed top-0 left-0 right-0 z-[150] px-4 md:px-6 py-4 md:py-8 transition-all duration-700 pointer-events-none">
                <div className="max-w-[1200px] mx-auto pointer-events-auto flex items-center justify-between w-full px-4 md:px-8 py-3 md:py-5 rounded-full backdrop-blur-xl bg-gradient-to-r from-[#FF6B35]/10 via-[#0A0A0A]/80 to-[#FF6B35]/10 border border-white/10 hover:shadow-[0_0_30px_rgba(255,107,53,0.15)] transition-all">
                    
                    {/* Left - Official Logo */}
                    <div className="flex-1 flex justify-start">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <img src="/masiv/masivlogo.png" alt="MASIV Logo" className="h-6 md:h-10 w-auto object-contain" />
                        </Link>
                    </div>

                    {/* Center - Session Status */}
                    <div className="flex-1 flex justify-center gap-2 md:gap-3">
                        {boothSessionId && <SessionStatus sessionId={boothSessionId} showBanner={true} />}
                        {boothSessionId && (
                            <>
                                <button
                                    onClick={() => setShowSessionConfig(true)}
                                    className="flex items-center gap-2 px-3 md:px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors"
                                    title="Change Session ID"
                                >
                                    <Camera className="w-3 h-3" />
                                    <span className="text-[10px] md:text-xs font-bold hidden lg:block">Change</span>
                                </button>
                                <button
                                    onClick={handleResetSession}
                                    className="flex items-center gap-2 px-3 md:px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors"
                                    title="Reset Session"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    <span className="text-[10px] md:text-xs font-bold hidden lg:block">Reset</span>
                                </button>
                            </>
                        )}
                        {!boothSessionId && (
                            <button
                                onClick={() => setShowSessionConfig(true)}
                                className="flex items-center gap-2 px-4 py-1.5 bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 rounded-full border border-[#FF6B35]/30 transition-colors"
                            >
                                <Camera className="w-3 h-3 text-[#FF6B35]" />
                                <span className="text-[10px] md:text-xs font-bold text-[#FF6B35]">Setup</span>
                            </button>
                        )}
                    </div>

                    {/* Right - Cart */}
                    <div className="flex-1 flex justify-end">
                        <button
                            onClick={() => setShowCart(true)}
                            className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors shadow-lg"
                        >
                            <ShoppingCart className="w-4 h-4 text-[#FF6B35]" />
                            <span className="font-bold text-xs md:text-sm tracking-widest uppercase hidden sm:block">Cart <span className="text-white/50 ml-1">({cart.length})</span></span>
                            <span className="font-bold text-xs md:text-sm tracking-widest uppercase sm:hidden">{cart.length}</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Section with persistent grid background */}
            <div className="bg-transparent text-white relative z-10 transition-all">
                <AdsSection banners={banners} />
            </div>

            {/* Dark Section for Cards */}
            <main className="max-w-[1400px] mx-auto pb-24 relative z-0">
                
                {/* Category Grid removed at user request */}

                {/* Filter & Search Control Bar */}
                <section className="px-6 md:px-10 mb-8 flex flex-col md:flex-row gap-6 items-center justify-between">
                    {/* Category Tabs */}
                    <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl backdrop-blur-md w-full md:w-auto">
                        {['all', 'photo', 'video'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setActiveFilter(type as any)}
                                className={`flex-1 md:flex-none px-4 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                                    activeFilter === type 
                                    ? 'bg-[#FF6B35] text-white shadow-lg' 
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                            <Search className={`w-4 h-4 transition-colors duration-300 ${searchQuery ? 'text-[#FF6B35]' : 'text-white/20'}`} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search trends..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white pl-14 pr-12 py-4 rounded-2xl outline-none focus:border-[#FF6B35]/50 focus:bg-white/10 transition-all font-bold text-sm placeholder:text-white/20"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-4 flex items-center p-2 text-white/30 hover:text-white transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </section>

                {/* Vertical Normal Grid (4 columns) */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredProducts.map((product, index) => (
                        <ProductCard 
                            key={product.id}
                            product={product}
                            index={index}
                            isInCart={isInCart}
                            addToCart={addToCart}
                            setSelectedCard={setSelectedCard}
                            playingAudioProductId={playingAudioProductId}
                            setPlayingAudioProductId={setPlayingAudioProductId}
                        />
                    ))}
                </section>
            </main>

            {/* 3-Column Expanded Card Modal */}
            <AnimatePresence>
                {selectedCard && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            setSelectedCard(null);
                            setFullBodyImage(null);
                            setFaceCloseUpImage(null);
                            setPlayingAudioProductId(null); // Stop audio when modal is closed
                        }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 md:p-8"
                    >
                        {(() => {
                            const product = products.find(p => p.id === selectedCard);
                            if (!product) return null;
                            const alreadyInCart = isInCart(product.id);

                            return (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                    transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="relative bg-[#0d0d0d] border border-white/10 rounded-[2.5rem] w-full max-w-[1200px] h-[75vh] min-h-[500px] overflow-hidden shadow-2xl flex flex-col"
                                >
                                    {/* Close Button */}
                                    <button
                                        onClick={() => {
                                            setSelectedCard(null);
                                            setFullBodyImage(null);
                                            setFaceCloseUpImage(null);
                                            setPlayingAudioProductId(null); // Stop audio when close button is clicked
                                        }}
                                        className="absolute top-6 right-6 z-50 p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
                                    >
                                        <X className="w-5 h-5 text-white" />
                                    </button>

                                    {/* 3 Parts: Left Thumbnail, Center Upload, Right Info */}
                                    <div className="flex flex-col md:flex-row h-full">

                                        {/* LEFT Part: Thumbnail */}
                                        <div className="w-full md:w-1/3 h-1/3 md:h-full p-6 pb-3 md:pb-6 pr-3 md:pr-3">
                                            <div className="w-full h-full rounded-3xl overflow-hidden relative border border-white/5">
                                                <ThumbnailScroller 
                                                    images={product.thumbnails} 
                                                />
                                            </div>
                                        </div>

                                        {/* CENTER Part: Image Uploads */}
                                        <div className="w-full md:w-1/3 h-1/3 md:h-full p-6 py-3 md:py-6 px-3 md:px-3 flex flex-col gap-5">
                                            
                                            {/* Top Box: Full Body */}
                                            <div className="flex flex-col flex-1 min-h-0">
                                                <div className="mb-2 shrink-0 flex justify-between items-center">
                                                    <div>
                                                        <span className="text-white/90 text-[13px] font-bold tracking-wide">Full Body Photo</span>
                                                        <span className="text-[#FF6B35] font-black ml-1 text-[13px]">*</span>
                                                    </div>
                                                    {fullBodyImage && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFullBodyImage(null);
                                                            }}
                                                            className="text-red-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-h-0">
                                                    <div 
                                                        className={`w-full relative h-full rounded-[1.5rem] bg-[#0a0a0a]/50 border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-all overflow-hidden ${
                                                            fullBodyImage 
                                                                ? 'border-[#FF6B35]/50 bg-[#FF6B35]/5' 
                                                                : 'border-[#FF6B35]/30'
                                                        }`}
                                                    >
                                                        {fullBodyImage ? (
                                                            <img src={fullBodyImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover rounded-[1.5rem]" />
                                                        ) : (
                                                            <>
                                                                <Camera strokeWidth={1.5} className="w-8 h-8 text-white/40 mb-3" />
                                                                <button
                                                                    onClick={() => requestPhotoCapture('fullBody')}
                                                                    disabled={!boothSessionId || Array.from(pendingRequests.values()).includes('fullBody')}
                                                                    className="px-4 py-2 bg-[#FF6B35] hover:bg-[#FF8F6B] disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-xs rounded-lg transition-all"
                                                                >
                                                                    {Array.from(pendingRequests.values()).includes('fullBody') ? 'Capturing...' : 'Tap to Capture'}
                                                                </button>
                                                                <span className="text-white/30 text-[11px] mt-2">
                                                                    {photoAttempts.fullBody > 0 && `Attempt ${photoAttempts.fullBody}/3`}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom Box: Face Close-up */}
                                            <div className="flex flex-col flex-1 min-h-0">
                                                <div className="mb-2 shrink-0 flex justify-between items-center">
                                                    <div>
                                                        <span className="text-white/90 text-[13px] font-bold tracking-wide">Face Close-up Photo</span>
                                                        <span className="text-white/30 ml-1 text-[13px]">(Optional)</span>
                                                    </div>
                                                    {faceCloseUpImage && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFaceCloseUpImage(null);
                                                            }}
                                                            className="text-red-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-h-0">
                                                    <div 
                                                        className={`w-full relative h-full rounded-[1.5rem] bg-[#0a0a0a]/50 border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-all overflow-hidden ${
                                                            faceCloseUpImage 
                                                                ? 'border-white/30 bg-white/5' 
                                                                : 'border-white/10'
                                                        }`}
                                                    >
                                                        {faceCloseUpImage ? (
                                                            <img src={faceCloseUpImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover rounded-[1.5rem]" />
                                                        ) : (
                                                            <>
                                                                <Camera strokeWidth={1.5} className="w-8 h-8 text-white/40 mb-3" />
                                                                <button
                                                                    onClick={() => requestPhotoCapture('face')}
                                                                    disabled={!boothSessionId || Array.from(pendingRequests.values()).includes('face')}
                                                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/20 text-white font-bold text-xs rounded-lg transition-all"
                                                                >
                                                                    {Array.from(pendingRequests.values()).includes('face') ? 'Capturing...' : 'Tap to Capture'}
                                                                </button>
                                                                <span className="text-white/30 text-[11px] mt-2">
                                                                    {photoAttempts.face > 0 && `Attempt ${photoAttempts.face}/3`}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                        </div>

                                        {/* RIGHT Part: Info & Buttons */}
                                        <div className="w-full md:w-1/3 h-1/3 md:h-full p-6 pt-3 md:pt-6 pl-3 md:pl-3 flex flex-col">
                                            <div className="w-full h-full rounded-3xl bg-[#151515] border border-white/5 p-8 flex flex-col relative overflow-hidden">

                                                <div className="flex-1 relative z-10">
                                                    <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tighter text-white leading-[1.1]">{product.name}</h2>
                                                    <p className="text-white/50 text-base leading-relaxed mb-8 font-medium">
                                                        {product.description}
                                                    </p>

                                                    <div className="flex flex-col">
                                                        <span className="text-white/30 text-xs font-bold uppercase tracking-widest mb-1">
                                                            Price
                                                        </span>
                                                        <p className="text-4xl font-black text-[#FF6B35]">
                                                            ₹{product.price}
                                                        </p>
                                                    </div>
                                                </div>

                                                    <div className="flex flex-col gap-3 mt-8 relative z-10">
                                                        {/* <button 
                                                            onClick={() => handleTryTrend(product)}
                                                            disabled={isSubmitting || !fullBodyImage}
                                                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl flex items-center justify-center gap-3 ${
                                                                isSubmitting || !fullBodyImage
                                                                    ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                                                    : 'bg-[#FF6B35] hover:bg-[#FF8F6B] text-black shadow-[0_0_30px_rgba(255,107,53,0.3)]'
                                                            }`}
                                                        >
                                                            {isSubmitting ? (
                                                                <>
                                                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                                    Reviewing Trend...
                                                                </>
                                                            ) : (
                                                                'Submit'
                                                            )}
                                                        </button> */}
                                                    <button
                                                        onClick={() => addToCart(product)}
                                                        disabled={alreadyInCart || !fullBodyImage || loadingProducts}
                                                        className={`w-full py-5 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 border ${
                                                            alreadyInCart
                                                                ? 'bg-green-500/10 text-green-500 border-green-500/20 cursor-not-allowed'
                                                                : !fullBodyImage
                                                                ? 'bg-red-500/10 text-red-500 border-red-500/20 cursor-not-allowed'
                                                                : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {alreadyInCart ? (
                                                            <>
                                                                <Check className="w-5 h-5" />
                                                                In Cart
                                                            </>
                                                        ) : !fullBodyImage ? (
                                                            <>
                                                                <Upload className="w-5 h-5" />
                                                                Upload Photo First
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ShoppingCart className="w-5 h-5 opacity-50" />
                                                                Add to Cart
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </motion.div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- GENERATION LOADER / RESULT OVERLAY --- */}
            <AnimatePresence>
                {(isSubmitting || resultImage) && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6"
                    >
                        <div className="max-w-4xl w-full text-center">
                            {resultImage ? (
                                <motion.div 
                                    initial={{ scale: 0.9, y: 20 }}
                                    animate={{ scale: 1, y: 0 }}
                                    className="flex flex-col items-center"
                                >
                                    <div className="mb-8">
                                        <h2 className="text-5xl font-black tracking-tighter uppercase mb-2">Your Trend is Ready</h2>
                                        <p className="text-gray-400">Our AI has successfully crafted your unique look</p>
                                    </div>
                                    
                                    <div className="relative group rounded-[32px] overflow-hidden border border-white/10 shadow-2xl mb-10 w-full max-w-lg aspect-[3/4]">
                                        <img src={resultImage} alt="AI Result" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    </div>

                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => window.open(resultImage, '_blank')}
                                            className="px-8 py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
                                        >
                                            Download High-Res
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setResultImage(null);
                                                setActiveRequestId(null);
                                                setIsSubmitting(false);
                                                setSelectedCard(null);
                                                setPlayingAudioProductId(null); // Stop audio when result modal is closed
                                            }}
                                            className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
                                        >
                                            Back to Catalog
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="relative w-32 h-32 mb-10">
                                        <div className="absolute inset-0 border-4 border-[#FF6B35]/20 rounded-full" />
                                        <motion.div 
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0 border-4 border-[#FF6B35] border-t-transparent rounded-full"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 bg-[#FF6B35]/10 rounded-full flex items-center justify-center animate-pulse">
                                                <div className="w-8 h-8 rounded-full bg-[#FF6B35]" />
                                            </div>
                                        </div>
                                    </div>

                                    <h2 className="text-4xl font-black tracking-tighter uppercase mb-4 animate-pulse">Generating your Trend</h2>
                                    <div className="space-y-2 max-w-md mx-auto">
                                        <p className="text-gray-400 text-lg">Our design team is manually reviewing your photos to ensure the highest AI quality.</p>
                                        <p className="text-[#FF6B35] text-sm font-black tracking-widest uppercase">Do not close this window</p>
                                    </div>

                                    {/* Progress simulation or steps */}
                                    <div className="mt-12 flex justify-center gap-2">
                                        {[0, 1, 2].map(i => (
                                            <motion.div 
                                                key={i}
                                                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                                                className="w-2 h-2 rounded-full bg-[#FF6B35]"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cart Sidebar */}
            <AnimatePresence>
                {showCart && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowCart(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-0 h-full w-full max-w-md bg-[#111] border-l border-white/10 shadow-2xl"
                        >
                            <div className="p-8 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-3xl font-black tracking-tight">Your Cart</h2>
                                    <button
                                        onClick={() => setShowCart(false)}
                                        className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5 text-white/70" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                    {cart.length === 0 ? (
                                        <div className="text-center py-20 text-white/30 flex flex-col items-center">
                                            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                                <ShoppingCart className="w-10 h-10 text-white/20" />
                                            </div>
                                            <p className="font-bold text-lg">Your cart is empty</p>
                                        </div>
                                    ) : (
                                        cart.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex flex-col p-5 bg-[#1a1a1a] border border-white/5 rounded-2xl relative group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-lg text-white pr-8">{item.name}</h4>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="absolute top-5 right-5 p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <p className="text-[#FF6B35] font-black text-xl">₹{item.price}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {cart.length > 0 && (
                                    <div className="border-t border-white/10 pt-6 mt-6">
                                        {/* User Information Form */}
                                        <div className="mb-6 space-y-4">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-white/70 mb-4">Your Details</h3>
                                            
                                            {/* Name - Mandatory */}
                                            <div>
                                                <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
                                                    Name <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={userName}
                                                    onChange={(e) => setUserName(e.target.value)}
                                                    placeholder="Enter your full name"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                                />
                                            </div>

                                            {/* WhatsApp Number - Mandatory */}
                                            <div>
                                                <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
                                                    WhatsApp Number <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={whatsappNumber}
                                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                                    placeholder="Enter your WhatsApp number"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                                />
                                            </div>

                                            {/* Email - Optional */}
                                            <div>
                                                <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
                                                    Email <span className="text-white/30 text-[10px]">(Optional)</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="Enter your email address"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-end justify-between mb-6">
                                            <span className="text-white/50 font-bold uppercase tracking-widest text-xs">Total Amount</span>
                                            <span className="text-4xl font-black text-white">₹{totalPrice}</span>
                                        </div>
                                        <button
                                            onClick={handleCheckout}
                                            disabled={!userName || !whatsappNumber || isProcessingPayment}
                                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all ${
                                                !userName || !whatsappNumber || isProcessingPayment
                                                    ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                                    : 'bg-[#FF6B35] hover:bg-[#FF8F6B] text-white shadow-[0_0_30px_rgba(255,107,53,0.3)]'
                                            }`}
                                        >
                                            {isProcessingPayment ? 'Processing...' : 'Proceed to Checkout'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Session Configuration Modal */}
            <AnimatePresence>
                {showSessionConfig && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowSessionConfig(false)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#0d0d0d] border border-white/10 rounded-3xl p-8 max-w-md w-full"
                        >
                            <div className="text-center mb-6">
                                <Camera className="w-12 h-12 mx-auto mb-3 text-[#FF6B35]" />
                                <h2 className="text-2xl font-black mb-2">Configure Booth Session</h2>
                                <p className="text-white/50 text-sm">Enter the session ID to connect iPad with iPhone camera</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/70 mb-2 uppercase tracking-wider">
                                        Session ID
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={boothSessionId}
                                        placeholder="BOOTH1"
                                        id="sessionIdInput"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors uppercase"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowSessionConfig(false)}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('sessionIdInput') as HTMLInputElement;
                                            if (input?.value) {
                                                handleSessionConfig(input.value);
                                            }
                                        }}
                                        className="flex-1 py-3 bg-[#FF6B35] hover:bg-[#FF8F6B] text-white font-bold rounded-xl transition-colors"
                                    >
                                        Connect
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Payment Success Popup */}
            <AnimatePresence>
                {showSuccessPopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 20 }}
                            className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border-2 border-[#FF6B35] rounded-3xl p-10 max-w-md w-full text-center shadow-[0_0_50px_rgba(255,107,53,0.5)]"
                        >
                            {/* Success Icon */}
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[#FF6B35] to-[#FF8F6B] rounded-full flex items-center justify-center"
                            >
                                <Check className="w-10 h-10 text-white" strokeWidth={3} />
                            </motion.div>

                            {/* Success Message */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
                                    Payment Successful!
                                </h2>
                                <p className="text-white/70 text-lg mb-4">
                                    Your order has been placed successfully
                                </p>
                                
                                {/* Order ID */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                                    <p className="text-white/50 text-xs uppercase tracking-widest font-bold mb-1">
                                        Order ID
                                    </p>
                                    <p className="text-[#FF6B35] font-mono text-sm break-all">
                                        {successOrderId}
                                    </p>
                                </div>

                                {/* Contact Info */}
                                <p className="text-white/60 text-sm">
                                    We'll contact you on WhatsApp shortly
                                </p>
                            </motion.div>

                            {/* Auto-close indicator */}
                            <motion.div
                                initial={{ width: "100%" }}
                                animate={{ width: "0%" }}
                                transition={{ duration: 3, ease: "linear" }}
                                className="h-1 bg-[#FF6B35] rounded-full mt-6"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
