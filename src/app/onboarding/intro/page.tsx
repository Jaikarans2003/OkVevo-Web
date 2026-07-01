"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../config/firebase';
import { getUserProfile } from '../../../services/userService';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const QUESTIONS = [
    {
        id: 'userRole',
        question: 'Who are you?',
        options: [
            { value: 'creator', label: 'Creator', icon: '🎨' },
            { value: 'business', label: 'Business Owner', icon: '💼' },
            { value: 'marketer', label: 'Marketer', icon: '📊' },
            { value: 'student', label: 'Student', icon: '🎓' },
            { value: 'agency', label: 'Agency', icon: '🏢' },
            { value: 'other', label: 'Other', icon: '✨' },
        ]
    },
    {
        id: 'referralSource',
        question: 'Where did you hear about this platform?',
        options: [
            { value: 'instagram', label: 'Instagram', icon: '📷' },
            { value: 'youtube', label: 'YouTube', icon: '▶️' },
            { value: 'friend', label: 'Friend', icon: '👥' },
            { value: 'ads', label: 'Ads', icon: '📢' },
            { value: 'google', label: 'Google Search', icon: '🔍' },
            { value: 'other', label: 'Other', icon: '🌐' },
        ]
    },
    {
        id: 'mainGoal',
        question: 'What is your main goal?',
        options: [
            { value: 'grow_followers', label: 'Grow followers', icon: '📈' },
            { value: 'increase_sales', label: 'Increase sales', icon: '💰' },
            { value: 'save_time', label: 'Save time', icon: '⏱️' },
            { value: 'automate_content', label: 'Automate content', icon: '🤖' },
            { value: 'brand_awareness', label: 'Brand awareness', icon: '🎯' },
            { value: 'engagement', label: 'Boost engagement', icon: '💬' },
        ]
    }
];

export default function OnboardingIntroPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                router.push('/login');
            } else {
                // Check if user has already completed intro
                const userProfile = await getUserProfile(currentUser.uid);
                if (userProfile?.introComplete) {
                    router.push('/workspace');
                } else {
                    setUser(currentUser);
                    setLoading(false);
                }
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleSelectOption = (value: string) => {
        const currentQuestion = QUESTIONS[currentStep];
        setAnswers({ ...answers, [currentQuestion.id]: value });

        // Auto-advance to next question after selection
        setTimeout(() => {
            if (currentStep < QUESTIONS.length - 1) {
                setCurrentStep(currentStep + 1);
            }
        }, 300);
    };

    const handleSubmit = async () => {
        if (!user) return;

        setSubmitting(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                introComplete: true,
                onboardingData: {
                    userRole: answers.userRole,
                    referralSource: answers.referralSource,
                    mainGoal: answers.mainGoal,
                    completedAt: serverTimestamp()
                },
                updatedAt: serverTimestamp(),
            });

            // Show success message
            setShowSuccess(true);

            // Redirect to workspace after 2 seconds
            setTimeout(() => {
                router.push('/workspace');
            }, 2000);
        } catch (error) {
            console.error('Error saving intro data:', error);
            alert('Failed to save your preferences. Please try again.');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    if (showSuccess) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {/* Background Orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-orange/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 text-center"
                >
                    <div className="mb-6">
                        <Sparkles className="w-20 h-20 text-accent-orange mx-auto animate-pulse" />
                    </div>
                    <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-accent-orange to-orange-500 bg-clip-text text-transparent">
                        Great!
                    </h1>
                    <p className="text-2xl text-white/80">
                        We're excited to help you create.
                    </p>
                    <div className="mt-8">
                        <Loader2 className="w-8 h-8 text-accent-orange animate-spin mx-auto" />
                    </div>
                </motion.div>
            </div>
        );
    }

    const currentQuestion = QUESTIONS[currentStep];
    const isLastStep = currentStep === QUESTIONS.length - 1;
    const canProceed = answers[currentQuestion.id];

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-orange/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
            </div>

            <div className="relative z-10 w-full max-w-3xl">
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <Link href="/" className="inline-block mb-6">
                        <Image
                            src="/OKVEVO Logos WithOut BackGrounds/White.svg"
                            alt="OKVEVO Logo"
                            width={60}
                            height={60}
                            className="w-16 h-16 hover:scale-110 transition-transform"
                        />
                    </Link>
                </motion.div>

                {/* Progress Bar */}
                <div className="mb-12">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        {QUESTIONS.map((_, index) => (
                            <div
                                key={index}
                                className={`h-2 rounded-full transition-all duration-500 ${
                                    index <= currentStep ? 'bg-accent-orange w-16' : 'bg-white/10 w-8'
                                }`}
                            />
                        ))}
                    </div>
                    <p className="text-center text-white/40 text-sm">
                        Question {currentStep + 1} of {QUESTIONS.length}
                    </p>
                </div>

                {/* Question */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
                            {currentQuestion.question}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentQuestion.options.map((option) => (
                                <motion.button
                                    key={option.value}
                                    onClick={() => handleSelectOption(option.value)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                                        answers[currentQuestion.id] === option.value
                                            ? 'bg-accent-orange/10 border-accent-orange shadow-lg shadow-accent-orange/20'
                                            : 'bg-white/5 border-white/10 hover:border-accent-orange/50 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="text-4xl">{option.icon}</span>
                                        <span className="text-xl font-semibold">{option.label}</span>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="mt-12 flex items-center justify-between">
                    <button
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                        className="px-6 py-3 rounded-xl text-white/60 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        ← Back
                    </button>

                    {isLastStep && canProceed ? (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-8 py-4 bg-gradient-to-r from-accent-orange to-orange-600 hover:from-orange-600 hover:to-accent-orange text-white font-bold rounded-2xl transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Complete
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => setCurrentStep(Math.min(QUESTIONS.length - 1, currentStep + 1))}
                            disabled={!canProceed || currentStep === QUESTIONS.length - 1}
                            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all duration-300 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Next
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
