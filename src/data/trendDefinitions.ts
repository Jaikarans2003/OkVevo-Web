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
            // Prompt 1
            `Generate A Person From Photo 1.\nThe Location Is Very High In The Sky At A Slightly Pinkish Sunset. A Man Is In A Horizontal Position With A Falling Effect. The Man’s Face Is Calm, He Is Falling Backwards. The Frame Is At Human Eye Level, And We See The Full Body. Movie Shot, Slightly Blurred Background, Beautiful Color Correction. (The Falling Person/Object)`,

            // Prompt 2
            `Generate a similar scene but person is far away, he’s barely visible. Use different sky texture but same sky color`,

            // Prompt 3
            `Generate the same scene but a close up shot of the person’s face`,

            // Prompt 4
            `Generate the same scene but a close up shot of the person’s shoes`,

            // Prompt 5
            `Generate the same scene but a close up shot of the person’s hand accessories`
        ],
        videoPrompts: [
            // Video 1
            {
                prompt: 'A person falling down from sky with natural falling motion. Smooth cinematic camera movement downward.',
                sourceImageIndex: 0,
            },
            // Video 2
            {
                prompt: 'Levitate',
                sourceImageIndex: 1,
            },
            // Video 3
            {
                prompt: 'Levitate',
                sourceImageIndex: 2,
            },
            // Video 4
            {
                prompt: 'Levitate',
                sourceImageIndex: 3,
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
