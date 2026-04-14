import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About OKVEVO | Okvevo',
  description: 'Learn about OKVEVO, our mission, and how we are building the future of generative cinematic creation.',
  keywords: ['OKVEVO', 'about us', 'cinematic generation', 'AI video', 'okvevo team'],
  authors: [{ name: 'Okvevo Team', url: 'https://okvevo.com' }],
  openGraph: {
    title: 'About OKVEVO',
    description: 'Learn about OKVEVO, our mission, and how we are building the future of generative cinematic creation.',
    url: 'https://okvevo.com/about',
    siteName: 'Okvevo',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'About OKVEVO Cinematic Studio' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About OKVEVO',
    description: 'Learn about OKVEVO, our mission, and how we are building the future of generative cinematic creation.',
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
