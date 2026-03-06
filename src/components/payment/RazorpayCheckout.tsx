'use client';

import { useState } from 'react';
import { auth } from '@/config/firebase';
import { SUBSCRIPTION_PLANS, PlanType } from '@/config/razorpay';

declare global {
    interface Window {
        Razorpay: any;
    }
}

interface RazorpayCheckoutProps {
    planType: PlanType;
    onSuccess?: (subscriptionId: string) => void;
    onError?: (error: string) => void;
}

export default function RazorpayCheckout({ planType, onSuccess, onError }: RazorpayCheckoutProps) {
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async () => {
        const user = auth.currentUser;
        if (!user) {
            onError?.('Please login to subscribe');
            return;
        }

        setLoading(true);

        try {
            // Create subscription
            const response = await fetch('/api/razorpay/create-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planType,
                    userId: user.uid,
                    userEmail: user.email,
                    userName: user.displayName,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to create subscription');
            }

            // Load Razorpay script if not already loaded
            if (!window.Razorpay) {
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.async = true;
                document.body.appendChild(script);
                await new Promise((resolve) => {
                    script.onload = resolve;
                });
            }

            // Initialize Razorpay checkout
            const options = {
                key: data.razorpayKeyId,
                subscription_id: data.subscriptionId,
                name: 'OKVEVO',
                description: SUBSCRIPTION_PLANS[planType].name,
                image: '/logo.png',
                prefill: {
                    email: data.userEmail,
                    name: data.userName,
                },
                theme: {
                    color: '#FF6B35',
                    backdrop_color: 'rgba(0, 0, 0, 0.8)',
                },
                config: {
                    display: {
                        blocks: {
                            banks: {
                                name: 'All payment methods',
                                instruments: [
                                    {
                                        method: 'card',
                                    },
                                    {
                                        method: 'upi',
                                    },
                                    {
                                        method: 'netbanking',
                                    },
                                    {
                                        method: 'wallet',
                                    },
                                ],
                            },
                        },
                        sequence: ['block.banks'],
                        preferences: {
                            show_default_blocks: true,
                        },
                    },
                },
                handler: async (response: any) => {
                    // Verify payment
                    const verifyResponse = await fetch('/api/razorpay/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_subscription_id: response.razorpay_subscription_id,
                            razorpay_signature: response.razorpay_signature,
                            userId: user.uid,
                            planType,
                        }),
                    });

                    const verifyData = await verifyResponse.json();

                    if (verifyData.success) {
                        onSuccess?.(response.razorpay_subscription_id);
                    } else {
                        onError?.(verifyData.error || 'Payment verification failed');
                    }
                },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                    },
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();

        } catch (error) {
            console.error('Subscription error:', error);
            onError?.(error instanceof Error ? error.message : 'Subscription failed');
            setLoading(false);
        }
    };

    const plan = SUBSCRIPTION_PLANS[planType];

    return (
        <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-3 px-6 rounded-xl font-bold text-sm uppercase tracking-wider transition-all bg-gradient-to-r from-accent-orange to-accent-orange/80 text-white hover:from-accent-orange/90 hover:to-accent-orange/70 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
            {loading ? 'Processing...' : `Subscribe to ${plan.name}`}
        </button>
    );
}
