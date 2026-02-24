/**
 * Trend Definitions — Instagram Trends Prompt Flow Data
 *
 * Each trend contains predefined image prompts (NanoBanana PRO) and
 * video prompts (Kling 2.5 Turbo) that automatically execute when a
 * user uploads their photo.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface TrendImagePrompt {
    name: string;
    prompt: string;
    shotType: 'wide' | 'extreme-wide' | 'close-up' | 'detail' | 'full-body';
}

export interface TrendVideoPrompt {
    name: string;
    prompt: string;
    duration: 5 | 10;
    /** Index of the image prompt whose output is used as the source frame */
    sourceImageIndex: number;
}

export interface TrendDefinition {
    id: string;
    title: string;
    description: string;
    image: string;
    tags: string[];
    type: 'image' | 'video';
    imagePrompts: TrendImagePrompt[];
    videoPrompts: TrendVideoPrompt[];
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
        imagePrompts: [
            {
                name: 'Full Body Fall',
                prompt: 'Generate A Person From the uploaded Photo. The Location Is Very High In The Sky At A Slightly Pinkish Sunset. The person Is In A Horizontal Position With A Falling Effect. The Person\'s Face Is Calm, they are Falling Backwards. The Frame Is At Human Eye Level, And We See The Full Body. Movie Shot, Slightly Blurred Background, Beautiful Color Correction. Photorealistic, cinematic lighting, 8K quality.',
                shotType: 'full-body',
            },
            {
                name: 'Far Away Shot',
                prompt: 'Generate a similar scene of the person from the uploaded photo but the person is far away, barely visible in the frame. Use a different sky texture but maintain the same pinkish sunset color palette. The person is a tiny silhouette falling through the vast sky. Cinematic wide shot, beautiful atmospheric perspective, movie quality color grading.',
                shotType: 'extreme-wide',
            },
            {
                name: 'Face Close-Up',
                prompt: 'Generate the same falling-from-sky scene but a close up shot of the person\'s face from the uploaded photo. Pinkish sunset light illuminating their calm expression. Wind blowing through their hair. Shallow depth of field, the sky bokeh in the background. Cinematic portrait, movie quality, beautiful color correction.',
                shotType: 'close-up',
            },
            {
                name: 'Shoes Detail',
                prompt: 'Generate the same falling-from-sky scene but a close up shot of the person\'s shoes/feet. Pinkish sunset sky visible behind. The shoes are detailed and sharp, the background sky is beautifully blurred. Cinematic detail shot, movie quality, dramatic lighting from the sunset.',
                shotType: 'detail',
            },
            {
                name: 'Hand Accessories',
                prompt: 'Generate the same falling-from-sky scene but a close up shot of the person\'s hand and accessories (watch, rings, bracelet). Pinkish sunset light catching the metallic surfaces. Wind effect visible. Cinematic macro-style shot, shallow depth of field, beautiful color correction.',
                shotType: 'detail',
            },
        ],
        videoPrompts: [
            {
                name: 'Falling Motion',
                prompt: 'A person falling down from sky with natural falling motion. Smooth cinematic camera movement downward. Pinkish sunset sky, dramatic lighting, movie quality.',
                duration: 5,
                sourceImageIndex: 0,
            },
            {
                name: 'Levitate Wide',
                prompt: 'The person levitates and slowly rotates in the pinkish sunset sky. Gentle floating motion, hair and clothes moving with wind. Cinematic wide shot, dreamy atmosphere.',
                duration: 5,
                sourceImageIndex: 1,
            },
            {
                name: 'Face Levitate',
                prompt: 'Close up of the person\'s calm face as they levitate. Subtle movement, eyes gently closing and opening. Pinkish sunset light on skin. Cinematic portrait video, shallow depth of field.',
                duration: 5,
                sourceImageIndex: 2,
            },
            {
                name: 'Levitate Full',
                prompt: 'The person levitates with arms slightly spread, rotating slowly in the sunset sky. Full body visible, dramatic pinkish lighting, cinematic camera slowly orbiting.',
                duration: 5,
                sourceImageIndex: 0,
            },
        ],
    },
    {
        id: 'neon-portrait',
        title: 'Neon Portrait',
        description: 'Cyberpunk-inspired neon lighting portrait series with dramatic color splits.',
        image: 'https://images.unsplash.com/photo-1649937801620-d31db7fb3ab3?w=900&auto=format&fit=crop&q=60',
        tags: ['Cyberpunk', 'Neon', 'Portrait'],
        type: 'video',
        imagePrompts: [
            {
                name: 'Neon Split',
                prompt: 'Generate the person from the uploaded photo in a dramatic neon-lit portrait. Split lighting with electric blue on one side and hot pink/magenta on the other. Dark background, cyberpunk atmosphere. The person\'s expression is intense and confident. Studio-quality portrait, sharp focus, beautiful color grading.',
                shotType: 'close-up',
            },
            {
                name: 'Full Neon Body',
                prompt: 'Generate the person from the uploaded photo standing in a dark cyberpunk alley lit by neon signs. Blue and pink neon reflections on wet ground. Full body shot, the person looks powerful and stylish. Cinematic, moody atmosphere, rain-slicked streets.',
                shotType: 'full-body',
            },
            {
                name: 'Neon Close-Up Eyes',
                prompt: 'Extreme close-up of the person\'s eyes from the uploaded photo with neon light reflections visible in the irises. Split neon lighting, blue and pink. Dramatic macro portrait, incredible detail, cyberpunk aesthetic.',
                shotType: 'close-up',
            },
            {
                name: 'Silhouette Neon',
                prompt: 'Generate a dramatic silhouette of the person from the uploaded photo against a massive neon sign. The person is a dark figure with neon edge lighting outlining their form. Cyberpunk city background, cinematic composition.',
                shotType: 'wide',
            },
            {
                name: 'Neon Hands',
                prompt: 'Close-up of the person\'s hands reaching toward camera with neon light trails flowing between fingers. Blue and pink neon energy, dark background, cyberpunk magical realism. Cinematic detail shot.',
                shotType: 'detail',
            },
        ],
        videoPrompts: [
            {
                name: 'Neon Pulse',
                prompt: 'The neon lights pulse and flicker rhythmically around the person. Subtle head movement, neon reflections dancing on skin. Cyberpunk portrait video, cinematic.',
                duration: 5,
                sourceImageIndex: 0,
            },
            {
                name: 'Neon Walk',
                prompt: 'The person walks slowly through the neon-lit alley. Camera follows smoothly. Neon reflections on wet ground, rain particles visible. Cinematic cyberpunk atmosphere.',
                duration: 5,
                sourceImageIndex: 1,
            },
        ],
    },
    {
        id: 'underwater-dream',
        title: 'Underwater Dream',
        description: 'Ethereal underwater floating sequences with dramatic light rays.',
        image: 'https://images.unsplash.com/photo-1634942537040-f7ba41298016?w=900&auto=format&fit=crop&q=60',
        tags: ['Ethereal', 'Underwater', 'Dreamy'],
        type: 'video',
        imagePrompts: [
            {
                name: 'Submerged Float',
                prompt: 'Generate the person from the uploaded photo floating underwater in a dreamy, ethereal scene. Crystal clear blue water, sunlight rays penetrating from above. The person\'s hair and clothes flow gracefully in the water. Calm expression, eyes closed. Cinematic underwater photography, beautiful light caustics.',
                shotType: 'full-body',
            },
            {
                name: 'Deep Blue Distance',
                prompt: 'Generate the person from the uploaded photo floating deep underwater, seen from far away. The person is a small figure surrounded by vast deep blue ocean. Light rays streaming from above. Atmospheric perspective, cinematic wide shot, ethereal mood.',
                shotType: 'extreme-wide',
            },
            {
                name: 'Underwater Face',
                prompt: 'Close-up of the person\'s face from the uploaded photo underwater. Air bubbles rising from their lips, hair flowing upward. Dappled sunlight on their serene face. Cinematic underwater portrait, stunning clarity.',
                shotType: 'close-up',
            },
            {
                name: 'Reaching Up',
                prompt: 'The person from the uploaded photo reaching one hand up toward the water surface above. Light rays surrounding their hand, underwater depth below. Dramatic composition, ethereal and hopeful mood. Cinematic quality.',
                shotType: 'wide',
            },
            {
                name: 'Flowing Fabric',
                prompt: 'Close-up detail shot of the person\'s flowing clothing underwater, fabric rippling in slow motion. Beautiful light caustics playing on the white/light fabric. Abstract, artistic, cinematic.',
                shotType: 'detail',
            },
        ],
        videoPrompts: [
            {
                name: 'Float Motion',
                prompt: 'The person floats gently underwater, hair and fabric flowing in slow motion. Sunlight rays shift and dance. Serene, dreamy underwater video, cinematic.',
                duration: 5,
                sourceImageIndex: 0,
            },
            {
                name: 'Bubble Rise',
                prompt: 'Close-up of the person\'s face underwater as bubbles slowly rise. Hair gently flowing, peaceful expression. Ethereal underwater portrait video.',
                duration: 5,
                sourceImageIndex: 2,
            },
        ],
    },
    {
        id: 'golden-hour',
        title: 'Golden Hour',
        description: 'Warm golden sunset portraits with lens flare and bokeh magic.',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=900&auto=format&fit=crop&q=60',
        tags: ['GoldenHour', 'Warm', 'Portrait'],
        type: 'image',
        imagePrompts: [
            {
                name: 'Golden Portrait',
                prompt: 'Generate the person from the uploaded photo in a stunning golden hour portrait. Warm golden sunlight from the side, beautiful lens flare. The person\'s face is warmly lit, slight smile. Background is a field or open landscape bathed in golden light. Cinematic portrait, warm color grading.',
                shotType: 'close-up',
            },
            {
                name: 'Silhouette Gold',
                prompt: 'Generate the person from the uploaded photo as a dramatic silhouette against a golden sunset. Sun directly behind them creating a powerful rim light and golden halo. Wide shot, dramatic sky, cinematic composition.',
                shotType: 'wide',
            },
            {
                name: 'Golden Detail',
                prompt: 'Close-up of sunlight catching the person\'s hair from the uploaded photo, creating a glowing golden halo effect. Shallow depth of field, warm bokeh in background. Intimate, warm, cinematic detail shot.',
                shotType: 'detail',
            },
            {
                name: 'Walking Into Light',
                prompt: 'Generate the person from the uploaded photo walking toward the golden sunset, full body visible. Long shadows stretching behind them. Fields of grass glowing golden. Cinematic wide shot, aspirational mood.',
                shotType: 'full-body',
            },
            {
                name: 'Golden Hands',
                prompt: 'The person\'s hands from the uploaded photo reaching up toward the golden sun. Sunlight streaming between fingers, warm golden glow. Dramatic backlit detail shot, cinematic quality.',
                shotType: 'detail',
            },
        ],
        videoPrompts: [],
    },
    {
        id: 'smoke-reveal',
        title: 'Smoke Reveal',
        description: 'Dramatic smoke and fog reveal effects for mysterious, editorial looks.',
        image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=900&auto=format&fit=crop&q=60',
        tags: ['Smoke', 'Dramatic', 'Editorial'],
        type: 'video',
        imagePrompts: [
            {
                name: 'Smoke Emerge',
                prompt: 'Generate the person from the uploaded photo emerging from thick, dramatic smoke. Dark moody background, single strong light source cutting through the smoke. The person\'s face partially revealed, mysterious and powerful. Cinematic editorial quality, high contrast.',
                shotType: 'full-body',
            },
            {
                name: 'Smoke Portrait',
                prompt: 'Close-up portrait of the person from the uploaded photo with wisps of smoke curling around their face. Dramatic side lighting, dark background. Intense expression. High-fashion editorial style, moody color grading.',
                shotType: 'close-up',
            },
            {
                name: 'Smoke Wide',
                prompt: 'The person from the uploaded photo standing in a vast space filled with dramatic smoke/fog. Volumetric light beams cutting through. Silhouette with rim lighting. Cinematic wide shot, movie-quality atmosphere.',
                shotType: 'wide',
            },
            {
                name: 'Smoke Hands',
                prompt: 'Close-up of the person\'s hands from the uploaded photo with smoke flowing through and around their fingers. Dramatic lighting from above, dark background. Artistic, mysterious, cinematic detail.',
                shotType: 'detail',
            },
            {
                name: 'Smoke Eyes',
                prompt: 'Extreme close-up of the person\'s eyes from the uploaded photo with smoke drifting across the frame. Dramatic lighting reflection in the eyes. Mysterious, intense, cinematic macro shot.',
                shotType: 'close-up',
            },
        ],
        videoPrompts: [
            {
                name: 'Smoke Reveal',
                prompt: 'Thick smoke slowly parts to reveal the person. Dramatic lighting, slow cinematic reveal. Smoke swirls and dances around the figure. Movie-quality atmosphere.',
                duration: 5,
                sourceImageIndex: 0,
            },
            {
                name: 'Smoke Drift',
                prompt: 'Close-up of the person\'s face as smoke drifts slowly across frame. Subtle expression change, dramatic lighting. Editorial video, high contrast.',
                duration: 5,
                sourceImageIndex: 1,
            },
        ],
    },
    {
        id: 'chrome-future',
        title: 'Chrome Future',
        description: 'Futuristic chrome and metallic reflections with sci-fi aesthetics.',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900&auto=format&fit=crop&q=60',
        tags: ['SciFi', 'Chrome', 'Futuristic'],
        type: 'image',
        imagePrompts: [
            {
                name: 'Chrome Portrait',
                prompt: 'Generate the person from the uploaded photo with a futuristic chrome/metallic aesthetic. Reflective surfaces surrounding them, sci-fi environment. Sharp, clean lighting. The person looks powerful and futuristic. Cinematic sci-fi portrait, high-end production quality.',
                shotType: 'close-up',
            },
            {
                name: 'Chrome Full Body',
                prompt: 'Generate the person from the uploaded photo standing in a sleek, futuristic chrome environment. Reflective floors, geometric metallic structures. Full body shot, dramatic perspective. Sci-fi movie quality, clean and premium aesthetic.',
                shotType: 'full-body',
            },
            {
                name: 'Chrome Reflection',
                prompt: 'The person\'s face from the uploaded photo reflected in a curved chrome surface, creating a distorted artistic reflection. Multiple reflections visible. Sci-fi aesthetic, abstract, cinematic.',
                shotType: 'close-up',
            },
            {
                name: 'Chrome Hands',
                prompt: 'Close-up of the person\'s hands from the uploaded photo touching a chrome/metallic holographic surface. Light refracting through, futuristic UI elements. Sci-fi detail shot, premium quality.',
                shotType: 'detail',
            },
            {
                name: 'Chrome Wide',
                prompt: 'Wide shot of the person from the uploaded photo in a massive futuristic chrome hall. Reflections everywhere, geometric architecture. The person is a focal point in the vast metallic space. Cinematic sci-fi wide shot.',
                shotType: 'wide',
            },
        ],
        videoPrompts: [],
    },
];

/**
 * Get a trend definition by ID
 */
export function getTrendById(id: string): TrendDefinition | undefined {
    return TREND_DEFINITIONS.find(t => t.id === id);
}
