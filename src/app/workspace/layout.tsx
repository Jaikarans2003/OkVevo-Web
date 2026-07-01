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
    const isAiStudioPage = pathname.includes('/ai-studio');
    const isDirectorPage = pathname.includes('/director');
    const isProductPage = pathname.includes('/product');

    // Layout Logic:
    // - AI Studio, Chat & Director: App-like, fixed screen height, internal scrolling.
    // - Others: Website-like, natural window scrolling.
    const isFixedLayout = isChatPage || isDirectorPage || isAiStudioPage;

    return (
        <ThemeProvider>
            <div className={`flex text-white font-sans relative ${isFixedLayout ? `h-screen overflow-hidden ${isAiStudioPage ? 'bg-[#141414]' : 'bg-[#121212]'}` : 'min-h-screen bg-[#121212]'} ${isChatPage ? "bg-[url('/images/chat-bg.jpg')] bg-cover bg-center" : ""}`}>

                {/* Main Content Area */}
                <main className={`flex-1 relative z-10 w-full min-h-0 ${isFixedLayout ? 'h-full overflow-hidden' : ''} ${isFixedLayout && !isDirectorPage && !isAiStudioPage ? 'overflow-auto' : ''}`}>
                    <div className={`relative z-10 ${isFixedLayout ? 'h-full min-h-0' : ''}`}>
                        {children}
                    </div>
                </main>
            </div>
        </ThemeProvider>
    );
}
