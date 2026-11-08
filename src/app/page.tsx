import type { Metadata } from 'next';
import LandingPage from '../components/landing-page/LandingPage';

const title = 'OkVevo — The Operating System for Businesses';
const description =
    'OkVevo is an AI-powered business operating system that connects and automates Technology, Finance, Marketing, Sales and Operations through customised workflows, expert deployment and ongoing support.';

export const metadata: Metadata = {
    title,
    description,
    openGraph: { title, description, type: 'website', locale: 'en_IN', siteName: 'OKVEVO' },
    twitter: { card: 'summary_large_image', title, description },
};

export default function Home() {
    return <LandingPage />;
}
