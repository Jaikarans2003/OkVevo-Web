'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Send, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import { db } from '@/config/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export type ContactCategory = 'enterpriseEnquiry' | 'problemTicket' | 'generalQuery' | '';

interface ContactUsModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultCategory?: ContactCategory;
}

const CATEGORY_OPTIONS: { value: ContactCategory | ''; label: string }[] = [
    { value: '', label: 'Select a category...' },
    { value: 'enterpriseEnquiry', label: 'Enterprise Enquiry' },
    { value: 'problemTicket', label: 'Problem Ticket' },
    { value: 'generalQuery', label: 'General Query' },
];

export default function ContactUsModal({ isOpen, onClose, defaultCategory = 'generalQuery' }: ContactUsModalProps) {
    const [name, setName] = useState('');
    const [designation, setDesignation] = useState('');
    const [email, setEmail] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [category, setCategory] = useState<ContactCategory | ''>(defaultCategory);
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCategory(defaultCategory);
            setName('');
            setDesignation('');
            setEmail('');
            setWhatsapp('');
            setMessage('');
            setError('');
            setSubmitted(false);
        }
    }, [isOpen, defaultCategory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim()) {
            setError('Email is required.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }
        if (!category) {
            setError('Please select a category.');
            return;
        }
        if (!message.trim()) {
            setError('Please describe your query or requirements.');
            return;
        }

        setSubmitting(true);
        try {
            const submissionData: Record<string, any> = {
                name: name.trim(),
                designation: designation.trim(),
                email: email.trim(),
                message: message.trim(),
                submittedAt: Timestamp.now(),
            };
            if (whatsapp.trim()) {
                submissionData.whatsapp = whatsapp.trim();
            }

            await addDoc(
                collection(db, 'contactSubmissions', category, 'submissions'),
                submissionData
            );

            setSubmitted(true);
        } catch (err) {
            console.error('Error submitting contact form:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center px-4"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="relative w-full max-w-lg bg-[#0D0D0D] border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(255,102,0,0.1)]"
                    >
                        {/* Orange top accent */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

                        <AnimatePresence mode="wait">
                            {!submitted ? (
                                <motion.div
                                    key="form"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="p-8"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-8">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 mb-2">Get in Touch</p>
                                            <h2 className="text-2xl font-black text-white tracking-tight">Contact Us</h2>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {/* Name */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Name</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                placeholder="Your full name"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                                            />
                                        </div>

                                        {/* Designation */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Designation</label>
                                            <input
                                                type="text"
                                                value={designation}
                                                onChange={e => setDesignation(e.target.value)}
                                                placeholder="Your role or title"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                                            />
                                        </div>

                                        {/* Email + WhatsApp row */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">
                                                    Email <span className="text-orange-500">*</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    placeholder="you@example.com"
                                                    required
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">
                                                    WhatsApp <span className="text-white/20">(optional)</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={whatsapp}
                                                    onChange={e => setWhatsapp(e.target.value)}
                                                    placeholder="+91 XXXXX XXXXX"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors"
                                                />
                                            </div>
                                        </div>

                                        {/* Category Dropdown */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Category</label>
                                            <div className="relative">
                                                <select
                                                    value={category}
                                                    onChange={e => setCategory(e.target.value as ContactCategory)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors appearance-none cursor-pointer"
                                                >
                                                    {CATEGORY_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value} disabled={opt.value === ''} className={opt.value === '' ? 'bg-[#1A1A1A] text-white/30' : 'bg-[#1A1A1A] text-white'}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                                            </div>
                                        </div>

                                        {/* Message */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">
                                                Message <span className="text-orange-500">*</span>
                                            </label>
                                            <textarea
                                                value={message}
                                                onChange={e => setMessage(e.target.value)}
                                                placeholder="Describe your query or requirements..."
                                                rows={4}
                                                required
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                                            />
                                        </div>

                                        {/* Error */}
                                        {error && (
                                            <p className="text-red-400 text-xs font-medium">{error}</p>
                                        )}

                                        {/* Submit */}
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-[0.3em] text-xs transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,102,0,0.3)]"
                                        >
                                            {submitting ? (
                                                <span className="animate-pulse">Submitting...</span>
                                            ) : (
                                                <>
                                                    Submit
                                                    <Send size={14} />
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="p-12 flex flex-col items-center text-center"
                                >
                                    {/* OkVevo Logo */}
                                    <div className="w-20 h-20 mb-8 relative">
                                        <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl" />
                                        <div className="relative w-20 h-20 bg-orange-500/10 border border-orange-500/30 rounded-full flex items-center justify-center">
                                            <Image
                                                src="/OKVEVO WithOut BackGrounds/Orange.svg"
                                                alt="OkVevo"
                                                width={48}
                                                height={48}
                                                className="w-12 h-12 object-contain"
                                            />
                                        </div>
                                    </div>

                                    <CheckCircle className="text-orange-500 mb-4" size={32} />

                                    <h3 className="text-2xl font-black text-white tracking-tight mb-3">
                                        We've Got Your Message!
                                    </h3>
                                    <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-8">
                                        Our appropriate team will reach out to you within <span className="text-orange-500 font-bold">24 hours</span>.
                                    </p>

                                    <button
                                        onClick={onClose}
                                        className="px-10 py-3 rounded-full border border-white/10 text-xs font-black uppercase tracking-[0.3em] text-white/60 hover:bg-white/5 hover:text-white transition-all"
                                    >
                                        Close
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
