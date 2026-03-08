'use client';

import { motion } from 'framer-motion';
import { 
    Activity, 
    Zap, 
    Users, 
    ArrowUpRight, 
    MessageSquare, 
    TrendingUp, 
    Share2, 
    Youtube,
    Video,
    Layers,
    Instagram,
    Send
} from 'lucide-react';

const FeaturesGrid = () => {
    return (
        <section className="relative py-24 bg-black overflow-hidden rounded-b-[80px] md:rounded-b-[120px]">
            {/* Background elements to match theme */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent-orange/5 blur-[120px] rounded-full" />
                <div className="absolute inset-0 opacity-[0.02]" 
                     style={{ 
                        backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
                        backgroundSize: '80px 80px'
                     }} 
                />
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* --- LEFT COLUMN --- */}
                    <div className="flex flex-col gap-6">
                        {/* Track Progress Card */}
                        <div className="glass-card group relative p-8 rounded-[2.5rem] overflow-hidden flex flex-col min-h-[400px]">
                            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 transition-opacity">
                                <Activity className="w-12 h-12 text-accent-orange" />
                            </div>
                            <div className="mt-auto">
                                <h3 className="text-2xl font-bold text-white mb-2">Track Progress</h3>
                                <p className="text-white/50 text-sm leading-relaxed mb-6">
                                    Fast and accurate tracking of your video performance anytime.
                                </p>
                                {/* Waveform Animation */}
                                <div className="flex items-end gap-1.5 h-16">
                                    {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7, 0.5, 0.3].map((h, i) => (
                                        <motion.div 
                                            key={i}
                                            className="w-full bg-accent-orange rounded-full"
                                            initial={{ height: "20%" }}
                                            animate={{ height: `${h * 100}%` }}
                                            transition={{ 
                                                duration: 0.8, 
                                                repeat: Infinity, 
                                                repeatType: "reverse", 
                                                delay: i * 0.1 
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Social Media Export Engine */}
                        <div className="glass-card group p-8 rounded-[2.5rem] flex flex-col gap-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">Social Media Export</h3>
                                <p className="text-white/50 text-sm">One-click optimization for Reels, TikTok, and YouTube Shorts.</p>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {[Instagram, Youtube, Send, Video].map((Icon, i) => (
                                    <div key={i} className="aspect-square rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-accent-orange/30 transition-colors">
                                        <Icon className="w-5 h-5 text-white/40 group-hover:text-accent-orange transition-colors" />
                                    </div>
                                ))}
                                <div className="aspect-square rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                    <Share2 className="w-5 h-5 text-white/20" />
                                </div>
                                <div className="aspect-square rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                    <Layers className="w-5 h-5 text-white/20" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- MIDDLE COLUMN --- */}
                    <div className="flex flex-col gap-6">
                        {/* AI Avatar Studio */}
                        <div className="glass-card group p-8 rounded-[2.5rem] flex flex-col items-center text-center">
                            <div className="flex -space-x-3 mb-6">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="w-12 h-12 rounded-full border-2 border-black bg-accent-orange/20 flex items-center justify-center text-accent-orange font-bold text-xs ring-2 ring-accent-orange/50 overflow-hidden">
                                        <img src={`https://i.pravatar.cc/150?u=${i+10}`} alt="avatar" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                                <div className="w-12 h-12 rounded-full border-2 border-black bg-accent-orange flex items-center justify-center text-white scale-110 z-10 shadow-lg">
                                    <Video className="w-5 h-5" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">AI Avatar Studio</h3>
                            <p className="text-white/50 text-sm">Bring your digital characters to life with realistic motion sync.</p>
                        </div>

                        {/* Fast Iterations */}
                        <div className="glass-card group relative p-8 rounded-[2.5rem] flex flex-col items-center text-center overflow-hidden min-h-[220px] justify-center">
                            <div className="absolute inset-0 bg-accent-orange/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Zap className="w-10 h-10 text-accent-orange mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="text-2xl font-bold text-white mb-2">Fast Iterations</h3>
                            <p className="text-white/50 text-sm">Render previews in seconds, not hours.</p>
                        </div>

                        {/* Custom Support */}
                        <div className="glass-card group p-8 rounded-[2.5rem] flex flex-col gap-4">
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <div className="w-10 h-10 rounded-full bg-accent-orange/20 flex items-center justify-center flex-shrink-0">
                                    <img src="https://i.pravatar.cc/150?u=support" alt="support" className="w-full h-full rounded-full object-cover" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-white">Ishan Zaad</p>
                                    <p className="text-[10px] text-white/60">Hey there! How can I assist you today?</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-1">Custom Support</h3>
                                <p className="text-white/50 text-sm">24/7 priority access for Pro creators.</p>
                            </div>
                        </div>
                    </div>

                    {/* --- RIGHT COLUMN --- */}
                    <div className="flex flex-col gap-6">
                        {/* Intelligent CTA Card */}
                        <div className="bg-accent-orange group p-10 rounded-[2.5rem] flex flex-col h-full min-h-[460px] relative overflow-hidden text-black">
                            <div className="absolute top-8 right-8 w-14 h-14 rounded-full bg-black/10 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                                <ArrowUpRight className="w-8 h-8" />
                            </div>
                            {/* Decorative background circle */}
                            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-black/5 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
                            
                            <div className="mt-auto relative z-10">
                                <div className="mb-6 flex gap-2">
                                    <span className="px-3 py-1 bg-black/10 rounded-full text-[10px] font-bold uppercase tracking-widest border border-black/10">Priority Access</span>
                                </div>
                                <h3 className="text-4xl font-black mb-4 leading-tight">
                                    Ready to scale <br /> your vision?
                                </h3>
                                <p className="text-black/60 font-medium text-lg leading-relaxed mb-8">
                                    Join the elite circle of creators using cinematic AI to redefine the boundaries of storytelling. No compromises.
                                </p>
                                <button className="w-full py-5 bg-black text-white rounded-full font-bold text-lg hover:shadow-2xl transition-all hover:-translate-y-1 active:scale-95">
                                    Enter Workspace
                                </button>
                            </div>
                        </div>

                        {/* Impressions & Growth - Improved */}
                        <div className="glass-card group p-8 rounded-[2.5rem] flex flex-col gap-6 overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-tr from-accent-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between relative z-10">
                                <div>
                                    <h3 className="text-2xl font-bold text-white mb-1">Impact & Growth</h3>
                                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">+128% Retention</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-accent-orange/10 flex items-center justify-center">
                                    <TrendingUp className="w-5 h-5 text-accent-orange" />
                                </div>
                            </div>
                            
                            {/* Sophisticated Data Visualization */}
                            <div className="relative h-24 w-full mt-2">
                                <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                                    {/* Grid Lines */}
                                    <line x1="0" y1="40" x2="100" y2="40" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
                                    <line x1="0" y1="20" x2="100" y2="20" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
                                    
                                    {/* Area Fill */}
                                    <motion.path 
                                        d="M0 40 L0 35 L20 30 L40 32 L60 15 L80 18 L100 5 L100 40 Z" 
                                        fill="url(#gradient-fill)"
                                        initial={{ opacity: 0 }}
                                        whileInView={{ opacity: 1 }}
                                        transition={{ duration: 1 }}
                                    />
                                    
                                    <defs>
                                        <linearGradient id="gradient-fill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#FF6600" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#FF6600" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>

                                    {/* Main Line */}
                                    <motion.path 
                                        d="M0 35 L20 30 L40 32 L60 15 L80 18 L100 5" 
                                        fill="none" 
                                        stroke="#FF6600" 
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0 }}
                                        whileInView={{ pathLength: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 1.5, ease: "easeOut" }}
                                    />
                                    
                                    {/* Floating Stats Label */}
                                    <motion.g
                                        initial={{ opacity: 0, x: 80, y: 15 }}
                                        whileInView={{ opacity: 1, x: 90, y: 5 }}
                                        transition={{ delay: 1 }}
                                    >
                                        <rect x="-10" y="-12" width="20" height="10" rx="4" fill="#FF6600" />
                                        <text x="0" y="-5" textAnchor="middle" fill="white" fontSize="4" fontWeight="bold">94%</text>
                                    </motion.g>

                                    <motion.circle 
                                        cx="100" cy="5" r="3" fill="#FF6600"
                                        initial={{ opacity: 0 }}
                                        whileInView={{ opacity: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 1.3 }}
                                    >
                                        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                                    </motion.circle>
                                </svg>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default FeaturesGrid;
