import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "AIVOZO - Text to Video",
    description: "Transform your words into motion",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
