'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import CreditsDisplay from './CreditsDisplay';
import { useAuth } from '@/hooks/useAuth';

interface StudioNavbarProps {
    rightContent?: ReactNode;
}

export default function StudioNavbar({ rightContent }: StudioNavbarProps) {
    const pathname = usePathname();
    const { userProfile } = useAuth();

    const navLinks = [
        // { name: 'Director', href: '/workspace/director' },
        { name: 'AI Influencer', href: '/workspace/ai-influencer' },
        // { name: 'Product Studio', href: '/workspace/product' },
        // { name: 'Social Media', href: '/workspace/social' }
    ];

    return (
        <nav className="h-16 px-6 md:px-8 flex items-center justify-between border border-white/10 fixed top-5 left-1/2 -translate-x-1/2 bg-white/[0.02] backdrop-blur-2xl z-[90] w-[95%] max-w-[1200px] rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            <Link href="/workspace" className="flex items-center gap-2 group transition-all duration-300">
                <Image
                    src="/OKVEVO WithOut BackGrounds/Orange.svg"
                    alt="OKVEVO Logo"
                    width={40}
                    height={40}
                    className="w-10 h-10 object-contain transition-transform duration-300 group-hover:scale-110"
                    priority
                />
            </Link>

            <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
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

            <div className="flex items-center gap-4">
                {userProfile && <CreditsDisplay userId={userProfile.uid} variant="navbar" />}
                {/* Avatar Profiles Link */}
                <Link
                    href="/workspace/avatar-profiles"
                    className={`relative text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === '/workspace/avatar-profiles' ? 'text-accent-orange' : 'text-accent-orange/60 hover:text-accent-orange'}`}
                >
                    Avatars
                    {pathname === '/workspace/avatar-profiles' && (
                        <div className="absolute -bottom-2 left-0 right-0 h-[1px] bg-accent-orange opacity-40" />
                    )}
                </Link>
                {/* Profile Link - Orange Color */}
                <Link
                    href="/profile"
                    className={`relative text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === '/profile' ? 'text-accent-orange' : 'text-accent-orange/60 hover:text-accent-orange'}`}
                >
                    Profile
                    {pathname === '/profile' && (
                        <div className="absolute -bottom-2 left-0 right-0 h-[1px] bg-accent-orange opacity-40" />
                    )}
                </Link>
                <Link
                    href="/workspace/user-manual"
                    className={`relative text-[10px] font-black uppercase tracking-[0.2em] transition-all ${pathname === '/workspace/user-manual' ? 'text-accent-orange' : 'text-accent-orange/60 hover:text-accent-orange'}`}
                >
                    User Manual
                    {pathname === '/workspace/user-manual' && (
                        <div className="absolute -bottom-2 left-0 right-0 h-[1px] bg-accent-orange opacity-40" />
                    )}
                </Link>
                
                {/* {rightContent} */}
            </div>
        </nav>
    );
}
