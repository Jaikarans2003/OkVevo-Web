import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const ubuntu = Ubuntu({
    subsets: ["latin"],
    weight: ["300", "400", "500", "700"],
    variable: "--font-ubuntu",
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
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap" rel="stylesheet" />
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
            <body className={`${ubuntu.className} ${ubuntu.variable} font-sans antialiased`} suppressHydrationWarning>
                <ThemeProvider>
                    <SmoothScroll />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
