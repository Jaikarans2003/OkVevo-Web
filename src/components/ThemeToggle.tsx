'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { motion } from 'framer-motion';

import { useEffect, useState } from 'react';

interface ThemeToggleProps {
    forceColor?: 'white' | 'black';
}

export const ThemeToggle = ({ forceColor }: ThemeToggleProps) => {
    const { theme, toggleTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="p-3 w-[44px] h-[44px] opacity-0" />;
    }

    const iconColor = forceColor
        ? (forceColor === 'white' ? 'text-white' : 'text-text-main')
        : 'text-text-main';

    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="p-3 rounded-full bg-text-main/5 border border-text-main/10 hover:bg-text-main/10 transition-colors flex items-center justify-center group"
            aria-label="Toggle theme"
        >
            <div className={`transition-colors duration-500 ${iconColor}`}>
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </div>
        </motion.button>
    );
};
