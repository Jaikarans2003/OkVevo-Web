"use client";

import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const profileOptions = [
    { id: 1, label: 'Founder / Business owner' },
    { id: 2, label: 'Hobbyist / Student' },
    { id: 3, label: 'Small Business' },
    { id: 4, label: 'Mid / Enterprise Business' },
    { id: 5, label: 'Content Creator' },
    { id: 6, label: 'Consultant' },
    { id: 7, label: 'Other' },
];

export default function OnboardingProfilePage() {
    const router = useRouter();
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const handleContinue = () => {
        if (selectedId) {
            router.push('/onboarding/intro/video-agent');
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden p-6">

            {/* Background Beams */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-orange-900/0 via-orange-900/50 to-orange-900/0 skew-x-12" />
                <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-orange-900/0 via-orange-900/50 to-orange-900/0 -skew-x-12" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-950/20 rounded-full blur-[120px] mix-blend-screen" />
            </div>

            <main className="relative z-10 w-full max-w-2xl">

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 mb-6 opacity-70">
                        <div className="w-8 h-8 rounded-lg bg-custom-orange flex items-center justify-center font-bold">O</div>
                        <span className="font-medium">OKVEVO</span>
                    </div>
                    <h1 className="text-4xl font-bold mb-4">What describes you best?</h1>
                    <p className="text-gray-400">Select the option that fits your profile</p>
                </motion.div>

                <div className="grid md:grid-cols-2 gap-4 mb-12">
                    {profileOptions.map((option, index) => (
                        <motion.button
                            key={option.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            onClick={() => setSelectedId(option.id)}
                            className={`group relative p-4 rounded-xl text-left transition-all duration-300 border ${selectedId === option.id
                                ? 'bg-custom-orange/20 border-custom-orange shadow-[0_0_20px_rgba(255,109,31,0.3)]'
                                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className={`font-medium ${selectedId === option.id ? 'text-orange-100' : 'text-gray-300'}`}>
                                    {option.label}
                                </span>
                                {selectedId === option.id && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="bg-custom-orange rounded-full p-1"
                                    >
                                        <Check className="w-3 h-3 text-white" />
                                    </motion.div>
                                )}
                            </div>
                        </motion.button>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-center"
                >
                    <button
                        onClick={handleContinue}
                        disabled={!selectedId}
                        className={`
                            px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300
                            ${selectedId
                                ? 'bg-custom-orange hover:bg-orange-500 text-white shadow-lg shadow-orange-900/50'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                        `}
                    >
                        Continue <ArrowRight className="w-4 h-4" />
                    </button>
                </motion.div>

            </main>
        </div>
    );
}
