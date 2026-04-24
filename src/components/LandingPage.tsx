'use client';

import { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

import NoiseOverlay from './NoiseOverlay';
import Navbar from './ook/Navbar';
import Hero from './ook/Hero';
import JsonLd from './JsonLd';
import Footer from './ook/Footer';
import dynamic from 'next/dynamic';

const Demo = dynamic(() => import('./ook/Demo'));
const HowItWorks = dynamic(() => import('./ook/Features'));
const MasivCollaboration = dynamic(() => import('./ook/MasivCollaboration'));
const Pricing = dynamic(() => import('./ook/Pricing'));
const Faq = dynamic(() => import('./Faq'));
const SmoothScroll = dynamic(() => import('./SmoothScroll'), { ssr: false });

import SEOKeywords from './SEOKeywords';

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Okvevo",
  "url": "https://okvevo.com",
  "logo": "https://okvevo.com/OKVEVO%20With%20BackGrounds/OrangeBackGround.svg",
  "sameAs": [
    "https://instagram.com/okvevo",
    "https://linkedin.com/company/okvevo",
    "https://youtube.com/@okvevo",
    "https://x.com/okvevo"
  ],
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://okvevo.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};
const faqItems = [
  {
    question: "What is OkVevo and what does it offer?",
    answer: "OkVevo is an AI content creation platform that enables users to generate high-quality, Instagram-ready videos in minutes. It eliminates the need for shoots, editing, and retakes through its AI Influencer Suite. OkVevo also offers a physical experience called 'Your AI Adda' located in MASIV Shakarnagar, Bangalore, where users can explore AI-powered content creation in a real-world setting."
  },
  {
    question: "How does the AI Influencer Suite work?",
    answer: "Users simply upload a script or idea, choose or upload custom avatars and voice samples, and OkVevo takes care of the rest. The platform refines the script, synchronizes lip movements, and enhances the video with captions, visuals, and effects to produce professional short-form content ready for social media."
  },
  {
    question: "Can I create AI reels using my own content?",
    answer: "Yes, you can upload your own scripts, videos, and audio. OkVevo processes your inputs to generate engaging, polished videos optimized for platforms like Instagram and YouTube."
  },
  {
    question: "Does OkVevo support accurate AI lip sync?",
    answer: "Yes, OkVevo uses advanced AI lip-sync technology to precisely match speech with facial expressions, ensuring your videos look natural, professional, and highly engaging."
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
  },
  {
    question: "Who should use OkVevo AI Influencer Suite?",
    answer: "OkVevo is ideal for content creators, influencers, startups, and enterprises who want to create high-quality AI-generated videos that look, sound, and behave like them—quickly, easily, and at scale."
  }
];

export default function LandingPage() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    // Firebase authentication
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleJoinClick = () => {
        if (user) {
            router.push('/workspace');
        } else {
            router.push('/login');
        }
    };

    return (
        <div className="min-h-screen bg-bg-main">
            <JsonLd data={websiteSchema} />
            <SmoothScroll />
            <NoiseOverlay />
            <Navbar user={user} onJoinClick={handleJoinClick} />
            <main>
                <Hero onJoinClick={handleJoinClick} />
                <div id="demo">
                    <Demo />
                </div>
                {/* <Features /> */}
                <div id="features">
                    <HowItWorks />
                </div>
                {/* <BuiltForCreators /> */}
                <MasivCollaboration />
                <div id="pricing">
                    <Pricing user={user} />
                </div>
                {/* <FeaturesGrid /> */}
                <Faq items={faqItems} />
                {/* <TuneTalez /> */}
                {/* <Quotes onJoinClick={handleJoinClick} /> */}
            </main>
            <Footer />
            {/* SEO Keywords - Hidden but indexed by search engines */}
            <SEOKeywords />
        </div>
    );
}
