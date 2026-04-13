import type { Metadata } from 'next';
import PublicLayout from '@/components/layouts/PublicLayout';
import HowItWorks from '@/components/ook/Features';
import FeaturesGrid from '@/components/ook/FeaturesGrid';

export const metadata: Metadata = {
    title: 'OKVEVO Features - Best AI Video Generator for Instagram & YouTube | Faceless Content',
    description: 'OKVEVO AI features: Create viral reels without camera, AI influencer generator, automated video creation, text to video AI for YouTube shorts. Best AI tools for creators in India.',
    keywords: [
        'OKVEVO features', 'OKVEVO AI features', 'AI video generator features', 'text to video AI features',
        'AI reel generator features', 'AI short video generator', 'AI influencer creator features',
        'faceless video creator AI', 'automated video creation features', 'AI avatar video generator',
        'best AI video generator for Instagram reels', 'AI tool to create reels automatically',
        'AI video generator for beginners', 'AI video creation tool for marketing',
        'create faceless YouTube channel with AI', 'AI tools for Instagram creators',
        'AI tools for YouTubers', 'AI tools for digital marketing', 'AI content automation tool',
        'AI video generator India features', 'best AI tools for creators in India',
        'make reels without showing face', 'create viral reels using AI', 'AI content creator tool',
        'OKVEVO vs AI video tools', 'best alternative to AI video generators',
    ],
    openGraph: {
        title: 'OKVEVO AI Features - Complete AI Video Creation Platform',
        description: 'AI reel generator, faceless content creator, text to video AI. Perfect for Instagram, YouTube & marketing.',
    },
};

export default function FeaturesPage() {
    return (
        <PublicLayout>
            <HowItWorks />
            {/* <FeaturesGrid /> */}
        </PublicLayout>
    );
}
