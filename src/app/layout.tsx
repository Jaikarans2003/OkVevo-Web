import type { Metadata } from "next";
import { Ubuntu, Allura, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { env } from "@/config/env";
// SmoothScroll will be moved to LandingPage for better optimization control

const ubuntu = Ubuntu({
    subsets: ["latin"],
    weight: ["300", "400", "500", "700"],
    style: ["normal", "italic"],
    variable: "--font-ubuntu",
    display: "swap",
});

const allura = Allura({
    subsets: ["latin"],
    weight: "400",
    variable: "--font-script",
    display: "swap",
});

const display = Instrument_Serif({
    subsets: ["latin"],
    weight: "400",
    style: ["normal", "italic"],
    variable: "--font-display",
    display: "swap",
});

export const metadata: Metadata = {
    metadataBase: new URL(env.siteUrl),
    title: "Nia by OkVevo",
    description: "All-rounder by nature. Accountant by profession. Nia is a personal AI agent for everyday work, and for the accounts work a firm does every month.",
    keywords: [
        'Nia',
        'OkVevo',
        'desktop agent',
        'Mac',
        'Windows',
        'local AI',
    ],
    icons: {
        icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
        shortcut: '/favicon.svg',
        apple: '/favicon.svg',
    },
    openGraph: {
        title: 'Nia by OkVevo',
        description: 'All-rounder by nature. Accountant by profession.',
        type: 'website',
        locale: 'en_IN',
        siteName: 'OKVEVO',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Nia by OkVevo',
        description: 'All-rounder by nature. Accountant by profession.',
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
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                } catch (e) {}
              })();
            `,
                    }}
                />
            </head>
            <body className={`${ubuntu.className} ${ubuntu.variable} ${allura.variable} ${display.variable} font-sans antialiased bg-bg-main min-h-dvh`} suppressHydrationWarning>
                <ThemeProvider>
                    <AppLoadingGate>
                        {children}
                    </AppLoadingGate>
                </ThemeProvider>
            </body>
        </html>
    );
}
