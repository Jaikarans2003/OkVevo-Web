"use client";

import { motion } from 'framer-motion';
import { ArrowRight, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function IntroAIImagesPage() {
    const router = useRouter();

    const handleBack = () => router.back();
    const handleNext = () => router.push('/studio'); // Redirect to Studio after last intro

    return (
        <div className="min-h-screen bg-black text-white flex overflow-hidden">

            {/* Left Section - Content */}
            <div className="w-full lg:w-1/2 p-8 lg:p-16 flex flex-col justify-center relative z-10">
                <div className="max-w-xl mx-auto lg:mx-0">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-sm font-medium mb-6">
                            <ImageIcon className="w-4 h-4 text-accent-orange" />
                            <span>AI Images</span>
                        </div>
                        <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                            Studio Grade <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-orange to-red-400">
                                AI Images
                            </span>
                        </h1>
                        <p className="text-gray-400 text-lg leading-relaxed mb-12">
                            Create stunning images using top models like GPT Image, Seedream & more in one place.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="flex items-center gap-4"
                    >
                        <button
                            onClick={handleBack}
                            className="px-8 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition-colors font-medium"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleNext}
                            className="px-8 py-3 rounded-lg bg-accent-orange hover:bg-orange-500 transition-colors font-medium flex items-center gap-2"
                        >
                            Enter Studio <ArrowRight className="w-4 h-4" />
                        </button>
                    </motion.div>
                </div>
            </div>

            {/* Right Section - Visual/Demo Area */}
            <div className="hidden lg:flex w-1/2 bg-[#0A0500] items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-l from-orange-900/10 to-transparent" />

                {/* Mock Interface Container */}
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-[80%] aspect-square max-h-[600px] bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden grid place-items-center"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-red-500/5" />

                    <div className="text-center relative z-10">
                        <div className="inline-block p-4 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 mb-4">
                            <Sparkles className="w-12 h-12 text-accent-orange" />
                        </div>
                        <p className="text-accent-orange/50 font-mono">Generating high-res assets...</p>
                    </div>
                </motion.div>

                {/* Feature Tags */}
                <div className="absolute bottom-12 w-full px-12">
                    <div className="grid grid-cols-2 gap-4">
                        {['All Models, One Place', 'Image Editing', 'Create Infographics', 'Unlimited Usage*'].map((tag, i) => (
                            <motion.div
                                key={tag}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 + (i * 0.1) }}
                                className="bg-orange-900/20 border border-accent-orange/20 rounded-lg p-3 text-center text-sm text-orange-200 font-medium"
                            >
                                {tag}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
