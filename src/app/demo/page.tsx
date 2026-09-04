import type { Metadata } from 'next';
import PublicLayout from '@/components/shared/layouts/PublicLayout';
import Demo from '@/components/landing-page/Demo';

export const metadata: Metadata = {
    title: 'OKVEVO Demo - AI Video Generator in Action | Create Reels Without Camera',
    description: 'Watch OKVEVO AI create viral Instagram reels and YouTube shorts automatically. Best AI video generator demo - text to video in seconds. No camera needed for faceless content creation.',
    keywords: [
        'OKVEVO demo', 'OKVEVO AI demo', 'AI video generator demo', 'text to video AI demo',
        'AI reel generator demo', 'faceless video creator demo', 'AI video maker in action',
        'how to create videos using AI without camera', 'AI tool to create reels automatically',
        'best AI video generator for Instagram reels demo', 'AI influencer generator demo',
        'create viral reels using AI', 'automated video creation demo', 'AI content creator tool demo',
        'AI video generator India demo', 'OKVEVO platform demo', 'AI storytelling video generator',
    ],
    openGraph: {
        title: 'OKVEVO AI Demo - See AI Video Generation in Action',
        description: 'Watch how OKVEVO creates viral reels and videos using AI. Perfect for Instagram, YouTube & faceless content.',
    },
};

export default function DemoPage() {
    return (
        <PublicLayout>
            <Demo />
        </PublicLayout>
    );
}
