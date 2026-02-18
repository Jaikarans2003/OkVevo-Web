'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Video, User, FileText, Zap, ArrowUpRight, Play } from 'lucide-react';

const offerings = [
    {
        title: "Product Ads",
        subtitle: "Create Ads for your brand",
        icon: <Video size={32} className="text-white" />,
        color: "bg-[#FF4D4D]",
        textColor: "text-white",
        className: "col-span-1 md:col-span-2 md:row-span-2",
        href: "/workspace/product"
    },
    {
        title: "Create Video",
        subtitle: "Cinematic AI",
        icon: <User size={32} className="text-white" />,
        color: "bg-[#4D79FF]",
        textColor: "text-white",
        className: "col-span-1 md:col-span-1 md:row-span-2",
        href: "/workspace/director"
    },
    {
        title: "Content Repurposing",
        subtitle: "Text to Video",
        icon: <FileText size={32} className="text-black" />,
        color: "bg-[#E2FF4D]",
        textColor: "text-black",
        className: "col-span-1 md:col-span-1 md:row-span-2",
        href: "/chat"
    },
    {
        title: "Viral Content",
        subtitle: "Make content that goes viral",
        icon: <Zap size={32} className="text-white" />,
        color: "bg-[#9B4DFF]",
        textColor: "text-white",
        className: "col-span-1 md:col-span-2 md:row-span-2",
        href: "/workspace/social"
    }
];

const DashGridModular = () => {
    return (
        <section data-section-theme="dark" className="relative h-screen flex flex-col pt-32 pb-4 bg-[#050505] text-white overflow-hidden">
            {/* Dot Grid Pattern - Dark Mode */}
            <div
                className="absolute inset-0 opacity-[0.15] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)',
                    backgroundSize: '40px 40px'
                }}
            />

            <div className="container px-6 mx-auto flex-1 flex flex-col relative z-20 min-h-0">
                <div className="flex items-end justify-between mb-4 shrink-0">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.9] relative z-20">
                        What's in your <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D4D] to-[#9B4DFF]">Mind?</span>
                    </h2>
                </div>

                {/* Flexible Grid - Forces containment */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 grid-rows-4 gap-4 min-h-0 relative z-10">
                    {offerings.map((item, index) => (
                        <Link href={item.href} key={index} className={`${item.className} block h-full`}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1, duration: 0.5 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`w-full h-full ${item.color} rounded-[32px] p-6 relative group cursor-pointer shadow-xl flex flex-col justify-between overflow-hidden`}
                            >
                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex justify-between items-start z-10">
                                    <div className={`p-2.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/10 ${item.textColor === 'text-black' ? 'bg-black/10 border-black/10' : ''}`}>
                                        {item.icon}
                                    </div>
                                    <ArrowUpRight size={24} className={`${item.textColor} opacity-50 group-hover:opacity-100 transition-opacity`} />
                                </div>

                                <div className="z-10">
                                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1.5 block opacity-70 ${item.textColor}`}>
                                        {item.subtitle}
                                    </span>
                                    <h3 className={`text-2xl md:text-4xl font-black tracking-tighter leading-none ${item.textColor}`}>
                                        {item.title}
                                    </h3>
                                </div>

                                {/* Decorative 3D Element Placeholder */}
                                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 blur-[40px] rounded-full pointer-events-none" />
                            </motion.div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default DashGridModular;
