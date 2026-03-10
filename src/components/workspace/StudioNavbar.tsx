'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface StudioNavbarProps {
    rightContent?: ReactNode;
}

export default function StudioNavbar({ rightContent }: StudioNavbarProps) {
    const pathname = usePathname();

    const navLinks = [
        // { name: 'Director', href: '/workspace/director' },
        { name: 'AI Influencer', href: '/workspace/ai-influencer' },
        { name: 'Product Studio', href: '/workspace/product' },
        { name: 'Social Media', href: '/workspace/social' }
    ];

    return (
        <nav className="h-24 px-8 flex items-center justify-between border-b border-white/5 sticky top-0 bg-[#0B0B0D]/80 backdrop-blur-xl z-[90]">
            <Link href="/workspace" className="flex items-center gap-1 group">
                <Image
                    src="/OKVEVO WithOut BackGrounds/White.svg"
                    alt="OKVEVO Logo"
                    width={140}
                    height={40}
                    className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
                />
            </Link>

            <div className="flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                {navLinks.map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={`relative text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === item.href ? 'text-white' : 'text-white/20 hover:text-white/60'}`}
                    >
                        {item.name}
                        {pathname === item.href && (
                            <div className="absolute -bottom-2 left-0 right-0 h-[1px] bg-white opacity-20" />
                        )}
                    </Link>
                ))}
            </div>

            <div className="flex items-center gap-6">
                {/* History Link - Orange Color */}
                <Link
                    href="/history"
                    className={`relative text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === '/history' ? 'text-accent-orange' : 'text-accent-orange/60 hover:text-accent-orange'}`}
                >
                    History
                    {pathname === '/history' && (
                        <div className="absolute -bottom-2 left-0 right-0 h-[1px] bg-accent-orange opacity-40" />
                    )}
                </Link>
                
                {rightContent}
            </div>
        </nav>
    );
}
