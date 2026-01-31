import type { Metadata } from "next";
import { MuseoModerno } from "next/font/google";
import "./globals.css";

const museoModerno = MuseoModerno({
    subsets: ["latin"],
    variable: "--font-museo-moderno",
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
            <body className={`${museoModerno.variable} antialiased`} suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}
