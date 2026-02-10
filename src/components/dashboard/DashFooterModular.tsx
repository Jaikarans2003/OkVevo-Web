'use client';

import { motion } from 'framer-motion';

export default function DashFooterModular() {
    return (
        <footer className="relative bg-[#050505] text-white overflow-hidden py-32 border-t border-white/5">
            {/* Grid Background with Perspective */}
            <div className="absolute inset-x-0 bottom-0 h-[600px] opacity-40 pointer-events-none overflow-hidden">
                <div
                    className="w-full h-full absolute inset-0"
                    style={{
                        backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                        transform: 'perspective(500px) rotateX(60deg) translateY(100px) scale(3)',
                        transformOrigin: 'bottom center',
                        maskImage: 'linear-gradient(to bottom, transparent, black)'
                    }}
                />
            </div>

            <div className="container mx-auto px-6 relative z-10 text-center">
                {/* Giant Typography - Fixed Size */}
                <h1 className="text-[12rem] md:text-[18rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 opacity-20 select-none mt-12 mb-12 hover:opacity-100 transition-opacity duration-500">
                    OKVEVO
                </h1>

                {/* Minimal Links */}
                <div className="flex justify-center gap-8 md:gap-16 mb-24">
                    {['Instagram', 'Twitter', 'TikTok', 'Discord'].map((social, i) => (
                        <motion.a
                            key={social}
                            href="#"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -5, color: '#E2FF4D' }}
                            className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-white/40 transition-all font-mono"
                        >
                            {social}
                        </motion.a>
                    ))}
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] text-white/20 font-mono tracking-widest gap-4">
                    <span>© 2024 OKVEVO INC. SYSTEM V3.0</span>
                    <div className="flex gap-8">
                        <a href="#" className="hover:text-white transition-colors">PRIVACY_POLICY</a>
                        <a href="#" className="hover:text-white transition-colors">TERMS_OF_SERVICE</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
