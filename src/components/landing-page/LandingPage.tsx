'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import dynamic from 'next/dynamic';
import { auth } from '@/config/firebase';
import { env } from '@/config/env';
import JsonLd from '@/components/shared/JsonLd';
import Navbar from './Navbar';
import Footer from './Footer';
import Faq from './Faq';
import PinnedStory from './PinnedStory';
import PeopleReveal from './PeopleReveal';
import AssistantCircles from './AssistantCircles';
import AccountantParallax from './AccountantParallax';
import SeeNia from './SeeNia';
import WhyNia from './WhyNia';
import Pricing from './Pricing';

const SmoothScroll = dynamic(() => import('./SmoothScroll'), { ssr: false });

const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'OkVevo',
    url: env.siteUrl,
    logo: `${env.siteUrl}/OKVEVO%20Logos%20With%20BackGrounds/OrangeBackGround.svg`,
    sameAs: [
        'https://instagram.com/okvevo',
        'https://linkedin.com/company/okvevo',
        'https://x.com/OKVEVO_AI',
    ],
};

const faqItems = [
    {
        question: 'Is Nia only for accounting?',
        answer: 'No. She’s a full personal agent. Accounting is her profession, not her limit.',
    },
    {
        question: 'Does she file returns on her own?',
        answer: 'No. She does not file returns. You review and file. Accounting preparation is coming soon.',
    },
    {
        question: 'Where do I use her?',
        answer: 'In the Nia desktop app, on Mac or Windows.',
    },
    {
        question: 'Is my client data safe?',
        answer: 'You approve actions that change your computer. Sessions and files stay on that machine.',
    },
    {
        question: 'Why a pet, not a person?',
        answer: 'She isn’t pretending to be human. She’s just very good at her job.',
    },
];

export default function LandingPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) router.replace('/billing');
        });
        return () => unsubscribe();
    }, [router]);

    return (
        <div className="nia-landing min-h-screen">
            <JsonLd data={websiteSchema} />
            <SmoothScroll />
            <Navbar />
            <main id="main">
                <PinnedStory />
                <PeopleReveal />
                <AssistantCircles />
                <AccountantParallax />
                <SeeNia />
                <WhyNia />
                <Pricing user={user} />
                <Faq items={faqItems} />
            </main>
            <Footer />
        </div>
    );
}
