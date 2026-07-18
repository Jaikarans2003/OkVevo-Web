import type { Metadata } from 'next';
import { env } from '@/config/env';

export const metadata: Metadata = {
  title: 'User Profile | OKVEVO',
  description: 'Manage your OKVEVO profile, API keys, cinematic generations, and account settings.',
  keywords: ['OKVEVO profile', 'account settings', 'dashboard'],
  authors: [{ name: 'Okvevo Team', url: env.siteUrl }],
  openGraph: {
    title: 'User Profile | OKVEVO',
    description: 'Manage your OKVEVO profile, API keys, cinematic generations, and account settings.',
    url: `${env.siteUrl}/profile`,
    siteName: 'Okvevo',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'User Profile' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'User Profile | OKVEVO',
    description: 'Manage your OKVEVO profile and settings.',
    images: ['/og-image.jpg'],
  },
  alternates: {
    canonical: `${env.siteUrl}/profile`,
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return children;
}
