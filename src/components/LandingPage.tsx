'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Film, Sparkles, Zap, Rocket, ArrowRight, Play, Check, User } from 'lucide-react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function LandingPage() {
    const [scrollProgress, setScrollProgress] = useState(0);
    const [user, setUser] = useState<any>(null);
    const [isAnnual, setIsAnnual] = useState(true);
    const heroRef = useRef<HTMLDivElement>(null);
    const featuresRef = useRef<HTMLDivElement>(null);
    const howItWorksRef = useRef<HTMLDivElement>(null);
    const pricingRef = useRef<HTMLDivElement>(null);
    const ctaRef = useRef<HTMLDivElement>(null);

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
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const progress = (scrollPosition / (documentHeight - windowHeight)) * 100;
            setScrollProgress(progress);

            // Animate sections on scroll
            const sections = [heroRef, featuresRef, howItWorksRef, pricingRef, ctaRef];
            sections.forEach((ref) => {
                if (ref.current) {
                    const rect = ref.current.getBoundingClientRect();
                    const isVisible = rect.top < windowHeight * 0.75;
                    if (isVisible) {
                        ref.current.classList.add('animate-in');
                    }
                }
            });
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll(); // Initial check
        return () => window.removeEventListener('scroll', handleScroll);
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
                            onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })}
                            className="hover:text-custom-orange hover:scale-105 transition-all"
                        >
                            About Us
                        </button>
                        <button
                            onClick={() => pricingRef.current?.scrollIntoView({ behavior: 'smooth' })}
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
                {/* Animated Background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-custom-orange/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
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

            {/* Features Section */}
            <section
                ref={featuresRef}
                className="relative py-32 px-6 opacity-0 translate-y-10 transition-all duration-1000"
            >
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-5xl md:text-6xl font-light mb-6 text-custom-orange">
                            WHY
                        </h2>
                        <h1 className="text-5xl md:text-7xl font-[family-name:var(--font-museo-moderno)] font-bold mb-7 text-custom-orange">
                            OK VEVO
                        </h1>
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
                                className="group relative bg-custom-cream/5 backdrop-blur-sm border border-custom-orange/30 rounded-3xl p-8 hover:border-custom-orange hover:bg-custom-cream/10 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2"
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
            </section>

            {/* How It Works Section */}
            <section
                ref={howItWorksRef}
                className="relative py-32 px-6 bg-custom-cream/5 opacity-0 translate-y-10 transition-all duration-1000"
            >
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-5xl md:text-6xl font-black mb-6 text-custom-orange">
                            How It Works
                        </h2>
                        <p className="text-xl text-custom-cream/70 max-w-2xl mx-auto">
                            Three simple steps to bring your story to life
                        </p>
                    </div>

                    <div className="relative">
                        {/* Connection Line */}
                        <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-custom-orange via-orange-500 to-custom-orange transform -translate-y-1/2" />

                        <div className="grid md:grid-cols-3 gap-12 relative z-10">
                            {[
                                {
                                    step: '01',
                                    title: 'Share Your Story',
                                    description: 'Type or paste your script, story idea, or concept. Be as detailed or brief as you like.',
                                },
                                {
                                    step: '02',
                                    title: 'AI Analyzes & Creates',
                                    description: 'Our AI breaks down your story into scenes, suggests visuals, and generates each video clip.',
                                },
                                {
                                    step: '03',
                                    title: 'Review & Download',
                                    description: 'Watch your complete video, make any adjustments, and download your masterpiece.',
                                },
                            ].map((item, index) => (
                                <div
                                    key={index}
                                    className="relative text-center"
                                    style={{ animationDelay: `${index * 300}ms` }}
                                >
                                    <div className="inline-block mb-6">
                                        <div className="w-24 h-24 bg-gradient-to-br from-custom-orange to-orange-600 rounded-full flex items-center justify-center shadow-2xl shadow-custom-orange/50 border-4 border-custom-bg">
                                            <span className="text-3xl font-black text-custom-cream">
                                                {item.step}
                                            </span>
                                        </div>
                                    </div>
                                    <h3 className="text-2xl font-bold mb-4 text-custom-orange">
                                        {item.title}
                                    </h3>
                                    <p className="text-custom-cream/70 leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section
                ref={pricingRef}
                className="relative py-32 px-6 opacity-0 translate-y-10 transition-all duration-1000"
            >
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-5xl md:text-6xl font-black mb-6 text-custom-orange">
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
            </section>

            {/* CTA Section */}
            <section
                ref={ctaRef}
                className="relative py-32 px-7 opacity-0 translate-y-10 transition-all duration-1000"
            >
                <div className="max-w-4xl mx-auto text-center">
                    <div className="relative bg-gradient-to-br from-custom-orange/20 to-orange-600/20 backdrop-blur-sm border border-custom-orange/50 rounded-3xl p-12 md:p-16 overflow-hidden">
                        {/* Background Animation */}
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-custom-orange/30 rounded-full blur-3xl animate-pulse" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
                        </div>

                        <div className="relative z-10">
                            <h2 className="text-4xl md:text-5xl font-black mb-6 text-custom-cream">
                                Ready to Create Magic?
                            </h2>
                            <p className="text-xl text-custom-cream/80 mb-3 leading-relaxed">
                                Join thousands of creators who are already transforming their stories into stunning videos
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-3">
                                <Link href="/login" className="group px-10 py-5 bg-custom-orange text-custom-cream rounded-full font-bold text-xl shadow-2xl shadow-custom-orange/50 hover:shadow-custom-orange/70 transform hover:scale-110 transition-all duration-300 flex items-center gap-3">
                                    Start Creating Now
                                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative py-12 px-6 border-t border-custom-orange/30">
                <div className="max-w-6xl mx-auto text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Film className="w-6 h-6 text-custom-orange" />
                        <span className="text-xl font-[family-name:var(--font-museo-moderno)] font-bold text-custom-orange">OKVEVO</span>
                    </div>
                    <p className="text-custom-cream/50 text-sm">
                        © 2026 OKVEVO. Transform your words into motion.
                    </p>
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
