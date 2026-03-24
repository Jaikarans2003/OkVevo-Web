import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

interface WorkspaceBentoProps {
    user?: any;
}

const WorkspaceBento = ({ user: initialUser }: WorkspaceBentoProps) => {
    const [user, setUser] = useState<any>(initialUser);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            }
        });
        return () => unsubscribe();
    }, []);

    const ComingSoonOverlay = () => (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-[3px] flex items-center justify-center transition-all duration-300">
            <div className="bg-[#1A1A1A] border border-white/10 px-6 py-3 rounded-full flex items-center gap-2 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                <Sparkles className="w-5 h-5 text-[#B1A9FE]" />
                <span className="text-white font-black tracking-widest text-[11px] uppercase">Coming Soon...</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen pt-40 pb-24 px-6 md:px-12 bg-black selection:bg-accent-orange/30 relative overflow-hidden">
            {/* Professional Grid Background with Radial Mask */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div 
                    className="absolute inset-0 opacity-[0.40]" 
                    style={{ 
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cpath d='M 100 0 L 0 0 0 100' fill='none' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E")`,
                        backgroundSize: '50px 50px'
                    }} 
                />
                {/* Subtle Radial Mask for depth */}
                <div className="absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_0%,black_100%)] opacity-60" />
            </div>
            
            <div className="max-w-[1200px] mx-auto relative z-10 w-full">
               

                {/* Bento Grid layout matching the referenced design exact proportions */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full lg:h-[700px] font-sans">
                    
                    {/* Left Column: AI Influencer */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="lg:col-span-5 h-[500px] lg:h-full rounded-[40px] bg-[#fb4a2e] flex flex-col items-center overflow-hidden relative group"
                    >
                        <div className="p-8 md:p-12 pb-2 flex flex-col items-center text-center relative z-20 w-full">
                            <div className="bg-white/10 text-white/90 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest mb-4 border border-white/20 backdrop-blur-md">
                                Digital Twin Studio
                            </div>

                            <h2 className="text-white text-[42px] leading-tight mb-3 tracking-tight" style={{ fontWeight: 600 }}>AI Influencer</h2>
                            
                            <p className="text-white/80 text-[14px] md:text-[15px] leading-relaxed max-w-[300px] mb-6 font-medium">
                                Train your personal digital twin. Automate your content with infinite scale, seamless lip-sync, and hyper-realistic motion.
                            </p>

                            <Link href="/workspace/ai-influencer">
                                <button className="bg-[#0a0a0a] text-white px-8 py-3 rounded-full text-[15px] font-medium hover:scale-105 transition-transform shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex items-center gap-2">
                                    Launch Studio
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                </button>
                            </Link>
                        </div>
                        
                        {/* Image area with better focal point */}
                        <div className="w-full flex-1 relative flex items-end justify-center overflow-hidden">
                            <div className="absolute inset-x-0 top-[-1px] h-32 bg-gradient-to-b from-[#fb4a2e] to-transparent z-10 pointer-events-none"></div>
                            
                            <img 
                                src="/ai-bgg.png" 
                                alt="AI Influencer Studio" 
                                className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                            />
                        </div>
                    </motion.div>

                    {/* Right Column Grid */}
                    <div className="lg:col-span-7 flex flex-col gap-6 h-full">
                        
                        {/* Top Card: Product Studio */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-[#1C1C1E] rounded-[40px] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between h-[300px] lg:h-1/2 relative overflow-hidden"
                        >
                            <ComingSoonOverlay />
                            
                            <div className="max-w-[280px] z-10 flex flex-col h-full justify-center">
                                <h3 className="text-white text-[32px] mb-3 font-semibold tracking-tight">Product Studio</h3>
                                <p className="text-[#a1a1aa] text-[15px] leading-relaxed mb-6">
                                    Generate cinematic product shots and dynamic videos directly on your browser.
                                </p>
                            </div>
                            
                            {/* Waveform-like Graphic representing Voice/Studio rendering */}
                            <div className="relative mt-8 md:mt-0 flex items-center justify-center flex-1 h-32 md:h-full w-full">
                                <div className="flex items-center gap-2 md:gap-3 h-20 w-full justify-end max-w-[250px]">
                                    {[20, 35, 60, 40, 85, 50, 100, 45, 75, 25].map((h, i) => (
                                        <div 
                                            key={i} 
                                            className="w-4 rounded-full bg-gradient-to-t from-[#4F8BEA] via-[#8F64F9] to-[#D55AF2] opacity-80"
                                            style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                                        ></div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* Bottom Row: Social Trends / Director Mode */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 h-[500px] lg:h-1/2">
                            
                            {/* Social Trends (Purple Card) */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-[#6D4AFF] rounded-[40px] p-8 md:p-10 flex flex-col relative overflow-hidden"
                            >
                                <ComingSoonOverlay />
                                
                                <div className="z-10 h-full flex flex-col">
                                    <h3 className="text-white text-[28px] font-semibold mb-3">Social Trends</h3>
                                    <p className="text-white/80 text-[15px] leading-relaxed mb-6 max-w-[200px]">
                                        Tap into the latest viral hooks and create algorithm-friendly content instantly.
                                    </p>
                                </div>
                                
                                {/* Floating Translation-style Element Graphic */}
                                <div className="absolute right-[-20px] bottom-10 w-[200px] p-5 bg-[#1C1C1E] rounded-[24px] shadow-2xl transition-all duration-500 border border-white/10">
                                    <div className="text-white text-[15px] mb-4">Trending Now</div>
                                    <div className="flex flex-col gap-3">
                                         <div className="flex items-center justify-between">
                                             <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center text-[8px]">TikTok</span>
                                                <span className="text-white/80 text-[13px]">VFX Hook</span>
                                             </div>
                                         </div>
                                         <div className="flex items-center justify-between">
                                             <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-[8px]">IG</span>
                                                <span className="text-white/80 text-[13px]">B-Roll trend</span>
                                             </div>
                                         </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Director Mode */}
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="bg-[#1C1C1E] rounded-[40px] p-8 md:p-10 flex flex-col relative overflow-hidden border border-white/5"
                            >
                                <ComingSoonOverlay />

                                <div className="z-10 h-full flex flex-col">
                                    <h3 className="text-white text-[28px] font-semibold mb-3">Director Mode</h3>
                                    <p className="text-[#a1a1aa] text-[15px] leading-relaxed mb-6">
                                        End-to-end cinematic AI pipeline. Generate consistent trailers instantly.
                                    </p>
                                </div>
                                <div className="absolute right-[-40px] top-[-40px] w-48 h-48 bg-[#FEE440]/10 rounded-full blur-[40px] pointer-events-none"></div>
                            </motion.div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceBento;
