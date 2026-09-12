'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { BillingCurrency } from '@/config/razorpay';

type CouponValidationResponse = {
    valid: boolean;
    discountAmount: number;
    type: 'affiliate' | 'flat' | null;
    affiliateId?: string;
    message: string;
    finalAmount?: number;
    couponCode?: string;
};

interface RazorpayCheckoutProps {
    planType: 'starter' | 'pro' | 'max';
    billingPeriod?: 'monthly' | 'annual';
    currency?: BillingCurrency;
    couponData?: CouponValidationResponse | null;
    highlighted?: boolean;
    onSuccess?: (subscriptionId: string) => void;
    onError?: (error: string) => void;
}

declare global {
    interface Window {
        Razorpay: any;
    }
}

const RazorpayCheckout = ({ planType, billingPeriod = 'monthly', currency = 'USD', couponData, highlighted, onSuccess, onError }: RazorpayCheckoutProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);

    // Load Razorpay script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => setScriptLoaded(true);
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handlePayment = async () => {
        if (!user) {
            onError?.('Please login to continue');
            return;
        }

        if (!scriptLoaded) {
            onError?.('Payment system is loading. Please try again.');
            return;
        }

        setLoading(true);

        try {
            // Create subscription
            const idToken = await user.getIdToken();
            const response = await fetch('/api/razorpay/create-subscription', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    planType,
                    billingPeriod,
                    currency,
                    couponCode: couponData?.valid ? couponData : undefined,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to create subscription');
            }

            const { subscriptionId, razorpayKeyId, shortUrl } = data;

            // Open Razorpay checkout
            const options = {
                key: razorpayKeyId,
                subscription_id: subscriptionId,
                name: 'OKVEVO',
                description: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan Subscription`,
                image: '/OKVEVO Logos WithOut BackGrounds/White.svg',
                prefill: {
                    name: user.displayName || '',
                    email: user.email || '',
                },
                theme: {
                    color: '#FF6B35',
                },
                handler: function (response: any) {
                    console.log('Payment successful:', response);
                    onSuccess?.(subscriptionId);
                },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                        onError?.('Payment cancelled');
                    },
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();

        } catch (error: any) {
            console.error('Payment error:', error);
            onError?.(error.message || 'Payment failed');
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handlePayment}
            disabled={loading || !scriptLoaded}
            className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 uppercase tracking-widest ${
                highlighted
                    ? 'bg-gradient-to-r from-[#ff6b00] to-[#ff4500] text-white hover:opacity-90 shadow-[0_0_30px_rgba(255,107,0,0.4)] border border-orange-500/50 transform hover:scale-[1.05]'
                    : 'bg-[#151515] text-white hover:bg-[#222] border border-[#2a2a2a] hover:border-[#444]'
            } ${loading || !scriptLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {loading ? 'Processing...' : scriptLoaded ? 'Get Plan' : 'Loading...'}
        </button>
    );
};

export default RazorpayCheckout;
