'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Film, Sparkles, Zap, Rocket, ArrowRight, Play, Check } from 'lucide-react';

export default function LandingPage() {
    const [scrollProgress, setScrollProgress] = useState(0);
    const heroRef = useRef<HTMLDivElement>(null);
    const featuresRef = useRef<HTMLDivElement>(null);
    const howItWorksRef = useRef<HTMLDivElement>(null);
    const ctaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const progress = (scrollPosition / (documentHeight - windowHeight)) * 100;
            setScrollProgress(progress);

            // Animate sections on scroll
            const sections = [heroRef, featuresRef, howItWorksRef, ctaRef];
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

    return (
        <div className="min-h-screen bg-custom-bg text-custom-cream overflow-x-hidden">
            {/* Scroll Progress Bar */}
            <div className="fixed top-0 left-0 w-full h-1 bg-custom-cream/10 z-50">
                <div
                    className="h-full bg-gradient-to-r from-custom-orange via-orange-500 to-custom-orange transition-all duration-300"
                    style={{ width: `${scrollProgress}%` }}
                />
            </div>

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
                    <div className="mb-8 inline-block">
                        <div className="p-4 bg-gradient-to-br from-custom-orange to-orange-600 rounded-3xl shadow-2xl shadow-custom-orange/50 transform hover:scale-110 transition-transform duration-500">
                            <Film className="w-16 h-16 text-custom-cream animate-bounce" />
                        </div>
                    </div>

                    <h1 className="text-7xl md:text-8xl font-black mb-6 bg-gradient-to-r from-custom-cream via-custom-orange to-custom-cream bg-clip-text text-transparent animate-gradient">
                        Brick2Brick
                    </h1>

                    <p className="text-2xl md:text-3xl text-custom-cream/80 mb-8 font-light">
                        Transform Your <span className="text-custom-orange font-bold">Words</span> into{' '}
                        <span className="text-custom-orange font-bold">Motion</span>
                    </p>

                    <p className="text-lg md:text-xl text-custom-cream/60 mb-12 max-w-2xl mx-auto leading-relaxed">
                        Harness the power of AI to turn your stories into stunning cinematic videos.
                        No cameras, no crew—just your imagination.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link href="/chat" className="group px-8 py-4 bg-custom-orange text-custom-cream rounded-full font-bold text-lg shadow-lg shadow-custom-orange/50 hover:shadow-2xl hover:shadow-custom-orange/70 transform hover:scale-105 transition-all duration-300 flex items-center gap-2">
                            Get Started
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <button className="group px-8 py-4 bg-custom-cream/10 text-custom-cream rounded-full font-bold text-lg border-2 border-custom-cream/30 hover:border-custom-orange hover:bg-custom-cream/20 transform hover:scale-105 transition-all duration-300 flex items-center gap-2">
                            <Play className="w-5 h-5" />
                            Watch Demo
                        </button>
                    </div>

                    {/* Scroll Indicator */}
                    <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
                        <div className="w-6 h-10 border-2 border-custom-orange/50 rounded-full flex items-start justify-center p-2">
                            <div className="w-1 h-3 bg-custom-orange rounded-full animate-pulse" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section
                ref={featuresRef}
                className="relative py-32 px-6 opacity-0 translate-y-10 transition-all duration-1000"
            >
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-5xl md:text-6xl font-black mb-6 text-custom-orange">
                            Why Brick2Brick?
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

            {/* CTA Section */}
            <section
                ref={ctaRef}
                className="relative py-32 px-6 opacity-0 translate-y-10 transition-all duration-1000"
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
                            <p className="text-xl text-custom-cream/80 mb-8 leading-relaxed">
                                Join thousands of creators who are already transforming their stories into stunning videos
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                                <Link href="/chat" className="group px-10 py-5 bg-custom-orange text-custom-cream rounded-full font-bold text-xl shadow-2xl shadow-custom-orange/50 hover:shadow-custom-orange/70 transform hover:scale-110 transition-all duration-300 flex items-center gap-3">
                                    Start Creating Now
                                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                                </Link>
                            </div>

                            <div className="flex flex-wrap justify-center gap-6 text-sm text-custom-cream/60">
                                {['No credit card required', 'Free trial available', 'Cancel anytime'].map((item, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Check className="w-4 h-4 text-custom-orange" />
                                        <span>{item}</span>
                                    </div>
                                ))}
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
                        <span className="text-xl font-bold text-custom-orange">Brick2Brick</span>
                    </div>
                    <p className="text-custom-cream/50 text-sm">
                        © 2026 Brick2Brick. Transform your words into motion.
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
