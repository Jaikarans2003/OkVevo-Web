import { motion } from 'framer-motion';
import Link from 'next/link';

const WorkspaceBento = () => {
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
                <div className="absolute inset-0 bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_0%,black_100%)] opacity-60" />
            </div>
            
            <div className="max-w-[1200px] mx-auto relative z-10 w-full">
                <div className="w-full max-w-2xl mx-auto h-[500px] lg:h-[700px] font-sans">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="h-[500px] lg:h-full rounded-[40px] bg-[#fb4a2e] flex flex-col items-center overflow-hidden relative group"
                    >
                        <div className="p-8 md:p-12 pb-2 flex flex-col items-center text-center relative z-20 w-full">
                            <div className="bg-white/10 text-white/90 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest mb-4 border border-white/20 backdrop-blur-md">
                                Creative Agent Studio
                            </div>

                            <h2 className="text-white text-[42px] leading-tight mb-3 tracking-tight" style={{ fontWeight: 600 }}>AI Studio</h2>
                            
                            <p className="text-white/80 text-[14px] md:text-[15px] leading-relaxed max-w-[300px] mb-6 font-medium">
                                Chat with your creative agent. Cut clips, add captions, compose with HyperFrames, and ship content faster.
                            </p>

                            <Link href="/workspace/ai-studio">
                                <button className="bg-[#0a0a0a] text-white px-8 py-3 rounded-full text-[15px] font-medium hover:scale-105 transition-transform shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex items-center gap-2">
                                    Launch Studio
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                </button>
                            </Link>
                        </div>
                        
                        <div className="w-full flex-1 relative flex items-end justify-center overflow-hidden px-8 pb-8">
                            <div className="absolute inset-x-0 top-[-1px] h-32 bg-gradient-to-b from-[#fb4a2e] to-transparent z-10 pointer-events-none"></div>

                            <div className="w-full max-w-[320px] rounded-[24px] bg-[#1C1C1E]/90 border border-white/10 p-5 shadow-2xl backdrop-blur-sm transition-transform duration-700 group-hover:scale-105">
                                <div className="flex flex-col gap-3">
                                    <div className="self-end max-w-[85%] rounded-2xl rounded-tr-sm bg-white/10 px-4 py-2.5 text-[13px] text-white/90 text-left">
                                        Cut my podcast into 5 vertical clips with captions.
                                    </div>
                                    <div className="self-start max-w-[85%] rounded-2xl rounded-tl-sm bg-[#fb4a2e]/80 px-4 py-2.5 text-[13px] text-white text-left">
                                        On it — I&apos;ll find the best moments and add karaoke-style captions.
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        {['🎬 Clips', '📋 Captions', '🖼 HyperFrames'].map((pill) => (
                                            <span key={pill} className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium text-white/80 border border-white/10">
                                                {pill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                </div>
            </div>
        </div>
    );
};

export default WorkspaceBento;
