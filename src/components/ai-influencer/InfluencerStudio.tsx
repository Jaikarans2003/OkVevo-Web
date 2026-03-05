'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore
import ExplainerWorkflow from '@/components/ai-influencer/ExplainerWorkflow';
import { MessageSquare, Zap, Play, Layers } from 'lucide-react';

type Tab = 'Explainers' | 'Motion Control';

export default function InfluencerStudio() {
    const [activeTab, setActiveTab] = useState<Tab>('Explainers');

    const tabs: { id: Tab; icon: any; label: string }[] = [
        { id: 'Explainers', icon: MessageSquare, label: 'Explainers' },
        { id: 'Motion Control', icon: Zap, label: 'Motion Control' },
    ];

    return (
        <div className="flex flex-col gap-8">
            {/* Tab Navigation */}
            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl w-fit border border-white/10">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === tab.id
                            ? 'text-white'
                            : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white/10 rounded-xl"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <tab.icon className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px]">
                <AnimatePresence mode="wait">
                    {activeTab === 'Explainers' ? (
                        <motion.div
                            key="explainers"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                        >
                            <ExplainerWorkflow />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="motion-control"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="bg-white/5 rounded-[40px] border border-white/10 p-12 flex flex-col items-center justify-center text-center gap-6"
                        >
                            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center">
                                <Zap className="w-8 h-8 text-white/40" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold mb-2">Motion Control Coming Soon</h3>
                                <p className="text-white/40 max-w-md">
                                    Fine-tuned control over avatar movement, gestures, and environment interaction.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
