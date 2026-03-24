'use client';

import { ArrowUp, X, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Footer = () => {
    const [showContact, setShowContact] = useState(false);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer data-section-theme="light" className="bg-black overflow-hidden">
            <div className="bg-accent-orange rounded-t-[80px] md:rounded-t-[120px] pt-10 pb-20 px-10 md:px-32 overflow-hidden relative shadow-2xl transition-all duration-700">
                {/* Decorative Pattern / Glow */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-white/10" />

                <div className="container relative z-10 flex flex-col pt-10">
                    <div className="flex flex-col md:flex-row justify-between w-full gap-24 mb-32">
                        <div className="max-w-sm">
                            <a href="/" className="text-4xl font-black tracking-tighter text-white mb-8 block transition-transform hover:scale-105 origin-left font-museo-moderno">
                                <Image 
                                    src="/OKVEVO WithOut BackGrounds/black.svg" 
                                    alt="OKVEVO Logo" 
                                    width={40} 
                                    height={40} 
                                    className="w-12 h-12 object-contain"
                                />
                                OKVEVO<span className="text-text-main">.</span>
                            </a>
                            <p className="text-xl text-white font-medium leading-relaxed">
                                Designing the future of cinematic storytelling through the lens of artificial intelligence.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-16 md:gap-32">
                            <div>
                                <h4 className="text-[11px] font-black tracking-[0.4em] uppercase text-text-main/60 mb-10">Platform</h4>
                                <ul className="space-y-4 text-sm font-black uppercase tracking-wider text-white">
                                    <li><a href="#features" className="hover:text-text-main transition-all hover:translate-x-1 inline-block">Features</a></li>
                                    <li><a href="#how-it-works" className="hover:text-text-main transition-all hover:translate-x-1 inline-block">Process</a></li>
                                    <li><a href="#tunetalez" className="hover:text-text-main transition-all hover:translate-x-1 inline-block">TuneTalez</a></li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="text-[11px] font-black tracking-[0.4em] uppercase text-text-main/60 mb-10">Company</h4>
                                <ul className="space-y-4 text-sm font-black uppercase tracking-wider text-white">
                                <li><a href="#" className="hover:text-text-main transition-all hover:translate-x-1 inline-block">About</a></li>
                                <li><button onClick={(e) => { e.preventDefault(); setShowContact(true); }} className="hover:text-text-main transition-all hover:translate-x-1 inline-block uppercase text-left">Contact</button></li>
                                <li><Link href="/legal" className="hover:text-text-main transition-all hover:translate-x-1 inline-block">Legal</Link></li>
                                </ul>
                            </div>

                            <div className="hidden lg:block">
                                <button
                                    onClick={scrollToTop}
                                    className="w-20 h-20 rounded-full bg-white text-accent-orange flex items-center justify-center hover:bg-text-main hover:text-white transition-all duration-500 group shadow-lg"
                                >
                                    <ArrowUp size={32} className="group-hover:-translate-y-2 transition-transform duration-500" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Giant Watermark Typography */}
                    <div className="w-full flex justify-center -mt-16 leading-none select-none pointer-events-none">
                        <h1 className="text-[15vw] lg:text-[13vw] font-black leading-[0.75] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/30 to-transparent uppercase relative z-0">
                            OKVEVO
                        </h1>
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between w-full pt-8 md:pt-16 border-t border-white/20 gap-12 mt-10">
                        <div className="flex gap-10">
                            <Link href="/legal" className="text-white hover:text-text-main transition-colors font-black uppercase text-[11px] tracking-widest">PRIVACY_POLICY</Link>
                            <Link href="/legal" className="text-white hover:text-text-main transition-colors font-black uppercase text-[11px] tracking-widest">TERMS_OF_SERVICE</Link>
                            <a href="#" className="text-white hover:text-text-main transition-colors font-black uppercase text-[11px] tracking-widest">Twitter</a>
                            <a href="#" className="text-white hover:text-text-main transition-colors font-black uppercase text-[11px] tracking-widest">Instagram</a>
                            <a href="#" className="text-white hover:text-text-main transition-colors font-black uppercase text-[11px] tracking-widest">LinkedIn</a>
                        </div>

                        <p className="text-[11px] font-black tracking-[0.3em] uppercase text-white/60">
                            © 2026 OKVEVO INC. <span className="text-text-main/40">EXPERIMENT 01.</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Contact Modal */}
            <AnimatePresence>
                {showContact && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowContact(false)}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#111] border border-white/10 p-8 md:p-12 rounded-[2rem] max-w-lg w-full relative shadow-2xl overflow-hidden m-auto"
                        >
                            {/* Decorative background */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-orange via-white to-accent-orange opacity-50" />
                            
                            <button 
                                onClick={() => setShowContact(false)}
                                className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-white/70 hover:text-white" />
                            </button>

                            <h3 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Get in Touch</h3>
                            <p className="text-white/50 text-sm font-medium mb-10">We'd love to hear from you. Reach out to discuss your next cinematic project.</p>

                            <div className="flex flex-col gap-6">
                                {/* Email Action */}
                                <a 
                                    href="mailto:hello@okvevo.com"
                                    className="flex items-center gap-5 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-accent-orange/10 flex items-center justify-center group-hover:bg-accent-orange/20 transition-colors">
                                        <Mail className="w-5 h-5 text-accent-orange" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black tracking-widest uppercase text-white/40 mb-1">Email Us</p>
                                        <p className="text-lg font-bold text-white group-hover:text-accent-orange transition-colors">hello@okvevo.com</p>
                                    </div>
                                </a>

                                {/* Phone Action */}
                                <a 
                                    href="tel:+919876543210"
                                    className="flex items-center gap-5 p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-full bg-accent-orange/10 flex items-center justify-center group-hover:bg-accent-orange/20 transition-colors">
                                        <Phone className="w-5 h-5 text-accent-orange" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black tracking-widest uppercase text-white/40 mb-1">Call Us</p>
                                        <p className="text-lg font-bold text-white group-hover:text-accent-orange transition-colors">+91 98765 43210</p>
                                    </div>
                                </a>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </footer>
    );
};

export default Footer;
