'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';
import Image from 'next/image';
import Link from 'next/link';

interface NavbarProps {
    user?: any;
    onJoinClick: () => void;
    theme?: 'light' | 'dark';
}

const Navbar = ({ user, onJoinClick, theme = 'dark' }: NavbarProps) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [currentSectionTheme, setCurrentSectionTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        const observerOptions = {
            threshold: [0, 0.1, 0.5, 0.9, 1],
            rootMargin: "-80px 0px -80% 0px" // Detect theme near the top of the viewport where navbar is
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const theme = entry.target.getAttribute('data-section-theme') as 'light' | 'dark';
                    if (theme) {
                        setCurrentSectionTheme(theme);
                    }
                }
            });
        }, observerOptions);

        const sections = document.querySelectorAll('[data-section-theme]');
        sections.forEach((section) => observer.observe(section));

        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, []);

    const textColor = theme === 'light' ? 'text-[#111111]' : 'text-white';
    const textColorDim = theme === 'light' ? 'text-[#111111]/70' : 'text-white/70';
    const containerClasses = theme === 'light' 
        ? 'flex items-center justify-between w-full px-10 py-5 rounded-full transition-all duration-250 ease-in-out bg-white/40 shadow-[0_4px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl border border-black/5 hover:bg-white/60 group/nav'
        : 'flex items-center justify-between w-full px-10 py-5 rounded-full transition-all duration-250 ease-in-out glass-navbar backdrop-blur-xl bg-gradient-to-r from-[#FF6600]/10 via-transparent to-[#FF6600]/10 hover:shadow-[0_0_30px_rgba(255,102,0,0.15)] group/nav';


    const navLinks = [
        { name: 'Demo', href: '/#demo' },
        { name: 'Features', href: '/#features' },
        { name: 'Pricing', href: '/#pricing' },
        { name: 'Blog', href: '/blogs' },
    ];

    return (
        <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ${isScrolled ? 'py-4' : 'py-10'}`}>
            <div className="centering-container flex-row items-center justify-between !py-0">
                <div className={containerClasses}>
                    <Link href="/" className={`text-2xl font-black tracking-[-0.05em] flex items-center gap-2 group transition-all duration-250 ease-in-out font-museo-moderno ${textColor} hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]`}>
                        <Image 
                            src={theme === 'light' ? "/OKVEVO WithOut BackGrounds/Black.svg" : "/OKVEVO WithOut BackGrounds/Orange.svg"}
                            alt="OKVEVO Logo" 
                            width={40} 
                            height={40} 
                            className="w-12 h-12 object-contain"
                            priority
                            fetchPriority="high"
                        />
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-12">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={`text-xs tracking-[0.2em] uppercase transition-colors duration-500 ${isScrolled ? `${textColor} hover:text-accent-orange` : `${textColorDim} hover:${textColor}`}`}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <div className="flex items-center gap-6">
                            {/* <ThemeToggle forceColor={isNavbarDark ? 'white' : 'black'} /> */}
                            <button
                                onClick={onJoinClick}
                                className={`px-8 py-3 rounded-full text-xs tracking-[0.1em] uppercase transition-all cursor-pointer ${
                                    isScrolled 
                                    ? 'bg-accent-orange text-white hover:bg-[#111111] hover:text-white' 
                                    : theme === 'light'
                                        ? 'border border-[#111111]/20 text-[#111111] hover:bg-[#111111] hover:text-white'
                                        : `bg-text-main/10 text-white border border-text-main/20 hover:bg-white hover:text-black`
                                }`}
                            >
                                {user ? 'Workspace' : 'Join'}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Toggle */}
                    <button
                        className={`md:hidden p-2 transition-colors duration-500 ${textColor}`}
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[150] md:hidden"
                    >
                        {/* Backdrop Blur Layer */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-3xl" onClick={() => setIsMobileMenuOpen(false)} />
                        
                        {/* Content Layer */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute inset-y-0 right-0 w-full max-w-[400px] bg-[#0A0A0A]/95 backdrop-blur-md border-l border-white/5 flex flex-col p-10 pt-32 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
                        >
                            {/* Accent Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-orange/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
                            
                            <motion.div 
                                className="flex flex-col gap-10"
                                initial="closed"
                                animate="open"
                                variants={{
                                    open: {
                                        transition: { staggerChildren: 0.1, delayChildren: 0.2 }
                                    },
                                    closed: {
                                        transition: { staggerChildren: 0.05, staggerDirection: -1 }
                                    }
                                }}
                            >
                                {navLinks.map((link, idx) => (
                                    <motion.div
                                        key={link.name}
                                        variants={{
                                            open: { opacity: 1, x: 0 },
                                            closed: { opacity: 0, x: 20 }
                                        }}
                                    >
                                        <Link
                                            href={link.href}
                                            className="group flex items-end gap-4"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <span className="text-[10px] font-black text-accent-orange/40 mb-2 font-mono group-hover:text-accent-orange transition-colors">
                                                0{idx + 1}
                                            </span>
                                            <span className="text-5xl md:text-6xl font-black text-white/50 group-hover:text-white transition-all duration-500 tracking-tighter">
                                                {link.name}
                                            </span>
                                        </Link>
                                    </motion.div>
                                ))}

                                <motion.div
                                    variants={{
                                        open: { opacity: 1, y: 0 },
                                        closed: { opacity: 0, y: 20 }
                                    }}
                                    className="pt-10 border-t border-white/5 mt-10"
                                >
                                    <button
                                        onClick={() => {
                                            setIsMobileMenuOpen(false);
                                            onJoinClick();
                                        }}
                                        className="w-full py-6 rounded-2xl bg-gradient-to-r from-accent-orange to-[#FF8000] text-white font-black uppercase tracking-[0.2em] text-[13px] hover:scale-[1.02] transition-transform active:scale-95 shadow-[0_20px_40px_rgba(255,102,0,0.3)] flex items-center justify-center gap-3"
                                    >
                                        {user ? 'Launch Dashboard' : 'Join Platform'}
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                    </button>
                                </motion.div>
                            </motion.div>

                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                className="mt-auto flex flex-col gap-4"
                            >
                                <div className="flex justify-between items-center text-[9px] font-bold text-white/10 uppercase tracking-[0.4em] py-6 border-t border-white/5">
                                    <span>© 2026 OKVEVO</span>
                                    <span>V2.4.0</span>
                                </div>
                            </motion.div>

                            {/* Close Button Inside Drawer */}
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="absolute top-10 right-10 p-4 rounded-full bg-white/5 text-white/40 hover:text-white transition-all hover:bg-white/10 border border-white/5"
                            >
                                <X size={20} />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;

