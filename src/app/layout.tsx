import type { Metadata } from "next";
import { Ubuntu, Dancing_Script } from "next/font/google";
import "./globals.css";
import { env } from "@/config/env";
// SmoothScroll will be moved to LandingPage for better optimization control

const ubuntu = Ubuntu({
    subsets: ["latin"],
    weight: ["300", "400", "500", "700"],
    variable: "--font-ubuntu",
    display: "swap",
});

const dancingScript = Dancing_Script({
    subsets: ["latin"],
    weight: ["700"],
    variable: "--font-dancing",
    display: "swap",
});

export const metadata: Metadata = {
    metadataBase: new URL(env.siteUrl),
    title: "OKVEVO | Create Videos from Text Instantly",
    description: "OKVEVO AI - Best AI video generator for Instagram reels, YouTube shorts & faceless content. Create viral videos using AI without camera. Text to video AI tool for creators in India.",
    keywords: [
        // Brand Keywords
        'OKVEVO', 'OKVEVO AI', 'OKVEVO platform', 'OKVEVO video generator', 'OKVEVO AI video tool',
        'OKVEVO official', 'OKVEVO app', 'OKVEVO studio', 'OKVEVO AI creator', 'OKVEVO login',
        // Core Product Keywords
        'AI video generator', 'text to video AI', 'AI content creation tool', 'AI video maker',
        'AI reel generator', 'AI short video generator', 'AI influencer creator', 'AI avatar video generator',
        'faceless video creator AI', 'automated video creation',
        // Long-tail Keywords
        'best AI video generator for Instagram reels', 'AI tool to create reels automatically',
        'how to create videos using AI without camera', 'AI influencer generator free',
        'text to video AI for YouTube shorts', 'AI video generator for beginners',
        'AI video creation tool for marketing', 'create faceless YouTube channel with AI',
        'AI storytelling video generator', 'generate videos from script AI',
        // India-specific Keywords
        'AI video generator India', 'best AI tools for creators in India',
        'AI content creation platform India', 'AI reel maker India', 'Indian AI video generator',
        'AI startup India video tools',
        // Creator/Business Keywords
        'AI tools for Instagram creators', 'AI tools for YouTubers', 'AI tools for digital marketing',
        'AI video ads generator', 'AI content automation tool', 'AI tools for startups', 'AI branding tools',
        // Viral/Gen-Z Keywords
        'make reels without showing face', 'AI content creator tool', 'create viral reels using AI',
        'faceless Instagram growth AI', 'AI influencer creation tool', 'automate content creation AI',
    ],
    icons: {
        icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
        shortcut: '/favicon.svg',
        apple: '/favicon.svg',
    },
    openGraph: {
        title: 'OKVEVO | Create Videos from Text Instantly',
        description: 'Create viral reels & videos using AI. No camera needed. Perfect for Instagram, YouTube & faceless content creation.',
        type: 'website',
        locale: 'en_IN',
        siteName: 'OKVEVO',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'OKVEVO | Create Videos from Text Instantly',
        description: 'Best AI video generator for Instagram reels, YouTube shorts. Create faceless videos with AI.',
    },
    alternates: {
        canonical: env.siteUrl,
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { AppLoadingGate } from "@/components/shared/AppLoadingGate";
import StructuredData from "@/components/shared/StructuredData";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <StructuredData />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                  if (!theme && supportDarkMode) theme = 'dark';
                  if (!theme) theme = 'dark';
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();
            `,
                    }}
                />
            </head>
            <body className={`${ubuntu.className} ${ubuntu.variable} ${dancingScript.variable} font-sans antialiased bg-bg-main min-h-dvh`} suppressHydrationWarning>
                <ThemeProvider>
                    <AppLoadingGate>
                        {children}
                    </AppLoadingGate>
                </ThemeProvider>
            </body>
        </html>
    );
}
