import { useEffect, useRef } from 'react';

interface InteractiveDottedGridProps {
    dotColor?: string;
    dotSize?: number;
    spacing?: number;
    interactionRadius?: number;
}

export default function InteractiveDottedGrid({
    dotColor = 'rgba(59, 130, 246, 0.4)', // Blue color similar to reference
    dotSize = 2,
    spacing = 30,
    interactionRadius = 150,
}: InteractiveDottedGridProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const animationFrameRef = useRef<number | undefined>(undefined);
    const timeRef = useRef(0);
    const dotsRef = useRef<Array<{ x: number; y: number; baseX: number; baseY: number }>>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            generateGridDots();
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Generate dots in a grid pattern
        const generateGridDots = () => {
            const dots: Array<{ x: number; y: number; baseX: number; baseY: number }> = [];

            for (let x = 0; x < canvas.width + spacing; x += spacing) {
                for (let y = 0; y < canvas.height + spacing; y += spacing) {
                    dots.push({
                        x,
                        y,
                        baseX: x,
                        baseY: y
                    });
                }
            }

            dotsRef.current = dots;
        };

        generateGridDots();

        // Mouse move handler
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);

        // Animation loop
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            timeRef.current += 0.01;

            // Render each dot
            dotsRef.current.forEach((dot, i) => {
                // Calculate distance from mouse
                const dx = mouseRef.current.x - dot.baseX;
                const dy = mouseRef.current.y - dot.baseY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Mouse interaction - dots move away from cursor
                let offsetX = 0;
                let offsetY = 0;
                let scale = 1;
                let opacity = 0.4;

                if (distance < interactionRadius) {
                    const force = (interactionRadius - distance) / interactionRadius;
                    const angle = Math.atan2(dy, dx);
                    offsetX = -Math.cos(angle) * force * 20;
                    offsetY = -Math.sin(angle) * force * 20;
                    scale = 1 + force * 0.5;
                    opacity = 0.4 + force * 0.4;
                }

                // Subtle floating animation
                const floatX = Math.sin(timeRef.current + i * 0.1) * 0.5;
                const floatY = Math.cos(timeRef.current + i * 0.15) * 0.5;

                // Final position
                dot.x = dot.baseX + offsetX + floatX;
                dot.y = dot.baseY + offsetY + floatY;

                // Draw dot
                ctx.beginPath();
                ctx.arc(dot.x, dot.y, dotSize * scale, 0, Math.PI * 2);

                const finalColor = dotColor.includes('rgba')
                    ? dotColor.replace(/[\d.]+\)$/, `${opacity})`)
                    : `rgba(59, 130, 246, ${opacity})`;
                ctx.fillStyle = finalColor;
                ctx.fill();
            });

            animationFrameRef.current = requestAnimationFrame(draw);
        };

        draw();

        // Cleanup
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [dotColor, dotSize, spacing, interactionRadius]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0 pointer-events-none"
            style={{ background: 'transparent' }}
        />
    );
}
