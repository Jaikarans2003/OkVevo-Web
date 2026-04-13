'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import PublicLayout from '@/components/layouts/PublicLayout';
import Pricing from '@/components/ook/Pricing';

export default function PricingPage() {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    return (
        <PublicLayout>
            <div className="pt-20">
                <Pricing user={user} />
            </div>
        </PublicLayout>
    );
}
