'use client';

import { useState } from 'react';
import { auth } from '@/config/firebase';

declare global {
    interface Window {
        Razorpay: any;
    }
}

interface CartItem {
    id: string;
    name: string;
    price: number;
    trendType: string;
    fullBodyImageUrl: string;
    faceImageUrl: string | null;
}

interface MasivRazorpayCheckoutProps {
    cartItems: CartItem[];
    totalAmount: number;
    userName: string;
    whatsappNumber: string;
    email?: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

export default function MasivRazorpayCheckout({
    cartItems,
    totalAmount,
    userName,
    whatsappNumber,
    email,
    onSuccess,
    onError,
}: MasivRazorpayCheckoutProps) {
    const [loading, setLoading] = useState(false);

    const handleCheckout = async () => {
        const user = auth.currentUser;
        const userId = user?.uid || `guest_${Date.now()}`;
        const userEmail = user?.email || email || `${whatsappNumber}@guest.masiv`;

        setLoading(true);

        try {
            // Create Razorpay order
            const response = await fetch('/api/razorpay/create-masiv-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cartItems,
                    totalAmount,
                    userName,
                    whatsappNumber,
                    email,
                    userId,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to create order');
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
                order_id: data.orderId,
                amount: data.amount * 100, // in paise
                currency: data.currency,
                name: 'OKVEVO x MASIV',
                description: `${cartItems.length} Trend${cartItems.length > 1 ? 's' : ''}`,
                image: '/masiv/masivlogo.png',
                prefill: {
                    name: userName,
                    contact: whatsappNumber,
                    email: userEmail,
                },
                theme: {
                    color: '#FF6B35',
                    backdrop_color: 'rgba(0, 0, 0, 0.9)',
                },
                handler: async (response: any) => {
                    // Verify payment and create order in Firestore
                    const verifyResponse = await fetch('/api/razorpay/verify-masiv-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            cartItems,
                            userName,
                            whatsappNumber,
                            email,
                            userId,
                            userEmail,
                            totalAmount,
                        }),
                    });

                    const verifyData = await verifyResponse.json();

                    if (verifyData.success) {
                        onSuccess?.();
                    } else {
                        onError?.(verifyData.error || 'Payment verification failed');
                    }
                    setLoading(false);
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
            console.error('Checkout error:', error);
            onError?.(error instanceof Error ? error.message : 'Checkout failed');
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleCheckout}
            disabled={loading || !userName.trim() || !whatsappNumber.trim()}
            className={`w-full py-5 font-black uppercase tracking-widest text-sm rounded-2xl transition-all shadow-xl ${
                loading
                    ? 'bg-[#FF6B35]/50 text-white cursor-wait'
                    : !userName.trim() || !whatsappNumber.trim()
                    ? 'bg-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-white/90'
            }`}
        >
            {loading
                ? 'Processing...'
                : !userName.trim() || !whatsappNumber.trim()
                ? 'Fill Required Details'
                : 'Proceed to Checkout'}
        </button>
    );
}
