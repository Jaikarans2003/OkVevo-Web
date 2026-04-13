import type { Metadata } from 'next';
import PublicLayout from '@/components/layouts/PublicLayout';
import HowItWorks from '@/components/ook/Features';
import FeaturesGrid from '@/components/ook/FeaturesGrid';

export const metadata: Metadata = {
    title: 'Features - AI Video Generation Tools | OKVEVO',
    description: 'Explore OKVEVO\'s powerful AI video generation features. Transform text to video with advanced AI technology, professional templates, and easy-to-use tools.',
    keywords: ['AI video features', 'video generation tools', 'text to video features', 'AI video editor', 'OKVEVO features'],
};

export default function FeaturesPage() {
    return (
        <PublicLayout>
            <HowItWorks />
            {/* <FeaturesGrid /> */}
        </PublicLayout>
    );
}
