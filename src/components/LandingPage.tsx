'use client';

import { useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

import NoiseOverlay from './NoiseOverlay';
import Navbar from './ook/Navbar';
import Hero from './ook/Hero';
import JsonLd from './JsonLd';
import Faq from './Faq';

import Demo from './ook/Demo';
import HowItWorks from './ook/Features';
import Pricing from './ook/Pricing';
import MasivCollaboration from './ook/MasivCollaboration';
import FeaturesGrid from './ook/FeaturesGrid';
import Footer from './ook/Footer';
import SEOKeywords from './SEOKeywords';

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": ["WebSite", "Organization"],
  "name": "Okvevo",
  "url": "https://okvevo.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://okvevo.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
};

const faqItems = [
    { question: "What is OkVevo and what does it offer?", answer: "OkVevo is an AI content creation platform that offers an AI influencer video generator and a physical Trend Booth in Bangalore. It helps users create high-quality, lip-synced videos and trending content quickly for platforms like Instagram Reels and YouTube Shorts." },
    { question: "How does the AI influencer video generator work?", answer: "Users upload a video, script, and audio. OkVevo refines the script, synchronizes lip movements using AI, and enhances the video with captions, visuals, and effects to create professional short-form content ready for social media." },
    { question: "Can I create AI reels using my own content?", answer: "Yes, you can upload your own video, script, and audio to create AI reels. OkVevo processes your inputs and generates engaging, polished videos optimized for platforms like Instagram and YouTube." },
    { question: "Does OkVevo support accurate AI lip sync?", answer: "Yes, OkVevo uses advanced AI lip sync technology to match speech with facial expressions precisely, ensuring your videos look natural, professional, and highly engaging." },
    { question: "Can I add my logo or disclaimers to the videos?", answer: "Yes, OkVevo allows users to add custom branding such as logos, disclaimers, and overlays. This ensures your content maintains brand identity and is suitable for professional or promotional use." },
    { question: "What is the OkVevo Trend Booth in Bangalore?", answer: "The OkVevo Trend Booth is an AI-powered setup located in a major gym in Bangalore where users can create trending videos and images instantly using AI, without needing any editing skills." },
    { question: "How does the Trend Booth create videos?", answer: "Users select a trend or style, and the AI generates personalized content on the spot. The system creates ready-to-share videos or images tailored for social media trends like reels and shorts." },
    { question: "Who should use OkVevo?", answer: "OkVevo is ideal for content creators, influencers, businesses, and gym visitors who want to create high-quality AI-generated videos quickly and easily, whether online or through the Trend Booth." }
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
