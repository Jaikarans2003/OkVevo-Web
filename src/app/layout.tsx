import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, MuseoModerno } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "700", "800"],
    variable: "--font-plus-jakarta",
    display: "swap",
});

const playfairDisplay = Playfair_Display({
    subsets: ["latin"],
    weight: ["400", "700"],
    style: ["italic"],
    variable: "--font-playfair",
    display: "swap",
});

const museoModerno = MuseoModerno({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
    variable: "--font-museo-moderno",
    display: "swap",
});

export const metadata: Metadata = {
    title: "OKVEVO - Text to Video",
    description: "Transform your words into motion",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet" />
            </head>
            <body className={`${plusJakartaSans.variable} ${playfairDisplay.variable} ${museoModerno.variable} antialiased`} suppressHydrationWarning>
                <SmoothScroll />
                {children}
            </body>
        </html>
    );
}
