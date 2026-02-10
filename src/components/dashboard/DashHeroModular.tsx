'use client';

import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const DashHeroModular = ({ user }: { user?: any }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Creator';

    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        const x = (clientX / innerWidth - 0.5) * 2; // -1 to 1
        const y = (clientY / innerHeight - 0.5) * 2; // -1 to 1
        setMousePosition({ x, y });
    };

    // Parallax variants for floating elements
    const floatingVariant = (factor: number) => ({
        x: mousePosition.x * factor * 20,
        y: mousePosition.y * factor * 20,
        transition: {
            type: "spring" as const,
            stiffness: 50,
            damping: 20
        }
    });

    return (
        <section
            onMouseMove={handleMouseMove}
            className="relative min-h-[100vh] bg-[#FAFAFA] flex flex-col items-center justify-center overflow-hidden"
        >
            {/* Dot Grid Pattern - Light Mode */}
            <div
                className="absolute inset-0 opacity-[0.4] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#000000 1.5px, transparent 1.5px)',
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Floating Elements - Modular Style */}
            {/* Top Left - Sphere */}
            <motion.div
                animate={floatingVariant(2)}
                className="absolute top-[15%] left-[10%] w-24 h-24 hidden md:flex items-center justify-center bg-black rounded-[30px] rotate-[-12deg] shadow-xl z-10"
            >
                <div className="text-4xl">🔮</div>
            </motion.div>

            {/* Top Right - Box */}
            <motion.div
                animate={floatingVariant(1.5)}
                className="absolute top-[20%] right-[15%] w-32 h-32 hidden md:block rounded-[40px] bg-gradient-to-br from-purple-400 to-indigo-600 shadow-2xl z-10 overflow-hidden text-white p-6"
            >
                <div className="font-black text-xs uppercase tracking-widest">NFT</div>
                <div className="mt-2 text-2xl font-bold">#882</div>
            </motion.div>

            {/* Bottom Left - Keycap */}
            <motion.div
                animate={floatingVariant(1.8)}
                className="absolute bottom-[20%] left-[15%] w-40 h-40 hidden md:flex items-center justify-center bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-10"
            >
                <Image
                    src="/images/dashboard/modular_interface_floating_element_1_fixed_1770547039272.png"
                    alt="Floating Element"
                    width={100}
                    height={100}
                    className="object-contain"
                />
            </motion.div>

            {/* Bottom Right - Lime Character */}
            <motion.div
                animate={floatingVariant(2.5)}
                className="absolute bottom-[25%] right-[10%] w-48 h-48 hidden md:block rounded-[48px] bg-[#E2FF4D] shadow-2xl z-10 overflow-hidden group"
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl font-black text-black tracking-tighter group-hover:scale-110 transition-transform">👀</span>
                </div>
            </motion.div>


            {/* Central Typography */}
            <div className="relative z-20 text-center max-w-5xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-3 px-6 py-2 bg-black text-white rounded-full text-xs font-bold uppercase tracking-widest mb-10"
                >
                    <span className="w-2 h-2 bg-[#E2FF4D] rounded-full animate-pulse" />
                    Zero team but the work get done.
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center mb-12"
                >
                    <span className="block text-3xl md:text-5xl font-bold text-black/30 mb-2 tracking-tight">Welcome,</span>
                    <span className="block text-[10vw] md:text-[8vw] font-black text-black leading-[0.9] tracking-tighter mb-4 text-center">
                        {displayName}
                    </span>
                    <span className="block text-4xl md:text-6xl font-bold text-black tracking-tight">
                        I am <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">VEVO</span>
                    </span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-gray-500 text-lg md:text-xl font-medium max-w-lg mx-auto leading-relaxed mb-12"
                >
                    A collection of randomly generated profile passion projects. Just vibes.
                </motion.p>

                <Link href="/studio/director">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-10 py-5 bg-black text-white rounded-full font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-gray-900 transition-colors flex items-center gap-3 mx-auto"
                    >
                        Launch Studio <ArrowUpRight size={18} />
                    </motion.button>
                </Link>
            </div>
        </section>
    );
};

export default DashHeroModular;
