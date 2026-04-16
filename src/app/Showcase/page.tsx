'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin, Navigation, Info, ArrowUpRight, Maximize2, Sparkles, ExternalLink } from 'lucide-react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import Navbar from '../../components/ook/Navbar';
import NoiseOverlay from '../../components/NoiseOverlay';

const BOOTH_IMAGES = [
    {
        src: "/okvevoimg/ok1.jpeg",
        title: "Main Entrance",
        desc: "The holographic welcome portal of the OKVEVO Booth."
    },
    {
        src: "/okvevoimg/ok2.jpeg",
        title: "Creation Node",
        desc: "Experience zero-latency generative cinematography real-time."
    },
    {
        src: "/okvevoimg/ok3.jpeg",
        title: "Portrait Studio",
        desc: "Professional AI-driven lighting rigs for stunning avatars."
    },
    {
        src: "/okvevoimg/ok4.jpeg",
        title: "Main Entrance",
        desc: "The holographic welcome portal of the OKVEVO Booth."
    },
    {
        src: "/okvevoimg/ok5.png",
        title: "Portrait Studio",
        desc: "Professional AI-driven lighting rigs for stunning avatars."
    },
    {
        src: "/okvevoimg/ok6.jpeg",
        title: "Portrait Studio",
        desc: "Professional AI-driven lighting rigs for stunning avatars."
    },
    {
        src: "/okvevoimg/ok7.jpeg",
        title: "Main Entrance",
        desc: "The holographic welcome portal of the OKVEVO Booth."
    },
];

const ADDRESS = "Century Corbel Commercial, Sahakara Nagar, Bengaluru, KA 560092";
const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;

export default function LocationPage() {
    const [user, setUser] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsLoaded(true);
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleJoinClick = () => {
        if (user) {
            router.push('/workspace');
        } else {
            router.push('/login');
        }
    };

    const nextPhoto = () => setCurrentIndex((prev) => (prev + 1) % BOOTH_IMAGES.length);
    const prevPhoto = () => setCurrentIndex((prev) => (prev - 1 + BOOTH_IMAGES.length) % BOOTH_IMAGES.length);

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden flex flex-col font-sans relative">
            <NoiseOverlay />
            
            <Navbar user={user} onJoinClick={handleJoinClick} />
            
            {/* ─── Main Content Container (Pushed down significantly) ─── */}
            <main className="flex-1 flex flex-col h-screen pt-44 pb-10 px-6 md:px-12 relative z-10 box-border">
                
                {/* ─── Grid Shelves (Reduced max-height to avoid overlap) ─── */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 h-full min-h-0">
                    
                    {/* LEFT: Gallery */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="md:col-span-12 lg:col-span-7 bg-[#050505] border border-white/10 rounded-[3rem] lg:rounded-[4rem] overflow-hidden relative group shadow-[0_0_50px_rgba(0,0,0,0.5)] h-full"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, scale: 1.1 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="absolute inset-0"
                            >
                                <Image
                                    src={BOOTH_IMAGES[currentIndex].src}
                                    alt={BOOTH_IMAGES[currentIndex].title}
                                    fill
                                    sizes="(max-width: 1024px) 100vw, 60vw"
                                    className="object-contain opacity-80 group-hover:scale-105 transition-transform duration-[transition-duration:4s]"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                            </motion.div>
                        </AnimatePresence>

                        {/* Controls */}
                        <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 flex justify-between z-20">
                            <button onClick={prevPhoto} className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                                <ChevronLeft size={32} />
                            </button>
                            <button onClick={nextPhoto} className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-2xl">
                                <ChevronRight size={32} />
                            </button>
                        </div>

                        <div className="absolute bottom-12 left-12 z-20">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-2 leading-none">{BOOTH_IMAGES[currentIndex].title}</h2>
                                <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.5em]">{BOOTH_IMAGES[currentIndex].desc}</p>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* RIGHT: Map Container */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="md:col-span-12 lg:col-span-5 bg-[#050505] border border-white/10 rounded-[3rem] lg:rounded-[4rem] overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)] group/map h-full"
                    >
                        {/* Map Iframe with Link Wrapper */}
                        <a 
                            href={MAP_URL} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="absolute inset-0 z-0 grayscale invert opacity-20 contrast-[1.5] cursor-pointer hover:opacity-40 transition-opacity"
                            aria-label="Open location in Google Maps"
                        >
                            <iframe 
                                width="100%" 
                                height="100%" 
                                style={{ border: 0 }} 
                                src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3886.6664972175204!2d77.58434!3d13.0568!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae174c88e99e69%3A0x7d6a5c18e11b333!2sCentury%20Corbel%20Commercial!5e0!3m2!1sen!2sin!4v1709400000000!5m2!1sen!2sin`}
                                loading="lazy"
                                className="pointer-events-none"
                            />
                        </a>

                        {/* Interactive Overlays */}
                        <div className="absolute inset-0 pointer-events-none p-10 flex flex-col justify-between">
                            <div className="flex justify-between items-start pointer-events-auto">
                                <div className="bg-black/60 backdrop-blur-3xl p-4 rounded-3xl border border-white/10 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg text-white">
                                        <MapPin size={22} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h4 className="text-[9px] font-black uppercase tracking-widest text-white/40">Sahakara Nagar</h4>
                                        <p className="text-sm font-bold">Century Corbel</p>
                                    </div>
                                </div>
                                <button className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white hover:text-black transition-all">
                                    <Maximize2 size={20} />
                                </button>
                            </div>

                            {/* Smaller Orange Box (Visit Studio Card) */}
                            <div className="pointer-events-auto flex justify-end">
                                <a 
                                    href={MAP_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-orange-600 text-white p-6 rounded-[2.5rem] shadow-[0_20px_40px_rgba(234,88,12,0.3)] relative overflow-hidden group/card hover:scale-105 transition-all duration-500 max-w-[280px]"
                                >
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="text-xl font-black tracking-tighter leading-none mb-1 uppercase text-black">HQ NODE</h3>
                                            <p className="text-[8px] font-black uppercase tracking-widest opacity-60 text-black">SAHAKARA NAGAR 01</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full border border-black/20 flex items-center justify-center text-black">
                                            <ArrowUpRight size={16} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold leading-relaxed mb-4 opacity-90 text-black">
                                        Century Corbel Commercial, 2nd Floor. Experience the future of OKVEVO.
                                    </p>
                                    <div className="flex gap-2">
                                        <div className="px-3 py-1 bg-black/10 rounded-full text-[8px] font-black uppercase tracking-widest text-black">Active HQ</div>
                                        <div className="px-3 py-1 bg-black/20 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 text-black">
                                            Open Maps <ExternalLink size={8} />
                                        </div>
                                    </div>
                                </a>
                            </div>
                        </div>

                        {/* UI Scanning Line */}
                        <motion.div 
                            animate={{ top: ['0%', '100%'] }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-x-0 h-[1px] bg-white/20 z-10 pointer-events-none"
                        />
                    </motion.div>

                </div>
            </main>
        </div>
    );
}
