'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

interface NavbarProps {
    user?: any;
    onJoinClick: () => void;
}

const Navbar = ({ user, onJoinClick }: NavbarProps) => {
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

    const isNavbarDark = currentSectionTheme === 'dark';
    const textColor = isNavbarDark ? 'text-white' : 'text-text-main';
    const textColorDim = isNavbarDark ? 'text-white/70' : 'text-text-main/70';

    const navLinks = [
        { name: 'Features', href: '#features' },
        { name: 'Process', href: '#how-it-works' },
        { name: 'Pricing', href: '#pricing' },
    ];

    return (
        <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ${isScrolled ? 'py-4' : 'py-10'}`}>
            <div className="centering-container flex-row items-center justify-between !py-0">
                <div className={`flex items-center justify-between w-full px-10 py-5 rounded-full transition-all duration-700 ${isScrolled ? 'glass-navbar' : 'bg-transparent border-transparent'}`}>
                    <a href="/" className={`text-2xl font-black tracking-[-0.05em] flex items-center gap-1 group transition-colors duration-500 ${textColor}`}>
                        OKVEVO<span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
                    </a>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-12">
                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                className={`text-xs tracking-[0.2em] uppercase transition-colors duration-500 ${isScrolled ? `${textColor} hover:text-accent-orange` : `${textColorDim} hover:${textColor}`}`}
                            >
                                {link.name}
                            </a>
                        ))}
                        <div className="flex items-center gap-6">
                            <ThemeToggle forceColor={isNavbarDark ? 'white' : 'black'} />
                            <button
                                onClick={onJoinClick}
                                className={`px-8 py-3 rounded-full text-xs tracking-[0.1em] uppercase transition-all cursor-pointer ${isScrolled ? 'bg-accent-orange text-white hover:bg-text-main hover:text-bg-main' : `bg-text-main/10 ${textColor} border border-text-main/20 hover:bg-text-main hover:text-bg-main`}`}
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
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="absolute top-full left-4 right-4 mt-4 glass-card p-12 rounded-[40px] md:hidden flex flex-col gap-8 text-center"
                    >
                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                className="text-2xl text-text-main hover:text-accent-orange"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {link.name}
                            </a>
                        ))}
                        <div className="flex flex-col gap-6">
                            <button
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    onJoinClick();
                                }}
                                className="btn-premium w-full py-5 text-center justify-center !bg-accent-orange cursor-pointer"
                            >
                                {user ? 'Go to Workspace' : 'Join Platform'}
                            </button>
                            <div className="flex justify-center">
                                <ThemeToggle />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
