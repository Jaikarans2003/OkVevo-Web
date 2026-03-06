import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Alumni_Sans, Changa_One, Unbounded, MuseoModerno } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const inter = Inter({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
    variable: "--font-inter",
    display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    variable: "--font-plus-jakarta",
    display: "swap",
});

const alumniSans = Alumni_Sans({
    subsets: ["latin"],
    weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
    variable: "--font-alumni-sans",
    display: "swap",
});

const changaOne = Changa_One({
    subsets: ["latin"],
    weight: ["400"],
    variable: "--font-changa-one",
    display: "swap",
});

const unbounded = Unbounded({
    subsets: ["latin"],
    weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
    variable: "--font-unbounded",
    display: "swap",
});

const museoModerno = MuseoModerno({
    subsets: ["latin"],
    weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
    variable: "--font-museo-moderno",
    display: "swap",
});

export const metadata: Metadata = {
    title: "OKVEVO - Text to Video",
    description: "Transform your words into motion",
};

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Alumni+Sans:ital,wght@0,100..900;1,100..900&family=Changa+One:ital@0;1&family=MuseoModerno:ital,wght@0,100..900;1,100..900&family=Unbounded:wght@200..900&display=swap" rel="stylesheet" />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches === true;
                  if (!theme && supportDarkMode) theme = 'dark';
                  if (!theme) theme = 'light';
                  document.documentElement.classList.add(theme);
                } catch (e) {}
              })();
            `,
                    }}
                />
            </head>
            <body className={`${museoModerno.className} ${museoModerno.variable} ${alumniSans.variable} ${plusJakarta.variable} ${changaOne.variable} ${unbounded.variable} antialiased`} suppressHydrationWarning>
                <ThemeProvider>
                    <SmoothScroll />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
