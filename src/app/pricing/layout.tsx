import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Pricing Plans - Affordable AI Video Creation | OKVEVO',
    description: 'Choose the perfect plan for your video creation needs. Flexible pricing for creators, businesses, and enterprises. Start creating AI videos today.',
    keywords: ['OKVEVO pricing', 'AI video pricing', 'video generation plans', 'subscription plans'],
};

export default function PricingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
