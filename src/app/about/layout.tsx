import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About OkVevo | AI-Powered Content Creation Platform',
  description: 'OkVevo is redefining content creation with AI. Transform ideas into ready-to-publish videos in minutes with custom avatars, realistic voiceovers, and precise lip-sync technology.',
  keywords: ['OkVevo', 'about us', 'AI content creation', 'AI influencer', 'AI avatars', 'video generation', 'content automation', 'Your AI Adda'],
  authors: [{ name: 'OkVevo Team', url: 'https://okvevo.com' }],
  openGraph: {
    title: 'About OkVevo | Redefining Content Creation',
    description: 'We enable creators, brands, and businesses to produce high-quality, human-like video content—without the time, cost, or complexity of traditional production.',
    url: 'https://okvevo.com/about',
    siteName: 'OkVevo',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'About OkVevo - AI Content Creation Platform' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About OkVevo | AI-Powered Content Creation',
    description: 'Transform ideas into ready-to-publish videos in minutes. Your face, your voice, your style—scaled with AI.',
    images: ['/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://okvevo.com/about',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
    return children;
}
