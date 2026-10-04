'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, Layers, Menu, Sparkles, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

const LOGO = '/OKVEVO%20Logos%20WithOut%20BackGrounds/Orange.svg';

const PRODUCT: { name: string; blurb: string; href: string; Icon: LucideIcon }[] = [
    { name: 'How it works', blurb: 'Ask, let her work, and watch her remember.', href: '/#how', Icon: Sparkles },
    { name: 'Why Nia', blurb: 'A generalist you can help, a professional you can trust.', href: '/#why', Icon: Layers },
    { name: 'Download', blurb: 'Nia for Mac and Windows.', href: '/nia', Icon: Download },
];

const LINKS = [
    { name: 'Pricing', href: '/#pricing' },
    { name: 'FAQ', href: '/#faq' },
];

const NAV_ITEM =
    'inline-flex h-10 items-center rounded-full px-3 text-sm text-[#2A2A2A]/80 transition-colors hover:bg-white/70 hover:text-[#2A2A2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6F20]';

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const [product, setProduct] = useState(false);
    const menu = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!product) return;
        const close = (event: KeyboardEvent) => event.key === 'Escape' && setProduct(false);
        const away = (event: PointerEvent) => !menu.current?.contains(event.target as Node) && setProduct(false);
        window.addEventListener('keydown', close);
        window.addEventListener('pointerdown', away);
        return () => {
            window.removeEventListener('keydown', close);
            window.removeEventListener('pointerdown', away);
        };
    }, [product]);

    return (
        <header className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-4">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:pointer-events-auto focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-[#2A2A2A] focus:px-4 focus:py-2 focus:text-sm focus:text-[#F4F2EE]"
            >
                Skip to content
            </a>
            <div className="pointer-events-auto relative w-full max-w-[760px]">
                <div className="flex items-center justify-between gap-2 rounded-full border border-white/70 bg-[#F4F2EE]/60 px-2.5 py-2 shadow-[0_12px_40px_rgba(42,42,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-2xl backdrop-saturate-150">
                    <Link href="/" aria-label="OkVevo home" className="inline-flex shrink-0 items-center px-1.5">
                        <img src={LOGO} alt="" className="h-12 w-12" />
                    </Link>

                    <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
                        <div
                            ref={menu}
                            className="relative"
                            onMouseEnter={() => setProduct(true)}
                            onMouseLeave={() => setProduct(false)}
                        >
                            <button
                                type="button"
                                className={`${NAV_ITEM} gap-1`}
                                aria-expanded={product}
                                aria-controls="nav-product"
                                onClick={() => setProduct((value) => !value)}
                            >
                                Product
                                <ChevronDown size={14} strokeWidth={1.75} className={`transition-transform duration-200 ${product ? 'rotate-180' : ''}`} />
                            </button>
                            <div
                                id="nav-product"
                                data-state={product ? 'open' : 'closed'}
                                className="absolute left-1/2 top-[calc(100%+0.75rem)] w-[21rem] origin-top -translate-x-1/2 rounded-[1.75rem] border border-white/80 bg-[#F4F2EE]/90 p-2 shadow-[0_20px_50px_rgba(42,42,42,0.12)] backdrop-blur-2xl transition-[opacity,transform,visibility] duration-200 ease-out before:absolute before:-top-4 before:left-0 before:h-4 before:w-full before:content-[''] data-[state=closed]:invisible data-[state=closed]:-translate-y-1 data-[state=closed]:scale-95 data-[state=closed]:opacity-0"
                            >
                                {PRODUCT.map(({ name, blurb, href, Icon }) => (
                                    <Link
                                        key={href}
                                        href={href}
                                        className="flex items-start gap-3 rounded-3xl p-3 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6F20]"
                                        onClick={() => setProduct(false)}
                                    >
                                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#FF6F20]/12 text-[#FF6F20]">
                                            <Icon size={17} strokeWidth={1.75} aria-hidden />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-medium text-[#2A2A2A]">{name}</span>
                                            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-[#2A2A2A]/60">{blurb}</span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                        {LINKS.map((link) => (
                            <Link key={link.name} href={link.href} className={NAV_ITEM}>
                                {link.name}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-1">
                        <Link
                            href="/#pricing"
                            className="hidden h-10 items-center rounded-full bg-[#FF6F20] px-4 text-sm font-medium text-[#2A2A2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2A2A2A] md:inline-flex"
                        >
                            Get Nia
                        </Link>
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#2A2A2A] md:hidden"
                            aria-expanded={open}
                            aria-label={open ? 'Close menu' : 'Open menu'}
                            onClick={() => setOpen((value) => !value)}
                        >
                            {open ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
                        </button>
                    </div>
                </div>

                {open ? (
                    <nav
                        className="mt-2 rounded-3xl border border-white/80 bg-[#F4F2EE]/90 p-3 shadow-[0_16px_40px_rgba(42,42,42,0.1)] backdrop-blur-2xl md:hidden"
                        aria-label="Mobile"
                    >
                        {[...PRODUCT, ...LINKS].map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="block rounded-2xl px-3 py-3 text-base text-[#2A2A2A]"
                                onClick={() => setOpen(false)}
                            >
                                {link.name}
                            </Link>
                        ))}
                        <Link
                            href="/#pricing"
                            onClick={() => setOpen(false)}
                            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#FF6F20] text-sm font-medium text-[#2A2A2A]"
                        >
                            Get Nia
                        </Link>
                    </nav>
                ) : null}
            </div>
        </header>
    );
}
