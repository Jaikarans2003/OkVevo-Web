'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowUpRight,
    Zap,
    TrendingUp,
    MessageCircle,
    Eye,
    Plus,
    Search,
    ChevronRight,
    Globe,
    Target,
    LucideIcon
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LIME_ACCENT = '#DFFF00';

export default function SocialStudio() {
    const pathname = usePathname();
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#DFFF00]/30 selection:text-black pb-20">
            {/* Header Navigation */}
            <nav className="h-24 px-8 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-12">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO"
                            width={100}
                            height={32}
                            className="opacity-90"
                        />
                    </Link>
                    <div className="hidden lg:flex items-center gap-8">
                        {[
                            { name: 'Product Studio', href: '/studio/product' },
                            { name: 'Social Media', href: '/studio/social' },
                            { name: 'Director', href: '/studio/director' }
                        ].map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`text-xs font-black uppercase tracking-[0.2em] transition-all ${pathname === item.href ? 'text-[#DFFF00]' : 'text-white/40 hover:text-white'}`}
                            >
                                {item.name}
                                {pathname === item.href && (
                                    <span className="absolute -bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#DFFF00]/50 to-transparent"></span>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>

            </nav>

            <main className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
                {/* Hero Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 h-[600px] rounded-[40px] bg-[#0A0A0A] p-12 flex flex-col justify-between border border-white/5 relative overflow-hidden group">
                        <div className="space-y-6 relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Vevo Intelligence</span>
                            <h1 className="text-5xl md:text-6xl font-black leading-[0.9] tracking-tighter">
                                WE ARE EXPERTS <br />
                                <span className="text-white/40 italic-serif font-normal">IN VIRAL GROWTH</span>
                            </h1>
                        </div>

                        <div className="space-y-8 relative z-10">
                            <div className="flex gap-4">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0A0A0A] bg-white/10 overflow-hidden">
                                            <Image src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="avatar" width={40} height={40} />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] font-medium text-white/40 max-w-[150px] leading-tight flex items-center">
                                    100+ Brands connected to our intelligence networks
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="email"
                                    placeholder="Enter e-mail"
                                    className="bg-white/5 border border-white/10 rounded-full px-8 h-14 text-sm focus:outline-none focus:border-[#DFFF00]/50 transition-colors flex-1"
                                />
                                <button className="h-14 px-8 rounded-full bg-[#DFFF00] text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2 group">
                                    Leave a request <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* Metallic Aura */}
                        <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-[#DFFF00]/5 blur-[120px] rounded-full pointer-events-none" />
                    </div>

                    <div className="lg:col-span-7 h-[600px] rounded-[40px] bg-[#0A0A0A] relative overflow-hidden group border border-white/5">
                        <Image
                            src="/noir_visual.png"
                            alt="Abstraction"
                            fill
                            className="object-cover opacity-80 group-hover:scale-105 transition-transform duration-1000"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                        <div className="absolute top-8 right-8 flex gap-2">
                            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 cursor-pointer hover:bg-white hover:text-black transition-all">
                                <Globe size={16} />
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 cursor-pointer hover:bg-white hover:text-black transition-all">
                                <Target size={16} />
                            </div>
                        </div>

                        <div className="absolute bottom-12 left-12 right-12">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                    <Zap size={20} className="text-[#DFFF00]" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold opacity-40 uppercase tracking-widest">Story of SUCCESS</h3>
                                    <p className="text-xl font-black italic">Vevo Intelligence v4.0</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Second Section - Call to Action Text */}
                <div className="py-20 text-center space-y-6">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none max-w-4xl mx-auto uppercase">
                        Get results <br />
                        <span className="text-white/20 italic-serif font-normal lowercase">possible already today!</span>
                    </h2>
                    <p className="text-sm text-white/40 max-w-xl mx-auto font-medium">
                        Our experts are ready to develop strategies that lead to results in your business today. Order a free consultation and start reaching goals!
                    </p>
                    <button className="px-10 py-4 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all group">
                        Order a consultation <ChevronRight size={14} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* Service Cards / Trends Section */}
                <div className="space-y-12">
                    <h2 className="text-4xl font-black tracking-tighter uppercase">Our Services</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <TrendCard Noir label="SEO" title="Search Intelligence" color="#DFFF00" icon={<Zap />} />
                        <TrendCard label="SMM" title="Viral Growth" color="#DFFF00" icon={<TrendingUp />} />
                        <TrendCard Noir label="Content" title="Studio Noir" color="#0A0A0A" icon={<MessageCircle />} />
                        <TrendCard label="Ads" title="Paid Performance" color="#DFFF00" icon={<Eye />} />
                    </div>
                </div>

                {/* Events / Campaigns Table Section */}
                <div className="space-y-12 pt-20">
                    <div className="flex items-end justify-between">
                        <h2 className="text-4xl font-black tracking-tighter uppercase leading-[0.8]">
                            Events for <br />
                            <span className="text-white/20 italic-serif font-normal lowercase">creators in 2026</span>
                        </h2>
                        <p className="text-[10px] font-medium text-white/40 max-w-[200px] leading-tight text-right">
                            We have prepared a series of events specifically for your growth.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <EventItem title="Digital Growth" desc="Workshop on scaling your personal brand using AI" date="12/03/26" />
                        <EventItem title="Success Exhibition" desc="Case study of viral campaigns that broke the internet" date="29/05/26" />
                        <EventItem title="Business Masterclass" desc="Deep dive into marketing automation and CRM" date="06/06/26" />
                        <EventItem title="Innovators Forum" desc="Future of content creation and autonomous studios" date="18/08/26" />
                    </div>
                </div>
            </main>

            {/* Noir Footer */}
            <footer className="mt-40 bg-[#0A0A0A] rounded-[40px] mx-4 md:mx-8 p-12 md:p-20 relative overflow-hidden border border-white/5">
                <div className="flex flex-col md:flex-row justify-between items-start gap-12 relative z-10">
                    <div className="space-y-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#DFFF00]">Stay Connected</h3>
                        <p className="text-2xl md:text-3xl font-black tracking-tighter max-w-sm">
                            SUBSCRIBE TO LEARN MORE <br />
                            <span className="text-white/20 italic-serif font-normal lowercase">about our methods</span>
                        </p>
                    </div>
                    <div className="flex-1 max-w-md w-full flex flex-col sm:flex-row gap-3">
                        <input
                            type="email"
                            placeholder="Enter e-mail"
                            className="bg-white/5 border border-white/10 rounded-full px-8 h-14 text-sm focus:outline-none focus:border-[#DFFF00]/50 transition-colors flex-1"
                        />
                        <button className="h-14 px-8 rounded-full bg-[#DFFF00] text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                            Subscribe
                        </button>
                    </div>
                </div>

                <div className="mt-20 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 relative z-10">
                    <p className="text-[10px] font-bold text-white/20 tracking-widest uppercase">© 2026 OKVEVO. All Rights Reserved.</p>
                    <div className="flex gap-12 font-bold text-[10px] text-white/20 uppercase tracking-widest">
                        <Link href="#" className="hover:text-white transition-colors">Telegram</Link>
                        <Link href="#" className="hover:text-white transition-colors">Instagram</Link>
                        <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
                    </div>
                </div>

                {/* 3D Visual in Footer */}
                <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[50%] bg-[#DFFF00]/2 blur-[100px] rounded-full" />
            </footer>
        </div>
    );
}

function TrendCard({ label, title, color, icon, Noir = false }: { label: string, title: string, color: string, icon: any, Noir?: boolean }) {
    return (
        <div
            className={`h-[450px] rounded-[40px] p-8 flex flex-col justify-between group cursor-pointer transition-all duration-500 overflow-hidden relative border border-white/5 ${Noir ? 'bg-[#0A0A0A]' : 'bg-[#DFFF00] text-black'}`}
        >
            <div className="flex justify-between items-start relative z-10">
                <div className={`text-[10px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full ${Noir ? 'bg-[#DFFF00] text-black' : 'bg-black/5'}`}>
                    {label}
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${Noir ? 'border-white/10 group-hover:bg-[#DFFF00] group-hover:text-black' : 'border-black/10 group-hover:bg-black group-hover:text-[#DFFF00]'}`}>
                    <ArrowUpRight size={20} />
                </div>
            </div>

            <div className="space-y-4 relative z-10 transition-transform group-hover:translate-y-[-10px] duration-500">
                <div className={`p-4 rounded-[30px] border w-fit ${Noir ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                    {icon}
                </div>
                <h3 className={`text-4xl font-black leading-none tracking-tightest uppercase`}>
                    {title}
                </h3>
                <button className={`w-full py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${Noir ? 'bg-white text-black' : 'bg-black text-[#DFFF00]'} translate-y-8 opacity-0 group-hover:translate-y-0 group-hover:opacity-100`}>
                    Leave a request
                </button>
            </div>

            {/* Abstract Background Element */}
            {Noir && (
                <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-[#DFFF00]/5 blur-[60px] rounded-full group-hover:bg-[#DFFF00]/10 transition-all duration-500" />
            )}
            {!Noir && (
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
        </div>
    );
}

function EventItem({ title, desc, date }: { title: string, desc: string, date: string }) {
    return (
        <div className="group flex items-center justify-between py-8 border-b border-white/5 hover:px-8 transition-all duration-500 cursor-pointer hover:bg-[#0A0A0A]">
            <div className="space-y-1">
                <h3 className="text-2xl font-bold uppercase transition-transform group-hover:translate-x-2 duration-500">{title}</h3>
                <p className="text-sm text-white/30 font-medium transition-transform group-hover:translate-x-4 duration-500">{desc}</p>
            </div>
            <div className="flex items-center gap-12">
                <span className="text-sm font-bold text-white/40 tabular-nums">{date}</span>
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-[#DFFF00] group-hover:text-black transition-all">
                    <ArrowUpRight size={24} />
                </div>
            </div>
        </div>
    );
}
