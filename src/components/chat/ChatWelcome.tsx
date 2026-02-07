"use client";

import { FileText, Image as ImageIcon, User, Code } from 'lucide-react';
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
            label: 'Write copy',
            action: 'Write a creative story about...',
            color: 'bg-yellow-100 text-yellow-600',
        },
        {
            icon: ImageIcon,
            label: 'Image generation',
            action: 'Generate an image of...',
            color: 'bg-blue-100 text-blue-600',
        },
        {
            icon: User,
            label: 'Create avatar',
            action: 'Create a character avatar for...',
            color: 'bg-green-100 text-green-600',
        },
        {
            icon: Code,
            label: 'Write code',
            action: 'Write a python script to...',
            color: 'bg-pink-100 text-pink-600',
        },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${tc.text} text-center`}>
                Welcome to OKVEVO
            </h1>
            <p className={`text-center ${tc.textDim} mb-12 text-lg max-w-lg`}>
                Get started by typing a task and I can do the rest. Not sure where to start?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {suggestions.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => onSuggestionClick(item.action)}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group
                            ${resolvedTheme === 'light'
                                ? 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-lg'
                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                            }
                        `}
                    >
                        <div className={`p-3 rounded-xl ${item.color} group-hover:scale-110 transition-transform duration-300`}>
                            <item.icon className="w-5 h-5" />
                        </div>
                        <span className={`font-medium ${tc.text}`}>{item.label}</span>
                        <div className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${tc.textDim}`}>
                            +
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
