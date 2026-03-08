'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const ScrollPlane = () => {
    const planeRef = useRef<HTMLDivElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!planeRef.current || !pathRef.current || !containerRef.current) return;

        // Total length of the path for the trail effect
        const pathLength = pathRef.current.getTotalLength();
        
        // Initialize path
        gsap.set(pathRef.current, {
            strokeDasharray: pathLength,
            strokeDashoffset: pathLength
        });

        // Combined Scroll Animation
        // Moves plane along the curve and reveals the path line
        const scrollTl = gsap.timeline({
            scrollTrigger: {
                trigger: "#features",
                start: "top 80%", // Starts sooner when section enters view
                end: "bottom 20%", // Finishes before section fully exits
                scrub: 1, // Slightly snappier
                invalidateOnRefresh: true,
            }
        });

        // Animate the trail line
        scrollTl.to(pathRef.current, {
            strokeDashoffset: 0,
            ease: "none"
        }, 0);

        // Animate the plane along the path
        // Using a custom modifier for position based on length
        scrollTl.to(planeRef.current, {
            ease: "none",
            onUpdate: function() {
                const progress = this.progress();
                const point = pathRef.current!.getPointAtLength(progress * pathLength);
                const nextPoint = pathRef.current!.getPointAtLength(Math.min(progress * pathLength + 1, pathLength));
                
                // Calculate rotation to face the path
                const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * (180 / Math.PI);
                
                gsap.set(planeRef.current, {
                    x: point.x,
                    y: point.y,
                    rotation: angle + 45, // Offset to align paper plane SVG
                    xPercent: -50,
                    yPercent: -50
                });
            }
        }, 0);

        return () => {
            ScrollTrigger.getAll().forEach(t => t.kill());
        };
    }, []);

    return (
        <div ref={containerRef} className="absolute top-0 right-0 w-[400px] h-[400px] z-20 pointer-events-none hidden lg:block overflow-visible">
            <svg viewBox="0 0 400 400" className="absolute top-0 right-0 w-full h-full overflow-visible opacity-60">
                {/* A 4cm-ish irregular circular path (approx radius 150 units in 400x400) */}
                <path 
                    ref={pathRef}
                    id="motionPath"
                    d="M 200, 40 C 370, 60 340, 360 210, 340 C 60, 350 40, 70 200, 40" 
                    fill="none" 
                    stroke="url(#trailGradient)" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_15px_rgba(236,72,153,0.4)]"
                />
                <defs>
                    <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#EC4899" stopOpacity="0" />
                        <stop offset="20%" stopColor="#EC4899" />
                        <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                </defs>
            </svg>

            <div ref={planeRef} className="absolute w-16 h-16 flex items-center justify-center will-change-transform">
                {/* Paper Plane SVG - Scaled for the 4cm orbit */}
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_20px_rgba(236,72,153,0.6)]">
                    <path 
                        d="M10 50L90 20L70 80L55 55L10 50Z" 
                        fill="url(#planeGradientHighlight)" 
                        stroke="white" 
                        strokeWidth="0.5"
                        strokeOpacity="0.5"
                    />
                    <path 
                        d="M90 20L55 55L70 80L90 20Z" 
                        fill="black" 
                        fillOpacity="0.2" 
                    />
                    <defs>
                        <linearGradient id="planeGradientHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#EC4899" />
                            <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
        </div>
    );
};

export default ScrollPlane;
