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
    /** Optional: Use the user's face reference photo instead of full body photo */
    useFaceReference?: boolean;
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
        image: '/TrendsThumbnails/SkyFall.webp',
        tags: ['Cinematic', 'Viral', 'Dramatic'],
        imagePrompts: [
            // Prompt 1
            `CRITICAL: You MUST preserve the EXACT face, facial features, skin tone, hair style, hair color, and outfit from the reference photo. Do not change or modify ANY aspect of the person's appearance.

Generate the person from the reference photo in this exact scene: The location is very high in the sky at a slightly pinkish sunset. The person is in a horizontal position with a falling effect, falling backwards. The person's face is calm. The frame is at human eye level, and we see the full body. Movie shot, slightly blurred background, beautiful color correction.

IMPORTANT: Keep the person's face, body, clothing, and all physical characteristics EXACTLY as shown in the reference photo. Only change the background and scene composition.`,

            // Prompt 2
            {
                prompt: `Generate a similar scene but person is far away, he's barely visible. Use different sky texture but same sky color`,
                sourceImageIndex: 0
            },
            // Prompt 3
            {
                prompt: `Generate a close-up shot of the person's face in the same sky scene. Keep the exact scene composition, lighting, and atmosphere from the primary reference image (Image 0), but use the facial features, face shape, skin tone, eyes, nose, mouth, and hair style from the face reference image.

IMPORTANT: The face must be IDENTICAL to the face reference image - same facial features, same expression, same skin tone, same hair. Everything else (scene, lighting, composition) must match the primary reference image. Only change the camera framing to focus on the face.`,
                sourceImageIndex: 0,
                useFaceReference: true
            },
            // Prompt 4
            {
                prompt: `CRITICAL: Use the EXACT same person from the reference image. Keep their outfit, clothing, and shoes IDENTICAL. Do not change or hallucinate any details.

Generate a close-up shot of the person's shoes/feet in the same sky scene. The footwear and clothing must look EXACTLY like they do in the reference image. Only change the camera framing to focus on the shoes.`,
                sourceImageIndex: 0
            },
            // Prompt 5
            {
                prompt: `CRITICAL: Use the EXACT same person and Objects from the reference image. Keep their hands, accessories, and clothing IDENTICAL. Do not change or hallucinate any details.

Generate a close-up shot of the person's hands in the same sky scene. The hands and any accessories if Present must look EXACTLY like they do in the reference image. Only change the camera framing to focus on the hands.`,
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
                prompt: 'Levitate gently in place, Slowly. No horizontal movement, no camera movement with No Sudden and Drastic Movements, no zoom. Handheld camera angle. Only vertical floating motion.',
                sourceImageIndex: 2,
                duration: 3,
            },
            // Video 3 (3 seconds)
            {
                prompt: 'Levitate gently in place, Slowly. No horizontal movement, Smooth Handheld camera movement with No Sudden and Drastic Movements, no zoom. Handheld camera angle. Only vertical floating motion.',
                sourceImageIndex: 3,
                duration: 3,
            },
            // Video 4 (3 seconds)
            {
                prompt: 'Levitate gently in place, Slowly. No horizontal movement, no camera movement with No Sudden and Drastic Movements, no zoom. Handheld camera angle. Only vertical floating motion.',
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
