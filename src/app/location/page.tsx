'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';

const mapSectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const photoVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function LocationPage() {
    return (
        <main className="min-h-screen bg-black text-white selection:bg-orange-500/30 font-sans overflow-x-hidden">
            {/* Background elements */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/10 blur-[150px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-red-600/10 blur-[150px]" />
            </div>

            {/* Navigation Bar */}
            <nav className="fixed top-0 w-full z-50 px-6 md:px-12 py-6 flex items-center justify-between pointer-events-none">
                <Link href="/" className="pointer-events-auto flex items-center gap-2 text-white/70 hover:text-white transition-colors uppercase tracking-widest text-xs font-bold">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>
                <div className="text-white/30 text-[10px] font-black uppercase tracking-[0.5em]">
                    Aesthetic Protocol // Location
                </div>
            </nav>

            <div className="relative z-10 pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto flex flex-col gap-24">
                
                {/* Header Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center text-center gap-4"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-orange-500 text-[10px] font-bold tracking-widest uppercase">
                        <MapPin className="w-3 h-3" />
                        Global Access
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">
                        Find The <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Booth</span>
                    </h1>
                    <p className="text-white/50 max-w-lg mx-auto text-sm md:text-base mt-2">
                        Experience the OKVEVO x MASIV AI transformation booth. Currently deployed at MASIV Health Club, Bangalore. More locations unlocking soon.
                    </p>
                </motion.div>

                {/* Map Section */}
                <motion.section 
                    variants={mapSectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    className="flex flex-col gap-8"
                >
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h2 className="text-2xl font-bold tracking-tight uppercase">Active Deployment</h2>
                        <span className="text-orange-500 text-xs font-mono uppercase">Bangalore, IN</span>
                    </div>

                    <div className="relative w-full h-[50vh] md:h-[60vh] rounded-2xl overflow-hidden border border-white/10 bg-white/5 group">
                        {/* Interactive map overlay elements */}
                        <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-3 rounded-lg flex flex-col gap-1">
                            <h3 className="font-bold text-sm tracking-wide">MASIV Health Club</h3>
                            <p className="text-white/60 text-xs">HSR Layout, Bengaluru</p>
                            <a 
                                href="https://maps.google.com/?q=MASIV+Health+Club+HSR+Layout+Bangalore" 
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 text-[10px] font-bold uppercase text-orange-500 hover:text-orange-400 flex items-center gap-1"
                            >
                                Get Directions →
                            </a>
                        </div>

                        {/* Map iframe wrapped with some filters for dark mode aesthetic */}
                        <div className="w-full h-full filter invert-[90%] hue-rotate-[180deg] contrast-[1.1] grayscale-[0.2] transition-all duration-700 group-hover:filter-none">
                            <iframe 
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15555.434676575084!2d77.62562473859714!3d12.9167905898822!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae148d4936afa7%3A0xcda770ceea6cecc9!2sHSR%20Layout%2C%20Bengaluru%2C%20Karnataka!5e0!3m2!1sen!2sin!4v1711736783921!5m2!1sen!2sin" 
                                width="100%" 
                                height="100%" 
                                style={{ border: 0 }} 
                                allowFullScreen 
                                loading="lazy" 
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>

                        {/* Scanline effect */}
                        <div className="absolute inset-0 z-10 pointer-events-none bg-[url('/noise.png')] opacity-[0.03]" />
                    </div>
                </motion.section>

                {/* Photos Section */}
                <motion.section 
                    variants={mapSectionVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    className="flex flex-col gap-8"
                >
                    <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-4 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight uppercase">The Hardware</h2>
                            <p className="text-white/50 text-sm mt-1">Inside the AI transformation chamber.</p>
                        </div>
                        <span className="text-white/30 text-[10px] font-mono uppercase tracking-widest hidden md:block">Visual Data // 03</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Large Featured Photo */}
                        <motion.div 
                            variants={photoVariants}
                            className="md:col-span-8 relative h-[400px] md:h-[600px] rounded-2xl overflow-hidden border border-white/10 group"
                        >
                            <img 
                                src="/bgimage.png" 
                                alt="Main Booth View" 
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                            <div className="absolute bottom-6 left-6 text-white">
                                <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Exterior</p>
                                <h3 className="text-lg font-medium">The Portal Endpoint</h3>
                            </div>
                        </motion.div>

                        <div className="md:col-span-4 flex flex-col gap-4">
                            {/* Photo 2 */}
                            <motion.div 
                                variants={photoVariants}
                                className="relative h-[200px] md:h-[292px] rounded-2xl overflow-hidden border border-white/10 group"
                            >
                                <img 
                                    src="/masiv_ai_booth.png" 
                                    alt="Booth Details" 
                                    onError={(e) => { e.currentTarget.src = "/gym.png" }}
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500" />
                                <div className="absolute bottom-4 left-4 text-white">
                                    <h3 className="text-sm font-medium">Interface System</h3>
                                </div>
                            </motion.div>

                            {/* Photo 3 */}
                            <motion.div 
                                variants={photoVariants}
                                className="relative h-[200px] md:h-[292px] rounded-2xl overflow-hidden border border-white/10 group"
                            >
                                <img 
                                    src="/booth.png" 
                                    alt="Transformation Chamber" 
                                    onError={(e) => { e.currentTarget.src = "/weight.png" }}
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500" />
                                <div className="absolute bottom-4 left-4 text-white">
                                    <h3 className="text-sm font-medium">Chamber Interior</h3>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.section>

            </div>
        </main>
    );
}
