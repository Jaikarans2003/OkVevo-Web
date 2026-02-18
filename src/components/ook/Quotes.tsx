'use client';

import { motion } from 'framer-motion';

interface QuotesProps {
    onJoinClick: () => void;
}

const Quotes = ({ onJoinClick }: QuotesProps) => {
    return (
        <section id="create" data-section-theme="light" className="section-padding relative overflow-hidden bg-bg-main">
            {/* Rich Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-accent-orange/15 blur-[120px] rounded-full pointer-events-none" style={{ willChange: 'transform' }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-accent-sky/10 blur-[100px] rounded-full pointer-events-none" style={{ willChange: 'transform' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[40vw] bg-accent-orange/5 blur-[150px] rounded-full pointer-events-none mix-blend-soft-light" style={{ willChange: 'transform' }} />

            <div className="centering-container text-center relative z-10">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={{
                        hidden: { opacity: 0, y: 50 },
                        visible: {
                            opacity: 1,
                            y: 0,
                            transition: {
                                duration: 1.0,
                                ease: [0.16, 1, 0.3, 1],
                                staggerChildren: 0.2
                            }
                        }
                    }}
                    className="max-w-5xl mx-auto"
                >
                    <h2 className="text-5xl md:text-8xl font-bold leading-[1.1] tracking-tight">
                        "Everyone has a story. <br />
                        We just give it <span className="text-cursive text-accent-orange md:text-[1.2em] leading-none lowercase tracking-normal font-normal inline-block translate-y-2">a face, a voice, and a world."</span>
                    </h2>

                    <motion.button
                        variants={{
                            hidden: { opacity: 0, scale: 0.9 },
                            visible: {
                                opacity: 1,
                                scale: 1,
                                transition: { duration: 0.6, ease: "easeOut" }
                            }
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onJoinClick}
                        className="mt-20 px-12 py-5 rounded-full bg-accent-orange text-white font-black text-xs tracking-widest uppercase hover:bg-text-main hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
                    >
                        Apply for Access
                    </motion.button>

                    <motion.div
                        variants={{
                            hidden: { width: 0, opacity: 0 },
                            visible: {
                                width: "120px",
                                opacity: 1,
                                transition: { duration: 1.0, ease: "easeInOut" }
                            }
                        }}
                        className="h-[3px] bg-accent-orange mx-auto mt-24 rounded-full"
                    />
                </motion.div>
            </div>
        </section>
    );
};

export default Quotes;
