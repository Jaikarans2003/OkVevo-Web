'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

import NoiseOverlay from '@/components/shared/NoiseOverlay';
import Navbar from './Navbar';
import Hero from './Hero';
import JsonLd from '@/components/shared/JsonLd';
import Footer from './Footer';
import dynamic from 'next/dynamic';

const Demo = dynamic(() => import('./Demo'));
const HowItWorks = dynamic(() => import('./Features'));
const Pricing = dynamic(() => import('./Pricing'));
const Faq = dynamic(() => import('./Faq'));
const SmoothScroll = dynamic(() => import('./SmoothScroll'), { ssr: false });

import SEOKeywords from './SEOKeywords';
import { env } from '@/config/env';

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Okvevo",
  "url": env.siteUrl,
  "logo": `${env.siteUrl}/OKVEVO%20Logos%20With%20BackGrounds/OrangeBackGround.svg`,
  "sameAs": [
    "https://instagram.com/okvevo",
    "https://linkedin.com/company/okvevo",
    "https://youtube.com/@okvevo",
    "https://x.com/okvevo"
  ],
  "potentialAction": {
    "@type": "SearchAction",
    "target": `${env.siteUrl}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string"
  }
};
const faqItems = [
  {
    question: "What is OkVevo and what does it offer?",
    answer: "OkVevo is an AI content creation platform that turns source media into polished videos with editing, captions, and custom visuals. OkVevo also offers a physical experience called 'Your AI Adda' located in MASIV Shakarnagar, Bangalore, where users can explore AI-powered content creation in a real-world setting."
  },
  {
    question: "Can I create AI reels using my own content?",
    answer: "Yes, you can upload your own scripts, videos, and audio. OkVevo processes your inputs to generate engaging, polished videos optimized for platforms like Instagram and YouTube."
  },
  {
    question: "Can I add my logo or disclaimers to the videos?",
    answer: "Yes, OkVevo allows full customization with branding elements such as logos, disclaimers, and overlays, ensuring your content aligns with your brand identity."
  },
  {
    question: "What is the OkVevo 'Your AI Adda' in Bangalore?",
    answer: "'Your AI Adda' is an AI-powered experience booth located in an ultra-luxury wellness centerMASIV in Shakarnagar, Bangalore. It allows users to create trending videos and images instantly using AI, without any editing skills."
  },
  {
    question: "How does the 'Your AI Adda' create videos?",
    answer: "Users select a trend or style, and the system captures their visuals. AI then generates ready-to-share videos or images instantly, tailored for trending formats like reels and shorts."
  }
];

export default function LandingPage() {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="min-h-screen bg-bg-main">
            <JsonLd data={websiteSchema} />
            <SmoothScroll />
            <NoiseOverlay />
            <Navbar />
            <main>
                <Hero />
                <div id="demo">
                    <Demo />
                </div>
                <div id="features">
                    <HowItWorks />
                </div>
                <div id="pricing">
                    <Pricing user={user} />
                </div>
                <Faq items={faqItems} />
            </main>
            <Footer />
            <SEOKeywords />
        </div>
    );
}
