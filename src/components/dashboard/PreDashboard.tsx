'use client';

import { useEffect, useState } from 'react';
import { auth } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Building2, ArrowRight } from 'lucide-react';
import DashNavbar from '../workspace/WorkspaceNavbar';
import DashFooterModular from '../workspace/WorkspaceFooterModular';

export default function PreDashboard() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="bg-[#FAFAFA] text-black font-sans selection:bg-[#E2FF4D]/30 overflow-x-hidden min-h-screen flex flex-col">
            <DashNavbar />

            <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top,rgba(255,109,31,0.05)_0%,transparent_50%)]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-md w-full text-center space-y-8"
                >
                    <div className="w-20 h-20 bg-accent-orange/10 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                        <Building2 className="w-10 h-10 text-accent-orange" />
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-gray-900 mb-2">
                            Organization <span className="text-accent-orange">Portal</span>
                        </h1>
                        <p className="text-lg text-gray-500 font-medium leading-relaxed">
                            Access your team management and collaboration tools from the centralized organization dashboard.
                        </p>
                    </div>

                    <button
                        onClick={() => router.push('/dashboard/organisation')}
                        className="group w-full h-16 bg-gray-900 text-white rounded-full font-bold flex items-center justify-center gap-3 hover:bg-accent-orange transition-all duration-500 hover:scale-[1.02] shadow-xl hover:shadow-accent-orange/20"
                    >
                        Enter Organization Page
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <div className="pt-8 flex items-center justify-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all">
                        <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Ready</span>
                        <div className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Secure Flow</span>
                    </div>
                </motion.div>
            </main>

            <DashFooterModular />
        </div>
    );
}
