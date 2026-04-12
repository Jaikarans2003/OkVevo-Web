"use client";

import { ThemeProvider } from '../../contexts/ThemeContext';
import { usePathname } from 'next/navigation';

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isChatPage = false;
    const isDirectorPage = pathname.includes('/director');
    const isProductPage = pathname.includes('/product');

    // Layout Logic:
    // - Chat & Director: App-like, fixed screen height, internal scrolling.
    // - Others: Website-like, natural window scrolling.
    const isFixedLayout = isChatPage || isDirectorPage;

    return (
        <ThemeProvider>
            <div className={`flex text-white font-sans relative ${isFixedLayout ? "h-screen overflow-hidden bg-[#121212]" : "min-h-screen bg-[#121212]"} ${isChatPage ? "bg-[url('/images/chat-bg.jpg')] bg-cover bg-center" : ""}`}>

                {/* Main Content Area */}
                <main className={`flex-1 relative z-10 w-full ${isFixedLayout && !isDirectorPage ? 'overflow-auto' : ''}`}>
                    <div className="relative z-10">
                        {children}
                    </div>
                </main>
            </div>
        </ThemeProvider>
    );
}
