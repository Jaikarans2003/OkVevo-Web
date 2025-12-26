export interface ModelConfig {
    id: string;
    name: string;
    description: string;
    version?: string;
    endpoint: string;
    payloadBuilder: (
        prompt: string,
        options: { version?: string; guidanceScale: number; enhancePrompt: boolean; duration?: number; aspectRatio?: string }
    ) => { version?: string; input: Record<string, string | number | boolean> };
    defaultGuidance: number;
}

export const MODELS: Record<string, ModelConfig> = {
    'tunetales': {
        id: 'tunetales',
        name: 'TuneTales Generative Model',
        description: 'TuneTales proprietary video generation',
        // LTX-2-Fast Version hash
        version: '36fffd7d35beddbe99e93b52e1a620a4f4ab739d7372e1eac9f040dd3c372b2c',
        endpoint: '/api/replicate/predictions',
        defaultGuidance: 3.0,
        payloadBuilder: (prompt: string, { guidanceScale }: { guidanceScale: number }) => ({
            version: '36fffd7d35beddbe99e93b52e1a620a4f4ab739d7372e1eac9f040dd3c372b2c',
            input: {
                prompt,
                resolution: '1080p',
                duration: 20, // Forced 20s per scene
                generate_audio: true,
                guidance_scale: guidanceScale
            }
        })
    }
};
