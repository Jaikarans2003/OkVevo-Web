"use client";

import Sidebar from '../../components/layout/Sidebar';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { usePathname } from 'next/navigation';

export default function StudioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isChatPage = pathname === '/chat';
    const isDirectorPage = pathname === '/studio/director';
    const isProductPage = pathname === '/studio/product';

    // Layout Logic:
    // - Chat & Director: App-like, fixed screen height, internal scrolling (or no scrolling).
    // - Product Page: Website-like, natural window scrolling (min-h-screen).
    const isFixedLayout = isChatPage || isDirectorPage;
    const shouldHideSidebar = isChatPage || isDirectorPage || isProductPage || pathname === '/studio/social';

    return (
        <ThemeProvider>
            <div className={`flex text-white font-sans relative ${isFixedLayout ? "h-screen overflow-hidden bg-[#121212]" : "min-h-screen bg-[#121212] overflow-x-hidden"} ${isChatPage ? "bg-[url('/images/chat-bg.jpg')] bg-cover bg-center" : ""}`}>
                {/* Dark Overlay for Chat Page */}
                {isChatPage && <div className="absolute inset-0 bg-custom-bg/60 pointer-events-none z-0" />}

                {/* Fixed Sidebar - Hidden on specific pages */}
                {!shouldHideSidebar && <Sidebar />}

                {/* Main Content Area */}
                <main className={`flex-1 relative z-10 w-full ${isFixedLayout && !isDirectorPage ? 'overflow-auto' : ''}`}>
                    {/* Background Gradients - Hide on restricted pages */}
                    {!shouldHideSidebar && (
                        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
                    )}

                    <div className={`relative z-10 ${shouldHideSidebar ? 'h-full' : (pathname === '/dashboard' ? 'p-0' : 'p-8')}`}>
                        {children}
                    </div>
                </main>
            </div>
        </ThemeProvider>
    );
}
