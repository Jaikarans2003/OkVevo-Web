'use client';

import { motion } from 'framer-motion';
import { Video, User, FileText, Layout, Sparkles, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

const offerings = [
    {
        icon: <Video className="w-8 h-8" />,
        title: "Create Video",
        description: "Transform ideas into high-quality cinematic scenes.",
        color: "bg-accent-orange",
        delay: 0.1
    },
    {
        icon: <User className="w-8 h-8" />,
        title: "Magic Avatars",
        description: "Generate realistic AI avatars for your content.",
        color: "bg-blue-600",
        delay: 0.2
    },
    {
        icon: <FileText className="w-8 h-8" />,
        title: "Script to Video",
        description: "Turn your scripts into full video productions.",
        color: "bg-purple-600",
        delay: 0.3
    },
    {
        icon: <Layout className="w-8 h-8" />,
        title: "Ads Creation",
        description: "Build high-converting video ads in minutes.",
        color: "bg-emerald-600",
        delay: 0.4
    },
    {
        icon: <Sparkles className="w-8 h-8" />,
        title: "Social Trends",
        description: "Stay ahead with trending Instagram/TikTok templates.",
        color: "bg-pink-600",
        delay: 0.5
    },
    {
        icon: <MessageSquare className="w-8 h-8" />,
        title: "AI Assistant",
        description: "Brainstorm and plan your next big project.",
        color: "bg-amber-600",
        delay: 0.6
    }
];

const DashMind = () => {
    const router = useRouter();

    return (
        <section className="py-32 relative overflow-hidden">
            <div className="container px-6 mx-auto">
                <div className="max-w-3xl mb-20">
                    <motion.span
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="text-xs font-black tracking-[0.5em] text-accent-orange uppercase mb-6 block"
                    >
                        Project Launcher
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none"
                    >
                        What is in your <br />
                        <span className="text-accent-orange italic font-normal">mind?</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-gray-400 text-xl font-medium mt-8 max-w-xl"
                    >
                        Choose a starting point and let Vevo handle the complexity of production.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {offerings.map((item, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: item.delay, duration: 0.6 }}
                            whileHover={{ y: -12, transition: { duration: 0.2 } }}
                            onClick={() => { }}
                            className="group relative p-10 rounded-[40px] bg-white/[0.02] border border-white/5 hover:border-accent-orange/30 hover:bg-white/[0.04] transition-all cursor-pointer shadow-2xl"
                        >
                            <div className={`w-16 h-16 rounded-2xl ${item.color} text-white flex items-center justify-center mb-10 shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                                {item.icon}
                            </div>
                            <h3 className="text-3xl font-black text-white mb-4 tracking-tight">
                                {item.title}
                            </h3>
                            <p className="text-gray-500 text-lg font-medium leading-relaxed group-hover:text-gray-300 transition-colors">
                                {item.description}
                            </p>

                            <div className="w-12 h-12 rounded-full border border-accent-orange/30 flex items-center justify-center text-accent-orange">
                                <Sparkles size={20} />
                            </div>

                        </motion.div>
                    ))}
                </div>
            </div>
        </section >
    );
};

export default DashMind;
