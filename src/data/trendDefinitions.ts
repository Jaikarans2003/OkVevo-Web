/**
 * Trend Definitions — Instagram Trends Prompt Flow Data
 *
 * Each trend has ONE image prompt (NanoBanana PRO) and optionally
 * ONE video prompt (Kling 2.5 Turbo).
 */

// ── Types ───────────────────────────────────────────────────────────

export interface TrendDefinition {
    id: string;
    title: string;
    description: string;
    image: string;
    tags: string[];
    type: 'image' | 'video';
    /** The single image generation prompt */
    imagePrompt: string;
    /** Optional video prompt — uses the generated image as source frame */
    videoPrompt?: string;
    videoDuration?: 5 | 10;
}

// ── Trend Definitions ───────────────────────────────────────────────

export const TREND_DEFINITIONS: TrendDefinition[] = [
    {
        id: 'sky-fall',
        title: 'Sky Fall',
        description: 'Cinematic falling-from-the-sky sequence with stunning sunset visuals. A viral Higgsfield-style trend.',
        image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900&auto=format&fit=crop&q=60',
        tags: ['Cinematic', 'Viral', 'Dramatic'],
        type: 'video',
        imagePrompt: 'Generate A Person From the uploaded Photo. The Location Is Very High In The Sky At A Slightly Pinkish Sunset. The person Is In A Horizontal Position With A Falling Effect. The Person\'s Face Is Calm, they are Falling Backwards. The Frame Is At Human Eye Level, And We See The Full Body. Movie Shot, Slightly Blurred Background, Beautiful Color Correction. Photorealistic, cinematic lighting, 8K quality.',
        videoPrompt: 'A person falling down from sky with natural falling motion. Smooth cinematic camera movement downward. Pinkish sunset sky, dramatic lighting, movie quality.',
        videoDuration: 5,
    },
    {
        id: 'neon-portrait',
        title: 'Neon Portrait',
        description: 'Cyberpunk-inspired neon lighting portrait with dramatic color splits.',
        image: 'https://images.unsplash.com/photo-1649937801620-d31db7fb3ab3?w=900&auto=format&fit=crop&q=60',
        tags: ['Cyberpunk', 'Neon', 'Portrait'],
        type: 'video',
        imagePrompt: 'Generate the person from the uploaded photo in a dramatic neon-lit portrait. Split lighting with electric blue on one side and hot pink/magenta on the other. Dark background, cyberpunk atmosphere. The person\'s expression is intense and confident. Studio-quality portrait, sharp focus, beautiful color grading.',
        videoPrompt: 'The neon lights pulse and flicker rhythmically around the person. Subtle head movement, neon reflections dancing on skin. Cyberpunk portrait video, cinematic.',
        videoDuration: 5,
    },
    {
        id: 'underwater-dream',
        title: 'Underwater Dream',
        description: 'Ethereal underwater floating sequence with dramatic light rays.',
        image: 'https://images.unsplash.com/photo-1634942537040-f7ba41298016?w=900&auto=format&fit=crop&q=60',
        tags: ['Ethereal', 'Underwater', 'Dreamy'],
        type: 'video',
        imagePrompt: 'Generate the person from the uploaded photo floating underwater in a dreamy, ethereal scene. Crystal clear blue water, sunlight rays penetrating from above. The person\'s hair and clothes flow gracefully in the water. Calm expression, eyes closed. Cinematic underwater photography, beautiful light caustics.',
        videoPrompt: 'The person floats gently underwater, hair and fabric flowing in slow motion. Sunlight rays shift and dance. Serene, dreamy underwater video, cinematic.',
        videoDuration: 5,
    },
    {
        id: 'golden-hour',
        title: 'Golden Hour',
        description: 'Warm golden sunset portrait with lens flare and bokeh magic.',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&auto=format&fit=crop&q=60',
        tags: ['GoldenHour', 'Warm', 'Portrait'],
        type: 'image',
        imagePrompt: 'Generate the person from the uploaded photo in a stunning golden hour portrait. Warm golden sunlight from the side, beautiful lens flare. The person\'s face is warmly lit, slight smile. Background is a field or open landscape bathed in golden light. Cinematic portrait, warm color grading.',
    },
    {
        id: 'smoke-reveal',
        title: 'Smoke Reveal',
        description: 'Dramatic smoke and fog reveal effect for mysterious, editorial looks.',
        image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900&auto=format&fit=crop&q=60',
        tags: ['Smoke', 'Dramatic', 'Editorial'],
        type: 'video',
        imagePrompt: 'Generate the person from the uploaded photo emerging from thick, dramatic smoke. Dark moody background, single strong light source cutting through the smoke. The person\'s face partially revealed, mysterious and powerful. Cinematic editorial quality, high contrast.',
        videoPrompt: 'Thick smoke slowly parts to reveal the person. Dramatic lighting, slow cinematic reveal. Smoke swirls and dances around the figure. Movie-quality atmosphere.',
        videoDuration: 5,
    },
    {
        id: 'chrome-future',
        title: 'Chrome Future',
        description: 'Futuristic chrome and metallic reflections with sci-fi aesthetics.',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900&auto=format&fit=crop&q=60',
        tags: ['SciFi', 'Chrome', 'Futuristic'],
        type: 'image',
        imagePrompt: 'Generate the person from the uploaded photo with a futuristic chrome/metallic aesthetic. Reflective surfaces surrounding them, sci-fi environment. Sharp, clean lighting. The person looks powerful and futuristic. Cinematic sci-fi portrait, high-end production quality.',
    },
];

/**
 * Get a trend definition by ID
 */
export function getTrendById(id: string): TrendDefinition | undefined {
    return TREND_DEFINITIONS.find(t => t.id === id);
}
