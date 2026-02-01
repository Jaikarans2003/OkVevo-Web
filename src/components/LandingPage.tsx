'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Film, Sparkles, Zap, Rocket, ArrowRight, Play, Check, User, Twitter, Linkedin, Instagram, Github } from 'lucide-react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function LandingPage() {
    const [scrollProgress, setScrollProgress] = useState(0);
    const [scrollY, setScrollY] = useState(0);
    const [user, setUser] = useState<any>(null);
    const [isAnnual, setIsAnnual] = useState(true);
    const heroRef = useRef<HTMLDivElement>(null);
    const whyAndHowRef = useRef<HTMLDivElement>(null);
    const pricingAndCtaRef = useRef<HTMLDivElement>(null);

    // Pricing calculations
    const monthlyPrices = {
        hobby: 4999,
        pro: 12999,
    };

    const getPrice = (monthlyPrice: number) => {
        if (isAnnual) {
            return Math.round(monthlyPrice * 0.75); // 25% discount
        }
        return monthlyPrice;
    };

    useEffect(() => {
        // Optimized scroll handler for Parallax and Progress Bar
        let ticking = false;

        const handleScroll = () => {
            const scrollPosition = window.scrollY;

            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const windowHeight = window.innerHeight;
                    const documentHeight = document.documentElement.scrollHeight;
                    const progress = (scrollPosition / (documentHeight - windowHeight)) * 100;

                    setScrollProgress(progress);
                    setScrollY(scrollPosition);
                    ticking = false;
                });

                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        // Initial setup
        handleScroll();

        // Intersection Observer for Section Animations
        const observerOptions = {
            threshold: 0.15, // Trigger when 15% of the element is visible
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target); // Only animate once
                }
            });
        }, observerOptions);

        const sections = [heroRef, whyAndHowRef, pricingAndCtaRef];
        sections.forEach((ref) => {
            if (ref.current) observer.observe(ref.current);
        });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            sections.forEach((ref) => {
                if (ref.current) observer.unobserve(ref.current);
            });
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="min-h-screen bg-custom-bg text-custom-cream overflow-x-hidden">
            {/* Scroll Progress Bar */}
            <div className="fixed top-0 left-0 w-full h-1 bg-custom-cream/10 z-50">
                <div
                    className="h-full bg-gradient-to-r from-custom-orange via-orange-500 to-custom-orange transition-all duration-300"
                    style={{ width: `${scrollProgress}%` }}
                />
            </div>

            {/* Navbar */}
            <nav className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-auto">
                <div className="bg-custom-bg/80 backdrop-blur-md border border-custom-orange/20 rounded-full pl-6 pr-2 py-2 flex items-center gap-8 shadow-2xl shadow-custom-orange/10">
                    <Link href="/" className="flex items-center gap-2 group">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={27}
                            height={27}
                            className="w-27 h-27 group-hover:scale-110 transition-transform"
                        />
                    </Link>

                    <div className="hidden md:flex items-center gap-7 text-sm font-medium text-custom-cream/70">
                        <button
                            onClick={() => whyAndHowRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            className="hover:text-custom-orange hover:scale-105 transition-all"
                        >
                            About Us
                        </button>
                        <button
                            onClick={() => pricingAndCtaRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            className="hover:text-custom-orange hover:scale-105 transition-all"
                        >
                            Pricing
                        </button>
                    </div>

                    {user ? (
                        <Link
                            href="/profile"
                            className="px-6 py-2.5 bg-custom-orange text-custom-cream text-sm font-bold rounded-full hover:bg-orange-600 hover:shadow-lg hover:shadow-custom-orange/20 transition-all duration-300 flex items-center gap-2"
                        >
                            <User className="w-4 h-4" />
                            Profile
                        </Link>
                    ) : (
                        <Link
                            href="/login"
                            className="px-6 py-2.5 bg-custom-orange text-custom-cream text-sm font-bold rounded-full hover:bg-orange-600 hover:shadow-lg hover:shadow-custom-orange/20 transition-all duration-300"
                        >
                            Sign In
                        </Link>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <section
                ref={heroRef}
                className="relative min-h-screen flex items-center justify-center overflow-hidden opacity-0 translate-y-10 transition-all duration-1000"
            >
                {/* Background Image */}
                <div
                    className="absolute inset-0 z-0 will-change-transform"
                    style={{ transform: `translateY(${scrollY * 0.5}px)` }}
                >
                    <Image
                        src="/BackGrounds/OKVEVOBackGrounds.jpg"
                        alt="Hero Background"
                        fill
                        className="object-cover opacity-60"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-custom-bg/90 via-custom-bg/50 to-custom-bg/90" />
                </div>

                <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
                    <div className="mb-7 inline-block">
                        <div className="p-17 bg-gradient-to-br from-custom-White to-orange-300 rounded-3xl transform hover:scale-110 transition-transform duration-500">
                            <Image
                                src="/OKVEVO WithOut BackGrounds/Orange.svg"
                                alt="OKVEVO Logo"
                                width={80}
                                height={80}
                                className="w-72 h-72"
                            />
                        </div>
                    </div>



                    <p className="text-3xl md:text-3xl text-custom-cream/80 mb-7 font-light">
                        Transform Your <span className="text-custom-orange font-bold">Words</span> into{' '}
                        <span className="text-custom-orange font-bold">Motion</span>
                    </p>

                    <p className="text-lg md:text-xl text-custom-cream/60 mb-12 max-w-2xl mx-auto leading-relaxed">
                        No cameras, no crew—just your imagination.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link href="/login" className="group px-8 py-4 bg-custom-orange text-custom-cream rounded-full font-bold text-lg shadow-lg shadow-custom-orange/50 hover:shadow-2xl hover:shadow-custom-orange/70 transform hover:scale-105 transition-all duration-300 flex items-center gap-2">
                            Get Started
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <button className="group px-8 py-4 bg-custom-cream/10 text-custom-cream rounded-full font-bold text-lg border-2 border-custom-cream/30 hover:border-custom-orange hover:bg-custom-cream/20 transform hover:scale-105 transition-all duration-300 flex items-center gap-2">
                            <Play className="w-5 h-5" />
                            Watch Demo
                        </button>
                    </div>

                    {/* Scroll Indicator */}
                </div>
            </section>

            {/* Why OK VEVO & How It Works Section */}
            <section
                ref={whyAndHowRef}
                className="relative py-32 px-6 bg-custom-bg opacity-0 translate-y-10 transition-all duration-1000"
            >
                <div className="max-w-6xl mx-auto mb-32">
                    <div className="text-center mb-20">
                        <h2 className="text-5xl md:text-6xl font-[family-name:var(--font-museo-moderno)] mb-6 text-custom-orange">
                            WHY CHOOSE US
                        </h2>
                        <p className="text-xl text-custom-cream/70 max-w-2xl mx-auto">
                            Experience the future of video creation with cutting-edge AI technology
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Sparkles,
                                title: 'AI-Powered',
                                description: 'Advanced AI analyzes your story and creates stunning visual scenes automatically',
                                color: 'from-orange-500 to-orange-600',
                            },
                            {
                                icon: Zap,
                                title: 'Lightning Fast',
                                description: 'Generate professional-quality videos in minutes, not days or weeks',
                                color: 'from-custom-orange to-orange-500',
                            },
                            {
                                icon: Rocket,
                                title: 'No Experience Needed',
                                description: 'Just describe your vision—our AI handles all the technical complexity',
                                color: 'from-orange-600 to-custom-orange',
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 shadow-xl hover:shadow-2xl"
                                style={{ animationDelay: `${index * 200}ms` }}
                            >
                                <div className={`inline-block p-4 bg-gradient-to-br ${feature.color} rounded-2xl mb-6 shadow-lg group-hover:shadow-2xl transition-shadow duration-500`}>
                                    <feature.icon className="w-8 h-8 text-custom-cream" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 text-custom-orange">
                                    {feature.title}
                                </h3>
                                <p className="text-custom-cream/70 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* How It Works Part */}
                <div className="relative py-32 px-12 bg-custom-cream/5 rounded-3xl">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row items-center gap-12">
                            <div className="md:w-1/2 text-left">
                                <h2 className="text-3xl md:text-7xl font-[family-name:var(--font-museo-moderno)] mb-6 text-custom-orange leading-tight">
                                    Three simple steps to bring <br /> your story to life
                                </h2>
                            </div>

                            <div className="md:w-1/2 relative flex justify-center w-full">
                                <Image
                                    src="/assets/WorkingBackGrounds.svg"
                                    alt="How It Works Process"
                                    width={1000}
                                    height={600}
                                    className="w-50 max-w-5xl h-auto hover:scale-105 transition-transform duration-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing & CTA Section */}
            <section
                ref={pricingAndCtaRef}
                className="relative py-32 px-6 opacity-0 translate-y-10 transition-all duration-1000"
            >
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-5xl md:text-6xl font-[family-name:var(--font-museo-moderno)] font-bold mb-6 text-custom-orange">
                            PRICING
                        </h2>
                        <p className="text-xl text-custom-cream/70 max-w-2xl mx-auto mb-8">
                            Choose the plan that fits your creative needs
                        </p>

                        {/* Annual/Monthly Toggle */}
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <span className={`text-lg font-medium transition-colors ${!isAnnual ? 'text-custom-cream' : 'text-custom-cream/50'
                                }`}>
                                Monthly
                            </span>
                            <button
                                onClick={() => setIsAnnual(!isAnnual)}
                                className="relative w-16 h-8 bg-custom-cream/20 rounded-full transition-all duration-300 hover:bg-custom-cream/30"
                            >
                                <div
                                    className={`absolute top-1 left-1 w-6 h-6 bg-custom-orange rounded-full transition-transform duration-300 ${isAnnual ? 'translate-x-8' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                            <div className="flex items-center gap-2">
                                <span className={`text-lg font-medium transition-colors ${isAnnual ? 'text-custom-cream' : 'text-custom-cream/50'
                                    }`}>
                                    Annual
                                </span>
                                {isAnnual && (
                                    <span className="px-2 py-1 bg-custom-orange/20 text-custom-orange text-xs font-bold rounded-full border border-custom-orange/50">
                                        Save 25%
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Hobby Plan */}
                        <div className="relative bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 flex flex-col">
                            <h3 className="text-2xl font-bold mb-2 text-custom-cream">Hobby</h3>
                            <div className="flex items-end gap-1 mb-6">
                                <span className="text-4xl font-black text-custom-orange">
                                    ₹{getPrice(monthlyPrices.hobby).toLocaleString('en-IN')}
                                </span>
                                <span className="text-custom-cream/60 mb-1">/mo</span>
                            </div>
                            {isAnnual && (
                                <p className="text-sm text-custom-cream/50 -mt-4 mb-4">
                                    Billed annually
                                </p>
                            )}
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-custom-cream/80">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>10 Mins Video Generation</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream/80">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>30 Credits</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream/80">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>1 Seat</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream/80">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>Max 1 Min per Video</span>
                                </li>
                            </ul>
                            <Link href="/login" className="block w-full py-3 bg-custom-cream/10 border border-custom-orange/50 hover:bg-custom-orange hover:text-custom-cream text-custom-orange text-center rounded-xl font-bold transition-all duration-300">
                                Get Started
                            </Link>
                        </div>

                        {/* Pro Plan */}
                        <div className="relative bg-gradient-to-b from-custom-orange/10 to-custom-bg border-2 border-custom-orange rounded-3xl p-8 transform md:-translate-y-4 shadow-2xl shadow-custom-orange/20 flex flex-col">
                            <div className="absolute top-0 right-0 bg-custom-orange text-custom-cream text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                                POPULAR
                            </div>
                            <h3 className="text-2xl font-bold mb-2 text-custom-cream">Pro</h3>
                            <div className="flex items-end gap-1 mb-6">
                                <span className="text-4xl font-black text-custom-orange">
                                    ₹{getPrice(monthlyPrices.pro).toLocaleString('en-IN')}
                                </span>
                                <span className="text-custom-cream/60 mb-1">/mo</span>
                            </div>
                            {isAnnual && (
                                <p className="text-sm text-custom-cream/50 -mt-4 mb-4">
                                    Billed annually
                                </p>
                            )}
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-custom-cream">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span className="font-bold">30 Mins Video Generation</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span className="font-bold">90 Credits</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>5 Seats</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>Max 1 Min per Video</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>Priority Support</span>
                                </li>
                            </ul>
                            <Link href="/login" className="block w-full py-4 bg-custom-orange text-custom-cream text-center rounded-xl font-bold shadow-lg hover:shadow-custom-orange/50 hover:scale-105 transition-all duration-300">
                                Get Pro Access
                            </Link>
                        </div>

                        {/* Enterprise Plan */}
                        <div className="relative bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 flex flex-col">
                            <h3 className="text-2xl font-bold mb-2 text-custom-cream">Enterprise</h3>
                            <div className="flex items-end gap-1 mb-6">
                                <span className="text-4xl font-black text-custom-orange">Custom</span>
                            </div>
                            <ul className="space-y-4 mb-8 flex-1">
                                <li className="flex items-center gap-3 text-custom-cream/80">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>Unlimited Video Generation</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream/80">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>Unlimited Seats</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream/80">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>Custom Video Duration</span>
                                </li>
                                <li className="flex items-center gap-3 text-custom-cream/80">
                                    <Check className="w-5 h-5 text-custom-orange flex-shrink-0" />
                                    <span>Dedicated Account Manager</span>
                                </li>
                            </ul>
                            <button className="block w-full py-3 bg-custom-cream/10 border border-custom-orange/50 hover:bg-custom-orange hover:text-custom-cream text-custom-cream text-center rounded-xl font-bold transition-all duration-300">
                                Speak to an Expert
                            </button>
                        </div>
                    </div>
                </div>

                {/* CTA Part */}
                <div className="max-w-7xl mx-auto text-center mt-32">
                    <div className="relative bg-gradient-to-br from-custom-orange/20 to-orange-600/20 backdrop-blur-sm border border-custom-orange/50 rounded-3xl p-12 md:p-16 overflow-hidden">
                        {/* Background Animation */}
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-custom-orange/30 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
                        </div>
                        <div className="relative z-10">

                            <p className="text-xl text-custom-cream/80 mb-7 leading-relaxed">
                                Join thousands of creators who are already transforming their stories into stunning videos
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-7">
                                <Link href="/login" className="group px-10 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-custom-cream rounded-full font-bold text-xl shadow-2xl hover:bg-white/20 transform hover:scale-110 transition-all duration-300 flex items-center gap-3">
                                    Start Creating Now
                                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative pt-10 pb-6 px-6 border-t border-white/10 bg-black/40 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-8">
                        {/* Brand Column */}
                        <div className="space-y-7">
                            <div className="flex items-center">
                                <Link href="/" className="flex items-center gap-2 group">
                                    <Image
                                        src="/OKVEVO WithOut BackGrounds/White.svg"
                                        alt="OKVEVO Logo"
                                        width={27}
                                        height={27}
                                        className="w-32 h-32 transition-transform"
                                    />
                                </Link>


                                {/* <span className="text-2xl font-[family-name:var(--font-museo-moderno)] font-bold text-custom-cream">OKVEVO</span> */}
                            </div>
                            <p className="text-custom-cream/60 leading-relaxed">
                                Transform your stories into stunning motion videos with the power of advanced AI technology.
                            </p>
                            <div className="flex gap-4">
                                <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-custom-cream/60 hover:bg-custom-orange hover:text-custom-cream transition-all duration-300">
                                    <Twitter className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-custom-cream/60 hover:bg-custom-orange hover:text-custom-cream transition-all duration-300">
                                    <Linkedin className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-custom-cream/60 hover:bg-custom-orange hover:text-custom-cream transition-all duration-300">
                                    <Instagram className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-custom-cream/60 hover:bg-custom-orange hover:text-custom-cream transition-all duration-300">
                                    <Github className="w-5 h-5" />
                                </a>
                            </div>
                        </div>

                        {/* Product Column */}
                        <div>
                            <h4 className="text-lg font-bold text-custom-cream mb-6">Product</h4>
                            <ul className="space-y-4">
                                {([
                                    { name: 'Features', action: () => whyAndHowRef.current?.scrollIntoView({ behavior: 'smooth' }) },
                                    { name: 'Pricing', action: () => pricingAndCtaRef.current?.scrollIntoView({ behavior: 'smooth' }) },
                                    // { name: 'Showcase', href: '#' },
                                    // { name: 'Integrations', href: '#' },
                                    // { name: 'Updates', href: '#' },
                                ] as any).map((item: any) => (
                                    <li key={item.name}>
                                        {item.action ? (
                                            <button
                                                onClick={item.action}
                                                className="text-custom-cream/60 hover:text-custom-orange transition-colors duration-300 flex items-center gap-2 group"
                                            >
                                                <span className="w-1 h-1 rounded-full bg-custom-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                                                {item.name}
                                            </button>
                                        ) : (
                                            <a href={item.href} className="text-custom-cream/60 hover:text-custom-orange transition-colors duration-300 flex items-center gap-2 group">
                                                <span className="w-1 h-1 rounded-full bg-custom-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                                                {item.name}
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Company Column */}
                        <div>
                            <h4 className="text-lg font-bold text-custom-cream mb-6">Company</h4>
                            <ul className="space-y-4">
                                {([
                                    { name: 'About Us', action: () => whyAndHowRef.current?.scrollIntoView({ behavior: 'smooth' }) },
                                    { name: 'Careers', href: 'mailto:info@tunetalez.com' },
                                    // { name: 'Blog', href: '#' },
                                    { name: 'Contact', href: 'mailto:info@tunetalez.com' },
                                    // { name: 'Press Kit', href: '#' },
                                ] as any).map((item: any) => (
                                    <li key={item.name}>
                                        {item.action ? (
                                            <button
                                                onClick={item.action}
                                                className="text-custom-cream/60 hover:text-custom-orange transition-colors duration-300 flex items-center gap-2 group"
                                            >
                                                <span className="w-1 h-1 rounded-full bg-custom-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                                                {item.name}
                                            </button>
                                        ) : (
                                            <a href={item.href} className="text-custom-cream/60 hover:text-custom-orange transition-colors duration-300 flex items-center gap-2 group">
                                                <span className="w-1 h-1 rounded-full bg-custom-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                                                {item.name}
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Legal Column */}
                        {/* <div>
                            <h4 className="text-lg font-bold text-custom-cream mb-6">Legal</h4>
                            <ul className="space-y-4">
                                {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Security'].map((item) => (
                                    <li key={item}>
                                        <a href="#" className="text-custom-cream/60 hover:text-custom-orange transition-colors duration-300 flex items-center gap-2 group">
                                            <span className="w-1 h-1 rounded-full bg-custom-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div> */}
                    </div>

                    <div className="pt-4 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-custom-cream/40 text-sm">
                            © 2026 OKVEVO. All rights reserved.
                        </p>
                        <div className="flex gap-8 text-sm text-custom-cream/40">
                            <a href="#" className="hover:text-custom-orange transition-colors">Privacy</a>
                            <a href="#" className="hover:text-custom-orange transition-colors">Terms</a>
                            <a href="#" className="hover:text-custom-orange transition-colors">Cookies</a>
                        </div>
                    </div>
                </div>
            </footer>

            <style jsx>{`
                @keyframes gradient {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient {
                    background-size: 200% 200%;
                    animation: gradient 3s ease infinite;
                }
                .animate-in {
                    opacity: 1 !important;
                    transform: translateY(0) !important;
                }
                .delay-1000 {
                    animation-delay: 1s;
                }
            `}</style>
        </div>
    );
}
