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
    /** Which generated image (0-indexed) to use as start frame */
    sourceImageIndex: number;
    /** Optional: Which generated image (0-indexed) to use as end frame */
    endImageIndex?: number;
    /** Optional: Video duration in seconds (overrides trend default) */
    duration?: 3 | 5 | 10;
}

export interface ImagePromptDef {
    prompt: string;
    /** Optional: Which previously generated image (0-indexed) to use as reference */
    sourceImageIndex?: number;
}

export interface TrendDefinition {
    id: string;
    title: string;
    description: string;
    image: string;
    tags: string[];
    /** Array of image generation prompts */
    imagePrompts: (string | ImagePromptDef)[];
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
            `Generate A Person From Photo 1.\nThe Location Is Very High In The Sky At A Slightly Pinkish Sunset. A Man Is In A Horizontal Position With A Falling Effect. The Man's Face Is Calm, He Is Falling Backwards. The Frame Is At Human Eye Level, And We See The Full Body. Movie Shot, Slightly Blurred Background, Beautiful Color Correction. (The Falling Person/Object)`,

            // Prompt 2
            {
                prompt: `Generate a similar scene but person is far away, he's barely visible. Use different sky texture but same sky color`,
                sourceImageIndex: 0
            },
            // Prompt 3
            {
                prompt: `Generate the same scene but a close up shot of the person's face`,
                sourceImageIndex: 0
            },
            // Prompt 4
            {
                prompt: `Generate the same scene but a close up shot of the person's shoes`,
                sourceImageIndex: 0
            },
            // Prompt 5
            {
                prompt: `Generate the same scene but a close up shot of the person's hand accessories`,
                sourceImageIndex: 0
            }
        ],
        videoPrompts: [
            // Video 1 - Transition from wide shot to full body (5 seconds)
            {
                prompt: 'A person falling down from sky with natural falling motion. Smooth cinematic camera movement downward.',
                sourceImageIndex: 1,
                endImageIndex: 0,
                duration: 5,
            },
            // Video 2 (3 seconds)
            {
                prompt: 'Levitate',
                sourceImageIndex: 2,
                duration: 3,
            },
            // Video 3 (3 seconds)
            {
                prompt: 'Levitate',
                sourceImageIndex: 3,
                duration: 3,
            },
            // Video 4 (3 seconds)
            {
                prompt: 'Levitate',
                sourceImageIndex: 4,
                duration: 3,
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
