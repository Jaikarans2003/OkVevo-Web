/**
 * Trend Definitions — Skyfall Multi-Prompt Pipeline
 *
 * Single trend with 5 image prompts and 4 video prompts.
 * Images generated via NanoBanana Pro, videos via Kling (AIML API).
 * All videos stitched into one final output.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface VideoPromptDef {
    prompt: string;
    /** Which generated image (0-indexed) to use as source frame */
    sourceImageIndex: number;
}

export interface TrendDefinition {
    id: string;
    title: string;
    description: string;
    image: string;
    tags: string[];
    /** Array of image generation prompts */
    imagePrompts: string[];
    /** Array of video prompts, each referencing a source image */
    videoPrompts: VideoPromptDef[];
    videoDuration?: 5 | 10;
}

// ── Skyfall Trend ───────────────────────────────────────────────────

export const TREND_DEFINITIONS: TrendDefinition[] = [
    {
        id: 'sky-fall',
        title: 'Sky Fall',
        description: 'Cinematic falling-from-the-sky sequence — 5 stunning shots stitched into one epic video.',
        image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900&auto=format&fit=crop&q=60',
        tags: ['Cinematic', 'Viral', 'Dramatic'],
        imagePrompts: [
            // Prompt 1: Wide Shot
            `Generate A Person From the uploaded Photo. The Location Is Very High In The Sky At A Slightly Pinkish Sunset. A Man Is In A Horizontal Position With A Falling Effect. The Frame Is A Wide Shot, Person is Far Away, We See The Full Body and the expansive sky. Movie Shot, Beautiful Color Correction.`,

            // Prompt 2: Close up 1
            `Using the provided reference image of the falling person, generate a tight Close-Up Shot of the person's face. The lighting, sky, and clothing must perfectly match the reference.`,

            // Prompt 3: Close up 2
            `Using the provided reference image of the falling person, generate a tight Close-Up Shot of the person's shoes or hands. The lighting, sky, and clothing must perfectly match the reference.`,
        ],
        videoPrompts: [
            // Video 1: Start Frame Wide Shot -> Medium Shot
            {
                prompt: 'Camera starts with a Wide Shot where the person is far away, and smoothly zooms in to end in a Medium Shot of the falling person.',
                sourceImageIndex: 0,
            },
            // Video 2: Levitating CloseUp
            {
                prompt: 'Levitating Close-Up Shot of the person.',
                sourceImageIndex: 1,
            },
            // Video 3: Levitating CloseUp
            {
                prompt: 'Levitating Close-Up Shot of the person.',
                sourceImageIndex: 2,
            },
        ],
        videoDuration: 5,
    },
];

/**
 * Get a trend definition by ID
 */
export function getTrendById(id: string): TrendDefinition | undefined {
    return TREND_DEFINITIONS.find(t => t.id === id);
}
