'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, CreditCard, User } from 'lucide-react';

const DashNavbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Billing', href: '/billing', icon: <CreditCard size={16} /> },
        { name: 'Profile', href: '/profile', icon: <User size={16} /> },
    ];

    return (
        <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ${isScrolled ? 'py-4' : 'py-10'}`}>
            <div className="centering-container flex-row items-center justify-between !py-0">
                <div className={`flex items-center justify-between w-full px-10 py-5 rounded-full transition-all duration-700 ${isScrolled ? 'glass-card' : 'bg-transparent border-transparent'}`}>
                    <a href="/" className="text-2xl font-black tracking-[-0.05em] text-text-main flex items-center gap-1 group font-[family-name:var(--font-museo-moderno)]">
                        OKVEVO<span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
                    </a>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-12">
                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                className={`flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${isScrolled ? 'text-text-main hover:text-accent-orange' : 'text-text-main hover:text-accent-orange'}`}
                            >
                                {link.name}
                            </a>
                        ))}
                    </div>

                    {/* Mobile Toggle */}
                    <button
                        className="md:hidden p-2 transition-colors text-text-main"
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
                                className="flex items-center justify-center gap-3 text-2xl font-[family-name:var(--font-museo-moderno)] text-text-main hover:text-accent-orange"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                {link.icon}
                                {link.name}
                            </a>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default DashNavbar;
