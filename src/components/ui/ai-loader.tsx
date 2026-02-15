"use client";

import { cn } from "@/lib/utils";

interface AILoaderProps {
    className?: string;
    text?: string;
}

export const AILoader = ({ className, text = "Generating" }: AILoaderProps) => {
    const letters = text.split("");

    return (
        <div className={cn("flex flex-col items-center justify-center gap-8", className)}>
            <div className="loader-wrapper relative flex items-center justify-center">
                <div className="flex gap-1.5 z-10">
                    {letters.map((letter, i) => (
                        <span
                            key={i}
                            className="loader-letter text-2xl font-bold text-white"
                            style={{ animationDelay: `${i * 0.1}s` }}
                        >
                            {letter}
                        </span>
                    ))}
                </div>
                <div className="loader absolute w-48 h-48 rounded-full border-4 border-transparent shadow-[0_0_50px_rgba(173,95,255,0.2)]"></div>
            </div>
        </div>
    );
};
