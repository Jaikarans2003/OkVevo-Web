"use client";

import { FileText, TrendingUp, ShoppingBag, User } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

interface ChatWelcomeProps {
    onSuggestionClick: (suggestion: string) => void;
}

export default function ChatWelcome({ onSuggestionClick }: ChatWelcomeProps) {
    const { resolvedTheme } = useTheme();
    const tc = getThemeClasses(resolvedTheme);

    const suggestions = [
        {
            icon: FileText,
            label: 'From a Script',
            action: 'Generate a video from a script...',
            color: 'bg-yellow-100 text-yellow-600',
            annotations: [
                {
                    text: 'Generate Trailer',
                    position: '-top-12 -left-4',
                    arrow: (
                        <svg className="absolute top-8 left-12 w-8 h-8 text-gray-400 rotate-[130deg]" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M25,0 Q25,25 0,25" />
                            <path d="M10,15 L0,25 L10,35" />
                        </svg>
                    )
                },
                {
                    text: 'Generate Movie',
                    position: 'top-1/2 -left-32',
                    arrow: (
                        <svg className="absolute top-1/2 -right-8 -translate-y-1/2 w-8 h-4 text-gray-400 rotate-180" viewBox="0 0 50 25" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M50,12.5 L0,12.5" />
                            <path d="M10,2.5 L0,12.5 L10,22.5" />
                        </svg>
                    )
                }
            ]
        },
        {
            icon: TrendingUp,
            label: 'Instagram Trends',
            action: 'Create a trending Instagram reel...',
            color: 'bg-pink-100 text-pink-600',
            annotations: [
                {
                    text: 'Pick a Trend',
                    position: '-top-12 -right-4',
                    arrow: (
                        <svg className="absolute top-8 right-12 w-8 h-8 text-gray-400 -rotate-45" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M25,0 Q25,25 50,25" />
                            <path d="M40,15 L50,25 L40,35" />
                        </svg>
                    )
                }
            ]
        },
        {
            icon: ShoppingBag,
            label: 'Product Studio',
            action: 'Create a product video...',
            color: 'bg-blue-100 text-blue-600',
            annotations: [
                {
                    text: 'Product Shoots',
                    position: '-bottom-12 -left-4',
                    arrow: (
                        <svg className="absolute bottom-8 left-12 w-8 h-8 text-gray-400 -rotate-[130deg]" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M25,0 Q25,25 0,25" />
                            <path d="M10,15 L0,25 L10,35" />
                        </svg>
                    )
                },
                {
                    text: 'Product Ads',
                    position: 'top-1/2 -left-28',
                    arrow: (
                        <svg className="absolute top-1/2 -right-8 -translate-y-1/2 w-8 h-4 text-gray-400 rotate-180" viewBox="0 0 50 25" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M50,12.5 L0,12.5" />
                            <path d="M10,2.5 L0,12.5 L10,22.5" />
                        </svg>
                    )
                }
            ]
        },
        {
            icon: User,
            label: 'AI Influencer',
            action: 'Create an AI influencer content...',
            color: 'bg-green-100 text-green-600',
            annotations: [
                {
                    text: 'Motion Control',
                    position: 'top-1/2 -right-32',
                    arrow: (
                        <svg className="absolute top-1/2 -left-8 -translate-y-1/2 w-8 h-4 text-gray-400" viewBox="0 0 50 25" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M50,12.5 L0,12.5" />
                            <path d="M10,2.5 L0,12.5 L10,22.5" />
                        </svg>
                    )
                },
                {
                    text: 'Avatars',
                    position: '-bottom-12 -right-4',
                    arrow: (
                        <svg className="absolute bottom-8 right-12 w-8 h-8 text-gray-400 rotate-45" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M25,0 Q25,25 50,25" />
                            <path d="M40,15 L50,25 L40,35" />
                        </svg>
                    )
                }
            ]
        },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full min-h-full flex-1 max-w-4xl mx-auto px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className={`text-4xl md:text-5xl font-serif mb-4 text-white text-center`}>
                Welcome, I'm <span className="italic">VEVO</span>
            </h1>
            <p className={`text-center text-gray-400 mb-16 text-sm md:text-base max-w-lg`}>
                Get started by typing a task and I can do the rest.
                <br />
                Not sure where to start?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full relative">
                {suggestions.map((item, index) => (
                    <div key={index} className="relative group">
                        <button
                            onClick={() => onSuggestionClick(item.action)}
                            className={`flex flex-col items-center justify-center gap-4 p-6 rounded-3xl border transition-all duration-300 w-full aspect-square
                                bg-[#1A1A1A] border-white/5 hover:bg-[#252525] hover:border-white/10 group-hover:scale-105 z-10 relative
                            `}
                        >
                            <div className={`p-4 rounded-2xl ${item.color} mb-2`}>
                                <item.icon className="w-6 h-6" />
                            </div>
                            <span className={`font-medium text-gray-200 text-sm`}>{item.label}</span>
                        </button>

                        {/* Annotations */}
                        {item.annotations?.map((note, i) => (
                            <div
                                key={i}
                                className={`absolute ${note.position} pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-[100] whitespace-nowrap block`}
                            >
                                <span className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full border border-gray-700 shadow-xl">
                                    {note.text}
                                </span>
                                {note.arrow}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
