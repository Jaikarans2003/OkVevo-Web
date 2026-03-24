'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, CreditCard, User, History } from 'lucide-react';
import CreditsDisplay from './CreditsDisplay';
import { useAuth } from '@/hooks/useAuth';

const DashNavbar = () => {
    const { userProfile } = useAuth();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [currentSectionTheme, setCurrentSectionTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        const observerOptions = {
            threshold: [0, 0.1, 0.5, 0.9, 1],
            rootMargin: "-80px 0px -80% 0px"
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

    const textColor = 'text-white';
    const textColorDim = 'text-white/70';

    const navLinks = [
        { name: 'History', href: '/history', icon: <History size={16} /> },
        { name: 'Billing', href: '/billing', icon: <CreditCard size={16} /> },
        { name: 'Profile', href: '/profile', icon: <User size={16} /> },
    ];

    return (
        <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ${isScrolled ? 'py-4' : 'py-10'}`}>
            <div className="centering-container flex-row items-center justify-between !py-0">
                <div className={`flex items-center justify-between w-full px-10 py-5 rounded-full transition-all duration-700 ${isScrolled ? 'glass-navbar' : 'bg-[#0A0A0A]/40 backdrop-blur-xl border border-white/5'}`}>
                    <Link href="/" className={`text-2xl font-black tracking-[-0.05em] flex items-center gap-2 group transition-colors duration-500 ${textColor}`}>
                        <Image 
                            src="/OKVEVO WithOut BackGrounds/Orange.svg" 
                            alt="OKVEVO Logo" 
                            width={40} 
                            height={40} 
                            className="w-12 h-12 object-contain"
                        />
                    </Link>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-6">
                        {userProfile && <CreditsDisplay userId={userProfile.uid} variant="navbar" />}
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={`flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-colors duration-500 ${textColor} hover:text-accent-orange`}
                            >
                                {link.name}
                            </Link>
                        ))}
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
                        {userProfile && (
                            <div className="mb-4">
                                <CreditsDisplay userId={userProfile.uid} variant="navbar" showLink={false} />
                            </div>
                        )}
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="flex items-center justify-center gap-3 text-2xl text-text-main hover:text-accent-orange"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {link.icon}
                                {link.name}
                            </Link>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default DashNavbar;
