"use client";

import Link from 'next/link';
import Image from 'next/image';
import { History, RefreshCw, User, Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

interface FloatingSidebarProps {
    resetConversation: () => void;
}

export default function FloatingSidebar({ resetConversation }: FloatingSidebarProps) {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const toggleTheme = () => {
        const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
        setTheme(nextTheme);
    };

    return (
        <aside className="fixed left-6 top-1/2 transform -translate-y-1/2 z-50 animate-in fade-in slide-in-from-left-5 duration-700">
            <div className={`${tc.sidebar} rounded-full py-6 px-3 flex flex-col items-center gap-6 shadow-2xl border border-white/5 backdrop-blur-xl`}>

                {/* Logo / Home */}
                <Link href="/chat" className="group relative">
                    <div className={`p-3 ${theme === 'light' ? 'bg-black hover:bg-black/80' : 'bg-accent-orange/10 hover:bg-accent-orange/20'} rounded-full transition-all duration-300`}>
                        <Image
                            src="/OKVEVO Logos WithOut BackGrounds/Orange.svg"
                            alt="OKVEVO Logo"
                            width={24}
                            height={24}
                            className="w-6 h-6 group-hover:scale-110 transition-transform"
                            priority
                        />
                    </div>
                </Link>

                <div className="w-8 h-px bg-accent-orange/20"></div>

                {/* Main Actions */}
                <div className="flex flex-col gap-4">
                    {/* History - points to Generations page as requested */}
                    <Link href="/generations" className="group relative p-3 rounded-full hover:bg-white/10 transition-all" title="History">
                        <History className="w-5 h-5 text-accent-orange group-hover:scale-110 transition-transform" />
                    </Link>

                    {/* AI Studio (Chat/Creation) */}
                    <Link href="/studio" className="group relative p-3 rounded-full hover:bg-white/10 transition-all" title="AI Studio">
                        <Sparkles className={`w-5 h-5 ${tc.text} group-hover:scale-110 transition-transform`} />
                    </Link>

                    <button
                        onClick={resetConversation}
                        className="group relative p-3 rounded-full hover:bg-white/10 transition-all"
                        title="New Chat"
                    >
                        <RefreshCw className={`w-5 h-5 ${tc.text} group-hover:rotate-180 transition-all duration-500`} />
                    </button>

                    <Link href="/profile" className="group relative p-3 rounded-full hover:bg-white/10 transition-all" title="Profile">
                        <User className={`w-5 h-5 ${tc.text} group-hover:scale-110 transition-transform`} />
                    </Link>
                </div>

                <div className="w-8 h-px bg-accent-orange/20"></div>

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="group relative p-3 rounded-full hover:bg-white/10 transition-all"
                    title={`Current: ${theme} mode`}
                >
                    {theme === 'light' ? (
                        <Moon className="w-5 h-5 text-text-main" />
                    ) : theme === 'dark' ? (
                        <Sun className="w-5 h-5 text-custom-cream" />
                    ) : (
                        <Sun className="w-5 h-5 text-text-main opacity-50" />
                    )}
                </button>
            </div>
        </aside>
    );
}
