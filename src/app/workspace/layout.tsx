"use client";

import { ThemeProvider } from '../../contexts/ThemeContext';
import { usePathname } from 'next/navigation';

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isAiStudioPage = pathname.includes('/ai-studio');

    return (
        <ThemeProvider>
            <div className={`flex text-white font-sans relative ${isAiStudioPage ? 'h-screen overflow-hidden bg-[#141414]' : 'min-h-screen bg-[#121212]'}`}>

                {/* Main Content Area */}
                <main className={`flex-1 relative z-10 w-full min-h-0 ${isAiStudioPage ? 'h-full overflow-hidden' : ''}`}>
                    <div className={`relative z-10 ${isAiStudioPage ? 'h-full min-h-0' : ''}`}>
                        {children}
                    </div>
                </main>
            </div>
        </ThemeProvider>
    );
}
