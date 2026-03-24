'use client';

import { ArrowUp } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const Footer = () => {
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
                                    <li><a href="#" className="hover:text-text-main transition-all hover:translate-x-1 inline-block">Contact</a></li>
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
        </footer>
    );
};

export default Footer;
