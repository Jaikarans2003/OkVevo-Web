/**
 * Vision Orchestrator Service
 *
 * Client-side service that sends hero product + scene images
 * to the Gemini-powered Vision Orchestrator API and returns
 * a synthesized NANOBANANA PRO master prompt.
 */

export interface VisionOrchestratorRequest {
    heroImageBase64: string;   // base64 data-URL of the hero product
    sceneImageBase64: string;  // base64 data-URL of the scene / ambience
    userPrompt?: string;       // optional user instructions for placement
}

export interface VisionOrchestratorResponse {
    success: boolean;
    masterPrompt?: string;
    error?: string;
}

/**
 * Convert a File to a base64 data-URL string
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Call the Vision Orchestrator API to analyze two images
 * and generate a composite master prompt.
 */
export const analyzeProductAndScene = async (
    heroFile: File,
    sceneFile: File,
    userPrompt?: string
): Promise<VisionOrchestratorResponse> => {
    try {
        console.log('🔬 Vision Orchestrator: Converting images to base64...');
        const [heroImageBase64, sceneImageBase64] = await Promise.all([
            fileToBase64(heroFile),
            fileToBase64(sceneFile),
        ]);

        console.log('🔬 Vision Orchestrator: Sending to API...');
        const response = await fetch('/api/vision-orchestrator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ heroImageBase64, sceneImageBase64, userPrompt }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Vision Orchestrator request failed');
        }

        console.log('✅ Vision Orchestrator: Master prompt received');
        return data;

    } catch (error) {
        console.error('Vision Orchestrator error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};

/**
 * Call the Vision Orchestrator API in refinement mode.
 * Takes the current composite image URL + user's change request
 * and returns an updated master prompt.
 */
export const refineComposition = async (
    compositeImageUrl: string,
    refinementPrompt: string
): Promise<VisionOrchestratorResponse> => {
    try {
        console.log('🔄 Vision Orchestrator: Sending refinement request to API...');

        // Send the image URL to the server — it handles the fetch to avoid CORS issues
        const response = await fetch('/api/vision-orchestrator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referenceImageUrl: compositeImageUrl, refinementPrompt }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Vision Orchestrator refinement request failed');
        }

        console.log('✅ Vision Orchestrator: Refined master prompt received');
        return data;

    } catch (error) {
        console.error('Vision Orchestrator refinement error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
