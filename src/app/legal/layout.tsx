import type { Metadata } from 'next';
import { env } from '@/config/env';

export const metadata: Metadata = {
  title: 'Legal Information | OKVEVO',
  description: 'Terms of service, privacy policy, and legal information regarding the OKVEVO cinematic generation platform.',
  keywords: ['OKVEVO legal', 'privacy policy', 'terms of service'],
  authors: [{ name: 'Okvevo Team', url: env.siteUrl }],
  openGraph: {
    title: 'Legal Information | OKVEVO',
    description: 'Terms of service, privacy policy, and legal information regarding the OKVEVO cinematic generation platform.',
    url: `${env.siteUrl}/legal`,
    siteName: 'Okvevo',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Legal Information' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Legal Information | OKVEVO',
    description: 'Terms of service, privacy policy, and legal information regarding the OKVEVO cinematic generation platform.',
    images: ['/og-image.jpg'],
  },
  alternates: {
    canonical: `${env.siteUrl}/legal`,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
    return children;
}
