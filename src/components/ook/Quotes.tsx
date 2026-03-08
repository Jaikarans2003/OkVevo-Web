'use client';

import { motion } from 'framer-motion';

interface QuotesProps {
    onJoinClick: () => void;
}

const Quotes = ({ onJoinClick }: QuotesProps) => {
    return (
        <section id="create" data-section-theme="light" className="section-padding relative overflow-hidden bg-bg-main">
            {/* Premium Orange Gradient Background */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        background: 'radial-gradient(circle at 50% 50%, var(--color-accent-orange) 0%, transparent 70%)',
                    }}
                />
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        x: [0, 30, 0],
                        y: [0, 20, 0],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-accent-orange/20 blur-[40px] rounded-full transform-gpu will-change-transform"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        x: [0, -40, 0],
                        y: [0, -30, 0],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear", delay: 2 }}
                    className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] bg-accent-orange/15 blur-[30px] rounded-full transform-gpu will-change-transform"
                />
            </div>

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
