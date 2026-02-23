"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ThemeOption = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeOption;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: ThemeOption) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeOption>('system');
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
    const [mounted, setMounted] = useState(false);

    // Detect system theme preference
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const updateSystemTheme = () => {
            if (theme === 'system') {
                setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
            }
        };

        // Initial detection
        updateSystemTheme();

        // Listen for system theme changes
        mediaQuery.addEventListener('change', updateSystemTheme);

        return () => mediaQuery.removeEventListener('change', updateSystemTheme);
    }, [theme]);

    useEffect(() => {
        setMounted(true);
        // Load theme from localStorage
        const savedTheme = localStorage.getItem('app-theme') as ThemeOption;
        if (savedTheme) {
            setThemeState(savedTheme);
            if (savedTheme === 'system') {
                const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                setResolvedTheme(isDark ? 'dark' : 'light');
            } else {
                setResolvedTheme(savedTheme);
            }
        } else {
            // Default to system
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setResolvedTheme(isDark ? 'dark' : 'light');
        }
    }, []);

    const setTheme = (newTheme: ThemeOption) => {
        setThemeState(newTheme);
        localStorage.setItem('app-theme', newTheme);

        if (newTheme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setResolvedTheme(isDark ? 'dark' : 'light');
        } else {
            setResolvedTheme(newTheme);
        }
    };

    // Apply theme to document root
    useEffect(() => {
        if (!mounted) return;

        const root = window.document.documentElement;
        if (resolvedTheme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [resolvedTheme, mounted]);

    // Prevent flash of unstyled content
    if (!mounted) {
        return <div className="h-screen bg-bg-main" />;
    }

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
