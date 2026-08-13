'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { getUserCredits } from '@/services/CreditsService';
import Link from 'next/link';

interface CreditsDisplayProps {
    userId: string;
    variant?: 'navbar' | 'card';
    showLink?: boolean;
}

export default function CreditsDisplay({ userId, variant = 'navbar', showLink = true }: CreditsDisplayProps) {
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCredits = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                const userCredits = await getUserCredits(userId);
                setCredits(userCredits);
            } catch (error) {
                console.error('Failed to fetch credits:', error);
                setCredits(0);
            } finally {
                setLoading(false);
            }
        };

        fetchCredits();

        // Refresh credits every 30 seconds
        const interval = setInterval(fetchCredits, 30000);
        return () => clearInterval(interval);
    }, [userId]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                <Zap className="w-4 h-4 text-[#FF4D00]/40" />
                <span className="text-sm font-bold text-white/30">—</span>
            </div>
        );
    }

    if (credits === null) {
        return null;
    }

    const content = (
        <div className={`flex items-center gap-2 ${variant === 'navbar' ? 'px-4 py-2 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-all duration-300' : 'px-6 py-4 bg-gradient-to-br from-[#FF4D00]/10 to-orange-600/10 rounded-2xl border border-[#FF4D00]/20'}`}>
            <Zap className={`${variant === 'navbar' ? 'w-4 h-4' : 'w-5 h-5'} text-[#FF4D00] fill-[#FF4D00]`} />
            <div className="flex flex-col">
                <span className={`${variant === 'navbar' ? 'text-sm' : 'text-base'} font-black text-white`}>
                    {credits.toLocaleString()}
                </span>
                {variant === 'card' && (
                    <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Credits</span>
                )}
            </div>
        </div>
    );

    if (showLink && variant === 'navbar') {
        return (
            <Link href="/billing" className="group">
                {content}
            </Link>
        );
    }

    return content;
}
