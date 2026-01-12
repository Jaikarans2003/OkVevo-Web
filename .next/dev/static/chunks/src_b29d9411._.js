(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/config/models.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MODELS",
    ()=>MODELS
]);
const MODELS = {
    'tunetales': {
        id: 'tunetales',
        name: 'TuneTales Generative Model',
        description: 'TuneTales proprietary video generation',
        // LTX-2-Fast Version hash
        version: '36fffd7d35beddbe99e93b52e1a620a4f4ab739d7372e1eac9f040dd3c372b2c',
        endpoint: '/api/replicate/predictions',
        defaultGuidance: 3.0,
        payloadBuilder: (prompt, { guidanceScale })=>({
                version: '36fffd7d35beddbe99e93b52e1a620a4f4ab739d7372e1eac9f040dd3c372b2c',
                input: {
                    prompt,
                    resolution: '1080p',
                    duration: 20,
                    generate_audio: true,
                    guidance_scale: guidanceScale
                }
            })
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/services/AIService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "analyzeScenes",
    ()=>analyzeScenes,
    "enhanceStory",
    ()=>enhanceStory,
    "generateGreeting",
    ()=>generateGreeting
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$google$2f$generative$2d$ai$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@google/generative-ai/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$groq$2d$sdk$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/groq-sdk/index.mjs [app-client] (ecmascript) <locals>");
const __TURBOPACK__import$2e$meta__ = {
    get url () {
        return `file://${__turbopack_context__.P("src/services/AIService.ts")}`;
    }
};
;
;
// Retry logic with exponential backoff
const sleep = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
const callWithRetry = async (fn, maxRetries = 3, baseDelay = 1000)=>{
    let lastError;
    for(let attempt = 0; attempt < maxRetries; attempt++){
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            // Check if it's a rate limit error
            if (lastError.message.includes('429') || lastError.message.includes('rate limit')) {
                const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
                console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
                continue;
            }
            // If it's not a rate limit error, throw immediately
            throw lastError;
        }
    }
    throw lastError;
};
const tryGeminiWithFallback = async (fullPrompt)=>{
    const apiKeys = [
        __TURBOPACK__import$2e$meta__.env.VITE_GEMINI_API_KEY,
        __TURBOPACK__import$2e$meta__.env.VITE_GOOGLE_API_KEY
    ].filter(Boolean);
    let lastError;
    for (const apiKey of apiKeys){
        try {
            console.log(`Trying Gemini API with key: ${apiKey.substring(0, 10)}...`);
            const genAI = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$google$2f$generative$2d$ai$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GoogleGenerativeAI"](apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.5
                }
            });
            const prompt = `You are an elite film director following the LTX-2 Prompting Guide. Deconstruct the following enhanced story into exactly THREE self-contained cinematic scenes (20s each) for a 60s video.

Input Story: "${fullPrompt}"

For each scene, provide a detailed, in-depth description as if it were a standalone prompt for the LTX AI model.

Requirements:
1.  **Self-Contained Scenes:** Each scene's "primary_visuals" MUST be a complete, standalone prompt. For Scene 2 and 3, explicitly repeat all necessary character, setting, and mood context from the previous scene(s) to ensure consistency, as the LTX model has no memory of other scenes. Make the prompts bigger and more descriptive.
2.  **LTX-2 Guide Adherence:** Each "primary_visuals" prompt must follow the LTX-2 guide, including Shot Establishment, Scene Description, Action, Character Details, Camera Movement, and Audio.
3.  **Valid JSON Output:** The final output MUST be a single, valid JSON object. No markdown or commentary.
4.  **Structure:** An array of 3 objects under the key "scenes".
5.  **Scene Object:** Each object must have "scene", "scene_objective", "primary_visuals", "emotional_tone", and "transition_logic".

Example Output format:
{
  "scenes": [
    {
      "scene": "Scene 1 (0-20s)",
      "scene_objective": "Establish the setting and introduce the character.",
      "primary_visuals": "A wide establishing shot reveals a rain-slicked, neon-lit city street at midnight. The camera slowly pushes in on a lone figure, a man in his 30s wearing a worn trench coat, huddled under an awning. His face is obscured by shadow, but his tense posture suggests anxiety. The sound of distant sirens and falling rain fills the air.",
      "emotional_tone": "Mysterious, tense",
      "transition_logic": "A quick cut to the next scene."
    },
    {
      "scene": "Scene 2 (20-40s)",
      "scene_objective": "Introduce the conflict, maintaining the established mood.",
      "primary_visuals": "The scene is a rain-slicked, neon-lit city street at midnight. The camera is now at eye-level with the man from the previous scene (30s, worn trench coat). He glances nervously down a dark alley. The neon light casts a red glow on his face, revealing a fresh scar on his cheek. He pulls his collar tighter, his breath misting in the cold air. A sudden noise from the alley makes him flinch. The sound of rain continues.",
      "emotional_tone": "Heightened tension, fear",
      "transition_logic": "Slow dolly towards the alley entrance."
    },
    {
      "scene": "Scene 3 (40-60s)",
      "scene_objective": "Resolve the immediate conflict.",
      "primary_visuals": "Continuing on the rain-slicked, neon-lit street, the camera follows the man (30s, trench coat, scar on cheek) as he cautiously enters the dark alley. The alley is narrow and filled with overflowing trash cans. The only light comes from the street behind him, casting long, distorted shadows. He takes a tentative step forward, his hand reaching inside his coat. The sound is muffled, dominated by the dripping rain and his own heavy breathing.",
      "emotional_tone": "Confrontation, suspense",
      "transition_logic": "Fade to black."
    }
  ]
}`;
            const result = await callWithRetry(()=>model.generateContent(prompt));
            const response = await result.response;
            const content = response.text();
            if (!content) throw new Error("No content received from Gemini");
            console.log("Gemini Response:", content);
            const parsed = JSON.parse(content);
            if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length !== 3) {
                throw new Error("Invalid scene structure received");
            }
            return parsed.scenes;
        } catch (error) {
            lastError = error;
            console.error(`Failed with key ${apiKey.substring(0, 10)}...:`, lastError.message);
            continue;
        }
    }
    throw lastError;
};
const fallbackToGroq = async (fullPrompt)=>{
    try {
        console.log('Falling back to Groq API...');
        const groq = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$groq$2d$sdk$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"]({
            apiKey: __TURBOPACK__import$2e$meta__.env.VITE_GROQ_API_KEY,
            dangerouslyAllowBrowser: true
        });
        const prompt = `You are an elite film director following the LTX-2 Prompting Guide. Deconstruct the following enhanced story into exactly THREE self-contained cinematic scenes (20s each) for a 60s video.

Input Story: "${fullPrompt}"

For each scene, provide a detailed, in-depth description as if it were a standalone prompt for the LTX AI model.

Requirements:
1.  **Self-Contained Scenes:** Each scene's "primary_visuals" MUST be a complete, standalone prompt. For Scene 2 and 3, explicitly repeat all necessary character, setting, and mood context from the previous scene(s) to ensure consistency, as the LTX model has no memory of other scenes. Make the prompts bigger and more descriptive.
2.  **LTX-2 Guide Adherence:** Each "primary_visuals" prompt must follow the LTX-2 guide, including Shot Establishment, Scene Description, Action, Character Details, Camera Movement, and Audio.
3.  **Valid JSON Output:** The final output MUST be a single, valid JSON object. No markdown or commentary.
4.  **Structure:** An array of 3 objects under the key "scenes".
5.  **Scene Object:** Each object must have "scene", "scene_objective", "primary_visuals", "emotional_tone", and "transition_logic".

Example Output format:
{
  "scenes": [
    {
      "scene": "Scene 1 (0-20s)",
      "scene_objective": "Establish the setting and introduce the character.",
      "primary_visuals": "A wide establishing shot reveals a rain-slicked, neon-lit city street at midnight. The camera slowly pushes in on a lone figure, a man in his 30s wearing a worn trench coat, huddled under an awning. His face is obscured by shadow, but his tense posture suggests anxiety. The sound of distant sirens and falling rain fills the air.",
      "emotional_tone": "Mysterious, tense",
      "transition_logic": "A quick cut to the next scene."
    },
    {
      "scene": "Scene 2 (20-40s)",
      "scene_objective": "Introduce the conflict, maintaining the established mood.",
      "primary_visuals": "The scene is a rain-slicked, neon-lit city street at midnight. The camera is now at eye-level with the man from the previous scene (30s, worn trench coat). He glances nervously down a dark alley. The neon light casts a red glow on his face, revealing a fresh scar on his cheek. He pulls his collar tighter, his breath misting in the cold air. A sudden noise from the alley makes him flinch. The sound of rain continues.",
      "emotional_tone": "Heightened tension, fear",
      "transition_logic": "Slow dolly towards the alley entrance."
    },
    {
      "scene": "Scene 3 (40-60s)",
      "scene_objective": "Resolve the immediate conflict.",
      "primary_visuals": "Continuing on the rain-slicked, neon-lit street, the camera follows the man (30s, trench coat, scar on cheek) as he cautiously enters the dark alley. The alley is narrow and filled with overflowing trash cans. The only light comes from the street behind him, casting long, distorted shadows. He takes a tentative step forward, his hand reaching inside his coat. The sound is muffled, dominated by the dripping rain and his own heavy breathing.",
      "emotional_tone": "Confrontation, suspense",
      "transition_logic": "Fade to black."
    }
  ]
}`;
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
            max_tokens: 2000,
            response_format: {
                type: "json_object"
            }
        });
        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No content received from Groq");
        console.log("Groq Response:", content);
        const parsed = JSON.parse(content);
        if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length !== 3) {
            throw new Error("Invalid scene structure received from Groq");
        }
        return parsed.scenes;
    } catch (error) {
        console.error('Groq fallback failed:', error);
        throw error;
    }
};
const generateGreeting = async ()=>{
    return "Welcome to TuneTalez! Share your story, and I'll help bring it to life.";
};
const enhanceStory = async (userStory)=>{
    try {
        const apiKey = __TURBOPACK__import$2e$meta__.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing VITE_GEMINI_API_KEY in .env file");
        const genAI = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$google$2f$generative$2d$ai$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GoogleGenerativeAI"](apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.6
            }
        });
        const prompt = `You are a creative storytelling assistant following the LTX-2 Prompting Guide. Analyze this user story and enhance it for cinematic video generation:

User Story: "${userStory}"

Enhance the story by structuring it as a single, flowing paragraph in the present tense. Incorporate these key elements from the guide:
1.  **Establish the Shot:** Use cinematography terms (e.g., wide establishing shot, close-up).
2.  **Set the Scene:** Describe lighting, color palette, textures, and atmosphere.
3.  **Describe the Action:** Detail the core action in a clear sequence.
4.  **Define the Character(s):** Include visual details like age, clothing, and physical cues for emotion.
5.  **Identify Camera Movement(s):** Specify pans, tracks, tilts, etc.
6.  **Describe the Audio:** Include ambient sounds, music, and dialogue in quotation marks.

Return JSON with:
{
  "originalStory": "the user's original story",
  "enhancedPrompt": "your enhanced, LTX-2-optimized prompt as a single paragraph.",
  "keyVisuals": ["visual element 1", "visual element 2", "visual element 3"],
  "moodSuggestions": ["mood 1", "mood 2", "mood 3"],
  "cinematicElements": ["cinematic technique 1", "cinematic technique 2"]
}

Ensure the enhanced prompt is vivid, detailed, and ready for the LTX-2 model, while keeping the core story intact.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();
        if (!content) throw new Error("No content received from Gemini");
        const parsed = JSON.parse(content);
        return {
            originalStory: userStory,
            enhancedPrompt: parsed.enhancedPrompt || userStory,
            keyVisuals: parsed.keyVisuals || [],
            moodSuggestions: parsed.moodSuggestions || [],
            cinematicElements: parsed.cinematicElements || []
        };
    } catch (error) {
        console.error('Story enhancement failed:', error);
        return {
            originalStory: userStory,
            enhancedPrompt: userStory,
            keyVisuals: [],
            moodSuggestions: [],
            cinematicElements: []
        };
    }
};
const analyzeScenes = async (fullPrompt)=>{
    try {
        // Try Gemini first with multiple keys and retry logic
        return await tryGeminiWithFallback(fullPrompt);
    } catch (geminiError) {
        console.error('All Gemini attempts failed:', geminiError);
        // Fallback to Groq
        try {
            return await fallbackToGroq(fullPrompt);
        } catch (groqError) {
            console.error('Groq fallback also failed:', groqError);
            throw new Error(`AI Analysis Failed: Both Gemini and Groq APIs are unavailable. Please check your API keys and rate limits.`);
        }
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/hooks/useVideoGeneration.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useVideoGeneration",
    ()=>useVideoGeneration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/models.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$AIService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/AIService.ts [app-client] (ecmascript)");
const __TURBOPACK__import$2e$meta__ = {
    get url () {
        return `file://${__turbopack_context__.P("src/hooks/useVideoGeneration.ts")}`;
    }
};
var _s = __turbopack_context__.k.signature();
;
;
;
function useVideoGeneration() {
    _s();
    const [analyzedScenes, setAnalyzedScenes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [videoUrls, setVideoUrls] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [status, setStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const analyzePrompt = async (inputText)=>{
        if (!inputText.trim()) {
            setError('Please enter a description for your video');
            return;
        }
        setLoading(true);
        setError('');
        setStatus('Analyzing scene structure...');
        try {
            const scenes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$AIService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["analyzeScenes"])(inputText);
            setAnalyzedScenes(scenes);
            setStatus('Analysis complete! Please review the scenes.');
        } catch (err) {
            console.error('Analysis error:', err);
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally{
            setLoading(false);
        }
    };
    const generateVideosFromScenes = async (scenes, guidanceScale)=>{
        setLoading(true);
        setError('');
        setVideoUrls([]);
        setStatus('Initializing generation...');
        // Tunetales model config
        const modelConfig = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODELS"]['tunetales'];
        const generatedUrls = [];
        // Track per-scene status
        const sceneStatuses = [
            'Pending',
            'Pending',
            'Pending'
        ];
        const updateSceneStatus = (idx, msg)=>{
            sceneStatuses[idx] = msg;
            // Update global status string
            setStatus(`Scene 1: ${sceneStatuses[0]} | Scene 2: ${sceneStatuses[1]} | Scene 3: ${sceneStatuses[2]}`);
        };
        try {
            // Helper to handle rate limits (429) gracefully
            const createPredictionWithRetry = async (payload, sceneIndex, onStatus)=>{
                const maxRetries = 5; // Increased retries for strict rate limits
                let attempt = 0;
                while(attempt < maxRetries){
                    try {
                        const response = await fetch(modelConfig.endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${__TURBOPACK__import$2e$meta__.env.VITE_REPLICATE_API_TOKEN}`
                            },
                            body: JSON.stringify(payload)
                        });
                        // Rate Limit Handling
                        if (response.status === 429) {
                            const errorText = await response.text();
                            let retrySeconds = 12; // Default safe wait
                            try {
                                const jsonErr = JSON.parse(errorText);
                                if (jsonErr.retry_after) retrySeconds = Math.ceil(jsonErr.retry_after) + 2;
                                else if (jsonErr.detail && jsonErr.detail.includes('retry_after')) {
                                // Sometimes detail string has it? No, usually in separate field.
                                }
                            } catch (e) {
                                console.error(e);
                            }
                            console.warn(`Scene ${sceneIndex + 1} hit rate limit (429). Retrying in ${retrySeconds}s...`);
                            if (onStatus) onStatus(`Rate limited. Waiting ${retrySeconds}s...`);
                            await new Promise((resolve)=>setTimeout(resolve, retrySeconds * 1000));
                            attempt++;
                            continue; // Retry logic
                        }
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Error ${response.status}: ${errorText}`);
                        }
                        return await response.json();
                    } catch (err) {
                        console.error(`Attempt ${attempt + 1} failed:`, err);
                        if (attempt === maxRetries - 1) throw err;
                        if (onStatus) onStatus(`Retrying (${attempt + 1}/${maxRetries})...`);
                        await new Promise((resolve)=>setTimeout(resolve, 3000)); // Basic network backoff
                        attempt++;
                    }
                }
                throw new Error(`Scene ${sceneIndex + 1} failed after ${maxRetries} retries.`);
            };
            // 2. Generate 3 videos with robust retry logic
            const generateScene = async (scene, index)=>{
                updateSceneStatus(index, 'Starting...');
                const richPrompt = `${scene.primary_visuals}. Emotional Tone: ${scene.emotional_tone}.`;
                const payload = modelConfig.payloadBuilder(richPrompt, {
                    guidanceScale,
                    enhancePrompt: false,
                    duration: 20,
                    aspectRatio: '16:9'
                });
                try {
                    let prediction = await createPredictionWithRetry(payload, index, (msg)=>updateSceneStatus(index, msg));
                    updateSceneStatus(index, 'Processing...');
                    // Poll for completion
                    while(prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled'){
                        await new Promise((resolve)=>setTimeout(resolve, 3000));
                        const pollResponse = await fetch(`/api/replicate/predictions/${prediction.id}`, {
                            headers: {
                                'Authorization': `Bearer ${__TURBOPACK__import$2e$meta__.env.VITE_REPLICATE_API_TOKEN}`
                            }
                        });
                        // Handle Rate Limit during polling too
                        if (pollResponse.status === 429) {
                            updateSceneStatus(index, 'Polling rate limit...');
                            await new Promise((resolve)=>setTimeout(resolve, 5000));
                            continue;
                        }
                        prediction = await pollResponse.json();
                        if (prediction.status === 'failed') {
                            updateSceneStatus(index, 'Failed');
                            // Expose the actual error details from Replicate
                            const detailedError = prediction.error?.message || prediction.error || JSON.stringify(prediction.logs) || 'Unknown error';
                            console.error(`Scene ${index + 1} Replicate Error:`, prediction);
                            throw new Error(`Scene ${index + 1} failed: ${detailedError}`);
                        }
                        // Show detailed status if simplified
                        if (prediction.status !== 'succeeded') {
                            // Map 'processing' -> 'Rendering...'
                            const friendlyStatus = prediction.status === 'processing' ? 'Rendering...' : prediction.status === 'starting' ? 'Starting...' : prediction.status;
                            updateSceneStatus(index, friendlyStatus);
                        }
                    }
                    if (prediction.output) {
                        updateSceneStatus(index, 'Done!');
                        return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
                    }
                    throw new Error(`No output for scene ${index + 1}`);
                } catch (e) {
                    updateSceneStatus(index, 'Failed');
                    throw e;
                }
            };
            setStatus('Initializing scenes...');
            // Execute generations
            const p1 = generateScene(scenes[0], 0);
            await new Promise((r)=>setTimeout(r, 2000));
            const p2 = generateScene(scenes[1], 1);
            await new Promise((r)=>setTimeout(r, 2000));
            const p3 = generateScene(scenes[2], 2);
            const results = await Promise.all([
                p1,
                p2,
                p3
            ]);
            generatedUrls.push(...results);
            setVideoUrls(generatedUrls);
            setStatus(`Success! All scenes complete.`);
        } catch (err) {
            console.error('Generation error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally{
            setLoading(false);
            if (generatedUrls.length === 3) {
                setStatus('Generation Complete');
            }
        }
    };
    const resetAnalysis = ()=>{
        setAnalyzedScenes(null);
        setVideoUrls([]);
        setError('');
        setStatus('');
    };
    const updateAnalyzedScene = (index, field, value)=>{
        setAnalyzedScenes((prev)=>{
            if (!prev) return null;
            const newScenes = [
                ...prev
            ];
            newScenes[index] = {
                ...newScenes[index],
                [field]: value
            };
            return newScenes;
        });
    };
    return {
        analyzedScenes,
        videoUrls,
        loading,
        error,
        status,
        analyzePrompt,
        generateVideosFromScenes,
        resetAnalysis,
        updateAnalyzedScene,
        setAnalyzedScenes
    };
}
_s(useVideoGeneration, "TTlp5k2eK7UrPabTGUgYzft4M7k=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/hooks/useChatFlow.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useChatFlow",
    ()=>useChatFlow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$AIService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/AIService.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useChatFlow() {
    _s();
    const [messages, setMessages] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [currentState, setCurrentState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('greeting');
    const [currentUserStory, setCurrentUserStory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [generatingVideos, setGeneratingVideos] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Generate greeting on first load
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useChatFlow.useEffect": ()=>{
            const initializeGreeting = {
                "useChatFlow.useEffect.initializeGreeting": async ()=>{
                    if (messages.length === 0) {
                        setLoading(true);
                        try {
                            const greeting = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$AIService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateGreeting"])();
                            setMessages([
                                {
                                    role: 'assistant',
                                    content: greeting,
                                    type: 'greeting'
                                }
                            ]);
                            setCurrentState('awaiting_story');
                        } catch (err) {
                            console.error(err);
                            setError('Failed to generate greeting');
                            // Fallback greeting
                            setMessages([
                                {
                                    role: 'assistant',
                                    content: "Welcome to Brick2Brick! I'm here to help bring your visual stories to life. Share your ideas and let's create something amazing together!",
                                    type: 'greeting'
                                }
                            ]);
                            setCurrentState('awaiting_story');
                        } finally{
                            setLoading(false);
                        }
                    }
                }
            }["useChatFlow.useEffect.initializeGreeting"];
            initializeGreeting();
        }
    }["useChatFlow.useEffect"], [
        messages.length
    ]);
    const addUserMessage = (content)=>{
        const userMessage = {
            role: 'user',
            content: content
        };
        setMessages((prev)=>[
                ...prev,
                userMessage
            ]);
        return userMessage;
    };
    const addAssistantMessage = (content, type)=>{
        const assistantMessage = {
            role: 'assistant',
            content: content,
            type: type
        };
        setMessages((prev)=>[
                ...prev,
                assistantMessage
            ]);
        return assistantMessage;
    };
    const processUserStory = async (userStory)=>{
        if (!userStory.toLowerCase().startsWith('@script')) {
            addAssistantMessage("Please use the '@Script' format to submit your story.");
            return;
        }
        setLoading(true);
        setError(null);
        addUserMessage(userStory);
        const storyContent = userStory.substring('@script'.length).trim();
        setCurrentUserStory(storyContent);
        addAssistantMessage("Shall I enhance your story with cinematic elements....");
        setCurrentState('awaiting_enhancement_confirmation');
        setLoading(false);
    };
    const handleEnhancementConfirmation = async (userResponse)=>{
        addUserMessage(userResponse);
        setLoading(true);
        setError(null);
        if (userResponse.toLowerCase().trim().includes('yes')) {
            if (currentUserStory) {
                try {
                    setCurrentState('analyzing');
                    addAssistantMessage("Creating cinematic scenes from your story...", 'scenes');
                    const scenes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$AIService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["analyzeScenes"])(currentUserStory);
                    // Add Scene Reviewer as a message
                    addAssistantMessage("Scene Review", 'scene_review');
                    setCurrentState('awaiting_proceed_confirmation');
                    setLoading(false);
                    return scenes;
                } catch (err) {
                    setError('Failed to analyze scenes');
                    addAssistantMessage("I apologize, but I couldn't create the scenes. Please try again with a different story.");
                    setCurrentState('awaiting_story');
                    setLoading(false);
                    throw err;
                }
            }
        } else {
            addAssistantMessage("Scene Enhancer is Required.");
            setCurrentState('awaiting_story');
            setLoading(false);
        }
        return undefined;
    };
    const handleProceedConfirmation = (userResponse)=>{
        addUserMessage(userResponse);
        // Remove punctuation and check if response contains 'proceed'
        const cleanedResponse = userResponse.toLowerCase().trim().replace(/[.,!?;:]/g, '');
        if (cleanedResponse === 'proceed' || cleanedResponse === 'yes' || cleanedResponse === 'continue') {
            setGeneratingVideos(true);
            setCurrentState('scenes_ready');
        } else {
            // User provided feedback instead of proceeding
            addAssistantMessage("I'll regenerate the scenes based on your feedback.");
            setCurrentState('awaiting_enhancement_confirmation');
        }
    };
    const resetConversation = ()=>{
        setMessages([]);
        setCurrentState('greeting');
        setError(null);
        setLoading(false);
        setCurrentUserStory(null);
        setGeneratingVideos(false);
    };
    return {
        messages,
        currentState,
        loading,
        error,
        generatingVideos,
        processUserStory,
        handleEnhancementConfirmation,
        handleProceedConfirmation,
        resetConversation
    };
}
_s(useChatFlow, "f/ymjs3QCgC65Mb0TM7GOs9phN4=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/services/VideoStitcherService.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "videoStitcher",
    ()=>videoStitcher
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$classes$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/ffmpeg/dist/esm/classes.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$util$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@ffmpeg/util/dist/esm/index.js [app-client] (ecmascript)");
;
;
class VideoStitcherService {
    ffmpeg = null;
    loaded = false;
    async load() {
        if (this.loaded) return;
        this.ffmpeg = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$ffmpeg$2f$dist$2f$esm$2f$classes$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FFmpeg"]();
        // Log logs to console for debugging
        this.ffmpeg.on('log', ({ message })=>{
            console.log('[FFmpeg]', message);
        });
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        try {
            await this.ffmpeg.load({
                coreURL: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$util$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toBlobURL"])(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$ffmpeg$2f$util$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toBlobURL"])(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
            });
            this.loaded = true;
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            throw new Error('Failed to initialize video processor');
        }
    }
    async stitchVideos(videoUrls, onProgress) {
        if (!this.ffmpeg || !this.loaded) {
            await this.load();
        }
        const ffmpeg = this.ffmpeg;
        // Progress handler
        const progressListener = ({ progress })=>{
            if (onProgress) onProgress(Math.round(progress * 100));
        };
        ffmpeg.on('progress', progressListener);
        try {
            // Verify Browser Capabilities
            if (!window.crossOriginIsolated) {
                throw new Error('Browser is not cross-origin isolated. SharedArrayBuffer unavailable. Please restart server/browser to apply COOP/COEP headers.');
            }
            // 1. Write files to FS with explicitly CORS-enabled fetch
            for(let i = 0; i < videoUrls.length; i++){
                // Fetch directly to Buffer to ensure we control the request
                const response = await fetch(videoUrls[i]);
                if (!response.ok) throw new Error(`Failed to fetch video ${i + 1}: ${response.statusText}`);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                await ffmpeg.writeFile(`input${i}.mp4`, uint8Array);
            }
            // 2. Build Filter Graph for 3 videos
            // 20s clips. 1s overlap for crossfade.
            // Clip 0 ends at 20s. Fade starts at 19s.
            // Clip 1 starts. Joined at 19s.
            // Result of [0][1] duration = 20 + 20 - 1 = 39s.
            // Next fade starts at 39s - 1s = 38s.
            // Inputs: [0:v][1:v][2:v]
            // Crossfade 0+1: [0][1]xfade=transition=fade:duration=1:offset=19[v01];
            // Crossfade v01+2: [v01][2]xfade=transition=fade:duration=1:offset=38[outv]
            // Note: We also need to handle AUDIO (afade/acrossfade) if there is audio.
            // Provided videos usually have audio. Simplest is amix or acrossfade.
            // For now, let's assume we just concatenate/crossfade video. If audio is missing it might fail.
            // Let's use a simpler "concat" demuxer approach IF the user accepts straightforward cuts (safer).
            // But user asked for "smooth fade".
            // Complex filter for 3 videos
            const filter = `[0:v][1:v]xfade=transition=fade:duration=1:offset=19[v01];` + `[v01][2:v]xfade=transition=fade:duration=1:offset=38,format=yuv420p[outv];` + `[0:a][1:a]acrossfade=d=1:c1=tri:c2=tri[a01];` + `[a01][2:a]acrossfade=d=1:c1=tri:c2=tri[outa]`;
            await ffmpeg.exec([
                '-i',
                'input0.mp4',
                '-i',
                'input1.mp4',
                '-i',
                'input2.mp4',
                '-filter_complex',
                filter,
                '-map',
                '[outv]',
                '-map',
                '[outa]',
                '-c:v',
                'libx264',
                '-preset',
                'ultrafast',
                '-crf',
                '28',
                'output.mp4'
            ]);
            // 3. Read result
            const data = await ffmpeg.readFile('output.mp4');
            const blob = new Blob([
                data
            ], {
                type: 'video/mp4'
            });
            return URL.createObjectURL(blob);
        } finally{
            // Cleanup FS to free memory
            for(let i = 0; i < videoUrls.length; i++){
                try {
                    await ffmpeg.deleteFile(`input${i}.mp4`);
                } catch (e) {
                    console.error(e);
                }
            }
            try {
                await ffmpeg.deleteFile('output.mp4');
            } catch (e) {
                console.error(e);
            }
            ffmpeg.off('progress', progressListener);
        }
    }
}
const videoStitcher = new VideoStitcherService();
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/VideoPlayer.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>VideoPlayer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$film$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Film$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/film.js [app-client] (ecmascript) <export default as Film>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-client] (ecmascript) <export default as Image>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [app-client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pause$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pause$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pause.js [app-client] (ecmascript) <export default as Pause>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/download.js [app-client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/video.js [app-client] (ecmascript) <export default as Video>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scissors$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Scissors$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/scissors.js [app-client] (ecmascript) <export default as Scissors>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$crop$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Crop$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/crop.js [app-client] (ecmascript) <export default as Crop>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$VideoStitcherService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/VideoStitcherService.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
function VideoPlayer({ videoUrls, currentVideoIndex, setCurrentVideoIndex }) {
    _s();
    const videoRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fileInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    // UI State
    const [isPlaying, setIsPlaying] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [showEditor, setShowEditor] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    // Editing State
    const [videoDuration, setVideoDuration] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [trimStart, setTrimStart] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [trimEnd, setTrimEnd] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [cropSettings, setCropSettings] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        x: 0,
        y: 0,
        width: 100,
        height: 100
    });
    const [draggedItem, setDraggedItem] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Stitching State
    const [isStitching, setIsStitching] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [activeBlobUrl, setActiveBlobUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isLoadingBlob, setIsLoadingBlob] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Fetch Blob when current video changes (to bypass COOP/COEP)
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useEffect({
        "VideoPlayer.useEffect": ()=>{
            const url = videoUrls[currentVideoIndex];
            if (!url) {
                setActiveBlobUrl(null);
                return;
            }
            let isMounted = true;
            setIsLoadingBlob(true);
            fetch(url).then({
                "VideoPlayer.useEffect": (res)=>res.blob()
            }["VideoPlayer.useEffect"]).then({
                "VideoPlayer.useEffect": (blob)=>{
                    if (isMounted) {
                        const objectUrl = URL.createObjectURL(blob);
                        setActiveBlobUrl(objectUrl);
                        setIsLoadingBlob(false);
                    }
                }
            }["VideoPlayer.useEffect"]).catch({
                "VideoPlayer.useEffect": (err)=>{
                    console.error("Failed to load video blob:", err);
                    if (isMounted) setIsLoadingBlob(false);
                }
            }["VideoPlayer.useEffect"]);
            return ({
                "VideoPlayer.useEffect": ()=>{
                    isMounted = false;
                }
            })["VideoPlayer.useEffect"];
        }
    }["VideoPlayer.useEffect"], [
        currentVideoIndex,
        videoUrls
    ]);
    // Timeline State
    const [timelineItems, setTimelineItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [timelineDuration, setTimelineDuration] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(30);
    // Helpers
    const handlePlayPause = ()=>{
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };
    const handleLoadedMetadata = ()=>{
        if (videoRef.current) {
            setVideoDuration(videoRef.current.duration);
            setTrimEnd(videoRef.current.duration);
        }
    };
    const handleDownloadingHelper = (url, name)=>{
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    const handleDownload = ()=>{
        const url = videoUrls[currentVideoIndex];
        handleDownloadingHelper(url, `tunetales-scene-${currentVideoIndex + 1}.mp4`);
    };
    const handleDownloadEdited = ()=>{
        const url = videoUrls[currentVideoIndex];
        handleDownloadingHelper(url, `tunetales-edited-${Date.now()}.mp4`);
    };
    const handleDownloadAll = ()=>{
        videoUrls.forEach((url, index)=>{
            if (url) {
                setTimeout(()=>{
                    handleDownloadingHelper(url, `tunetales-scene-${index + 1}.mp4`);
                }, index * 500);
            }
        });
    };
    const handleStitchAndDownload = async ()=>{
        const validUrls = videoUrls.filter((u)=>u !== null);
        if (validUrls.length < 2) return;
        setIsStitching(true);
        try {
            const finalUrl = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$VideoStitcherService$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoStitcher"].stitchVideos(validUrls);
            handleDownloadingHelper(finalUrl, `tunetales-full-movie-${Date.now()}.mp4`);
        } catch (error) {
            console.error('Stitching failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Stitching Failed: ${errorMessage}. \n\nNote: If the error mentions 'SharedArrayBuffer', please fully restart your terminal/server to apply security headers.`);
        } finally{
            setIsStitching(false);
        }
    };
    // Timeline helpers
    const handleFileImport = (event)=>{
        const files = event.target.files;
        if (files) {
            Array.from(files).forEach((file)=>{
                const url = URL.createObjectURL(file);
                const newItem = {
                    id: Date.now().toString() + Math.random(),
                    type: file.type.startsWith('video/') ? 'video' : 'image',
                    url,
                    startTime: 0,
                    duration: 5,
                    name: file.name,
                    position: 0
                };
                setTimelineItems((prev)=>[
                        ...prev,
                        newItem
                    ]);
            });
        }
    };
    const removeTimelineItem = (id)=>{
        setTimelineItems((prev)=>prev.filter((item)=>item.id !== id));
    };
    const handleDragStart = (e, itemId)=>{
        setDraggedItem(itemId);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleTimelineDragOver = (e)=>{
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const position = x / rect.width * timelineDuration;
        if (draggedItem) {
            setTimelineItems((prev)=>prev.map((item)=>item.id === draggedItem ? {
                        ...item,
                        position: Math.max(0, Math.min(timelineDuration - item.duration, position))
                    } : item));
        }
    };
    const handleTimelineDrop = (e)=>{
        e.preventDefault();
        setDraggedItem(null);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-12 space-y-8",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setShowEditor(!showEditor),
                        className: `px-4 py-2 rounded-xl font-semibold transition-all flex items-center gap-2 ${showEditor ? 'bg-orange-gradient text-white hover:shadow-lg hover:shadow-orange-brand-600/30' : 'bg-black text-gray-brand-300 hover:bg-gray-brand-900 hover:text-white'} transform hover:scale-105 active:scale-95`,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$film$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Film$3e$__["Film"], {
                                className: "w-4 h-4"
                            }, void 0, false, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 202,
                                columnNumber: 21
                            }, this),
                            showEditor ? 'Simple View' : 'Edit Video'
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 195,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>fileInputRef.current?.click(),
                        className: "px-4 py-2 bg-gradient-to-r from-orange-brand-600 to-orange-brand-700 text-white rounded-xl font-semibold hover:from-orange-brand-700 hover:to-orange-brand-800 transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-orange-brand-900/30",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                className: "w-4 h-4"
                            }, void 0, false, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 211,
                                columnNumber: 21
                            }, this),
                            "Import Media"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 207,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        ref: fileInputRef,
                        type: "file",
                        multiple: true,
                        accept: "video/*,image/*",
                        onChange: handleFileImport,
                        className: "hidden"
                    }, void 0, false, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 215,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/VideoPlayer.tsx",
                lineNumber: 194,
                columnNumber: 13
            }, this),
            showEditor ? /* Video Editor Interface */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative bg-black rounded-xl overflow-hidden border border-orange-brand-800/30 shadow-2xl shadow-orange-brand-900/20",
                        style: {
                            aspectRatio: '16/9'
                        },
                        children: [
                            videoUrls[currentVideoIndex] ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                ref: videoRef,
                                src: videoUrls[currentVideoIndex],
                                autoPlay: true,
                                onEnded: ()=>{
                                    if (currentVideoIndex < videoUrls.length - 1) {
                                        setCurrentVideoIndex((prev)=>prev + 1);
                                    } else {
                                        setIsPlaying(false);
                                    }
                                },
                                onLoadedMetadata: handleLoadedMetadata,
                                className: "w-full h-full object-contain",
                                style: {
                                    clipPath: `inset(${cropSettings.y}% ${100 - cropSettings.x - cropSettings.width}% ${100 - cropSettings.y - cropSettings.height}% ${cropSettings.x}%)`
                                }
                            }, videoUrls[currentVideoIndex], false, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 233,
                                columnNumber: 29
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute inset-0 flex flex-col items-center justify-center text-gray-brand-400 bg-black",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                        className: "w-16 h-16 mb-6 animate-spin text-orange-brand-500"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 253,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xl font-bold text-orange-brand-300",
                                        children: [
                                            "Generating Scene ",
                                            currentVideoIndex + 1,
                                            "..."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 254,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-sm text-gray-brand-500 mt-3",
                                        children: "Please wait"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 255,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 252,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute top-6 left-6 bg-black rounded-lg px-4 py-2 text-sm font-mono space-y-1 z-10 border border-orange-brand-800/50 backdrop-blur-sm",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-white font-bold",
                                        children: [
                                            "Scene ",
                                            currentVideoIndex + 1,
                                            "/",
                                            videoUrls.length
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 261,
                                        columnNumber: 29
                                    }, this),
                                    videoUrls[currentVideoIndex] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-orange-brand-300",
                                        children: [
                                            "Duration: ",
                                            videoDuration.toFixed(1),
                                            "s"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 262,
                                        columnNumber: 62
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 260,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute bottom-6 left-6 right-6 bg-black rounded-xl p-5 z-10 backdrop-blur-sm border border-orange-brand-800/50",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-6 mb-3",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setCurrentVideoIndex(Math.max(0, currentVideoIndex - 1)),
                                            disabled: currentVideoIndex === 0,
                                            className: "text-white disabled:text-gray-brand-600 hover:text-orange-brand-400 transition-all duration-300 font-semibold px-3 py-1 rounded-lg hover:bg-orange-brand-900/30",
                                            children: "Prev"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                            lineNumber: 269,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: handlePlayPause,
                                            disabled: !videoUrls[currentVideoIndex],
                                            className: "bg-orange-gradient text-white p-3 rounded-full hover:shadow-lg hover:shadow-orange-brand-600/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-110 active:scale-95",
                                            children: isPlaying ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pause$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pause$3e$__["Pause"], {
                                                className: "w-5 h-5"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 282,
                                                columnNumber: 50
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                                className: "w-5 h-5"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 282,
                                                columnNumber: 82
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                            lineNumber: 277,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>setCurrentVideoIndex(Math.min(videoUrls.length - 1, currentVideoIndex + 1)),
                                            disabled: currentVideoIndex === videoUrls.length - 1,
                                            className: "text-white disabled:text-gray-brand-600 hover:text-orange-brand-400 transition-all duration-300 font-semibold px-3 py-1 rounded-lg hover:bg-orange-brand-900/30",
                                            children: "Next"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                            lineNumber: 286,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex-1 text-right text-sm text-orange-brand-300 font-medium",
                                            children: videoUrls[currentVideoIndex] ? 'Ready' : 'Generating...'
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                            lineNumber: 295,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/VideoPlayer.tsx",
                                    lineNumber: 267,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 266,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 229,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 md:grid-cols-2 gap-8",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-black p-6 rounded-xl border border-orange-brand-800/30 shadow-xl shadow-orange-brand-900/20",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-xl font-bold mb-6 flex items-center gap-3 text-orange-brand-300",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scissors$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Scissors$3e$__["Scissors"], {
                                                className: "w-6 h-6"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 307,
                                                columnNumber: 33
                                            }, this),
                                            "Trim Video"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 306,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-6",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "block text-sm text-gray-brand-400 mb-3 font-medium",
                                                        children: "Start Time (seconds)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 312,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "range",
                                                        min: "0",
                                                        max: videoDuration - 1,
                                                        step: "0.1",
                                                        value: trimStart,
                                                        onChange: (e)=>setTrimStart(parseFloat(e.target.value)),
                                                        className: "w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider",
                                                        style: {
                                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${trimStart / (videoDuration - 1) * 100}%, #374151 ${trimStart / (videoDuration - 1) * 100}%, #374151 100%)`
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 313,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm text-orange-brand-300 mt-2 font-semibold",
                                                        children: [
                                                            trimStart.toFixed(1),
                                                            "s"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 325,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 311,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "block text-sm text-gray-brand-400 mb-3 font-medium",
                                                        children: "End Time (seconds)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 328,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "range",
                                                        min: trimStart + 1,
                                                        max: videoDuration,
                                                        step: "0.1",
                                                        value: trimEnd,
                                                        onChange: (e)=>setTrimEnd(parseFloat(e.target.value)),
                                                        className: "w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider",
                                                        style: {
                                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${(trimEnd - trimStart - 1) / (videoDuration - trimStart - 1) * 100}%, #374151 ${(trimEnd - trimStart - 1) / (videoDuration - trimStart - 1) * 100}%, #374151 100%)`
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 329,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm text-orange-brand-300 mt-2 font-semibold",
                                                        children: [
                                                            trimEnd.toFixed(1),
                                                            "s"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 341,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 327,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 310,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 305,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "bg-black p-6 rounded-xl border border-orange-brand-800/30 shadow-xl shadow-orange-brand-900/20",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-xl font-bold mb-6 flex items-center gap-3 text-orange-brand-300",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$crop$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Crop$3e$__["Crop"], {
                                                className: "w-6 h-6"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 349,
                                                columnNumber: 33
                                            }, this),
                                            "Crop Video"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 348,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-2 gap-6",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "block text-sm text-gray-brand-400 mb-3 font-medium",
                                                        children: "X (%)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 354,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "range",
                                                        min: "0",
                                                        max: "50",
                                                        value: cropSettings.x,
                                                        onChange: (e)=>setCropSettings({
                                                                ...cropSettings,
                                                                x: parseInt(e.target.value)
                                                            }),
                                                        className: "w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider",
                                                        style: {
                                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${cropSettings.x / 50 * 100}%, #374151 ${cropSettings.x / 50 * 100}%, #374151 100%)`
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 355,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm text-orange-brand-300 mt-2 font-semibold",
                                                        children: [
                                                            cropSettings.x,
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 366,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 353,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "block text-sm text-gray-brand-400 mb-3 font-medium",
                                                        children: "Y (%)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 369,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "range",
                                                        min: "0",
                                                        max: "50",
                                                        value: cropSettings.y,
                                                        onChange: (e)=>setCropSettings({
                                                                ...cropSettings,
                                                                y: parseInt(e.target.value)
                                                            }),
                                                        className: "w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider",
                                                        style: {
                                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${cropSettings.y / 50 * 100}%, #374151 ${cropSettings.y / 50 * 100}%, #374151 100%)`
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 370,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm text-orange-brand-300 mt-2 font-semibold",
                                                        children: [
                                                            cropSettings.y,
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 381,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 368,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "block text-sm text-gray-brand-400 mb-3 font-medium",
                                                        children: "Width (%)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 384,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "range",
                                                        min: "50",
                                                        max: "100",
                                                        value: cropSettings.width,
                                                        onChange: (e)=>setCropSettings({
                                                                ...cropSettings,
                                                                width: parseInt(e.target.value)
                                                            }),
                                                        className: "w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider",
                                                        style: {
                                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${(cropSettings.width - 50) / 50 * 100}%, #374151 ${(cropSettings.width - 50) / 50 * 100}%, #374151 100%)`
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 385,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm text-orange-brand-300 mt-2 font-semibold",
                                                        children: [
                                                            cropSettings.width,
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 396,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 383,
                                                columnNumber: 33
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        className: "block text-sm text-gray-brand-400 mb-3 font-medium",
                                                        children: "Height (%)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 399,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "range",
                                                        min: "50",
                                                        max: "100",
                                                        value: cropSettings.height,
                                                        onChange: (e)=>setCropSettings({
                                                                ...cropSettings,
                                                                height: parseInt(e.target.value)
                                                            }),
                                                        className: "w-full h-2 bg-black rounded-lg appearance-none cursor-pointer slider",
                                                        style: {
                                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${(cropSettings.height - 50) / 50 * 100}%, #374151 ${(cropSettings.height - 50) / 50 * 100}%, #374151 100%)`
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 400,
                                                        columnNumber: 37
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm text-orange-brand-300 mt-2 font-semibold",
                                                        children: [
                                                            cropSettings.height,
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                                        lineNumber: 411,
                                                        columnNumber: 37
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 398,
                                                columnNumber: 33
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 352,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 347,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 303,
                        columnNumber: 21
                    }, this),
                    timelineItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-black p-6 rounded-xl border border-orange-brand-800/30 shadow-xl shadow-orange-brand-900/20",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex justify-between items-center mb-6",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-xl font-bold flex items-center gap-3 text-orange-brand-300",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$film$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Film$3e$__["Film"], {
                                                className: "w-6 h-6"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 422,
                                                columnNumber: 37
                                            }, this),
                                            "Timeline"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 421,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: handleDownloadEdited,
                                        className: "bg-orange-gradient hover:shadow-lg hover:shadow-orange-brand-600/30 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                                className: "w-5 h-5"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 429,
                                                columnNumber: 37
                                            }, this),
                                            "Export Video"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 425,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 420,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-6 mb-6",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        className: "text-sm text-gray-brand-400 font-medium",
                                        children: "Duration:"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 436,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        value: timelineDuration,
                                        onChange: (e)=>setTimelineDuration(parseInt(e.target.value)),
                                        className: "bg-black text-white px-4 py-2 rounded-lg text-sm border border-orange-brand-800/30 focus:border-orange-brand-600 focus:outline-none transition-colors",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: 30,
                                                children: "30 seconds"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 442,
                                                columnNumber: 37
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: 60,
                                                children: "1 minute"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 443,
                                                columnNumber: 37
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: 120,
                                                children: "2 minutes"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 444,
                                                columnNumber: 37
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 437,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 435,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative bg-black rounded-xl p-6 min-h-32 mb-6 border border-orange-brand-800/30",
                                onDragOver: handleTimelineDragOver,
                                onDrop: handleTimelineDrop,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex justify-between text-xs text-gray-brand-500 mb-4 font-medium",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-orange-brand-400",
                                                children: "0s"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 456,
                                                columnNumber: 37
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-orange-brand-400",
                                                children: [
                                                    Math.floor(timelineDuration / 2),
                                                    "s"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 457,
                                                columnNumber: 37
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-orange-brand-400",
                                                children: [
                                                    timelineDuration,
                                                    "s"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 458,
                                                columnNumber: 37
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 455,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "relative h-20 bg-black rounded-xl border-2 border-dashed border-orange-brand-700/50",
                                        children: [
                                            timelineItems.map((item)=>{
                                                const leftPosition = item.position / timelineDuration * 100;
                                                const width = item.duration / timelineDuration * 100;
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    draggable: true,
                                                    onDragStart: (e)=>handleDragStart(e, item.id),
                                                    className: `absolute top-3 h-14 bg-gradient-to-r from-orange-brand-600 to-orange-brand-500 rounded-lg border-2 border-orange-brand-400 cursor-move flex items-center px-3 group ${draggedItem === item.id ? 'opacity-50' : ''}`,
                                                    style: {
                                                        left: `${leftPosition}%`,
                                                        width: `${Math.max(width, 8)}%`,
                                                        minWidth: '80px'
                                                    },
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-3 text-white text-sm font-medium overflow-hidden",
                                                            children: [
                                                                item.type === 'video' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"], {
                                                                    className: "w-4 h-4 flex-shrink-0"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/VideoPlayer.tsx",
                                                                    lineNumber: 481,
                                                                    columnNumber: 78
                                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"], {
                                                                    className: "w-4 h-4 flex-shrink-0"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/VideoPlayer.tsx",
                                                                    lineNumber: 481,
                                                                    columnNumber: 124
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "truncate",
                                                                    children: item.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/VideoPlayer.tsx",
                                                                    lineNumber: 482,
                                                                    columnNumber: 53
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                                            lineNumber: 480,
                                                            columnNumber: 49
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            onClick: (e)=>{
                                                                e.stopPropagation();
                                                                removeTimelineItem(item.id);
                                                            },
                                                            className: "absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                                className: "w-3 h-3"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                                lineNumber: 493,
                                                                columnNumber: 53
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                                            lineNumber: 486,
                                                            columnNumber: 49
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "absolute -bottom-2 left-0 right-0 text-center text-[10px] text-orange-brand-200 font-semibold",
                                                            children: [
                                                                item.duration,
                                                                "s"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                                            lineNumber: 497,
                                                            columnNumber: 49
                                                        }, this)
                                                    ]
                                                }, item.id, true, {
                                                    fileName: "[project]/src/components/VideoPlayer.tsx",
                                                    lineNumber: 468,
                                                    columnNumber: 45
                                                }, this);
                                            }),
                                            timelineItems.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "absolute inset-0 flex items-center justify-center text-gray-brand-500 text-sm font-medium",
                                                children: "Drag and drop files here to add to timeline"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 505,
                                                columnNumber: 41
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 462,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 449,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "border-2 border-dashed border-orange-brand-700/50 rounded-xl p-8 text-center hover:border-orange-brand-600 transition-all bg-black",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        ref: fileInputRef,
                                        type: "file",
                                        multiple: true,
                                        accept: "video/*,image/*",
                                        onChange: handleFileImport,
                                        className: "hidden"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 514,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>fileInputRef.current?.click(),
                                        className: "flex flex-col items-center gap-3 text-gray-brand-400 hover:text-orange-brand-300 transition-all mx-auto group",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                                className: "w-10 h-10 group-hover:scale-110 transition-transform"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 526,
                                                columnNumber: 37
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-base font-medium",
                                                children: "Click to add videos or photos"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 527,
                                                columnNumber: 37
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-sm text-gray-brand-500",
                                                children: "or drag and drop files"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                                lineNumber: 528,
                                                columnNumber: 37
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 522,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 513,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 419,
                        columnNumber: 25
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/VideoPlayer.tsx",
                lineNumber: 227,
                columnNumber: 17
            }, this) : /* Simple Video Player */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-2 border-orange-brand-800/30 rounded-xl overflow-hidden relative bg-black shadow-xl shadow-orange-brand-900/20",
                children: [
                    activeBlobUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                        src: activeBlobUrl,
                        controls: true,
                        autoPlay: true,
                        onEnded: ()=>{
                            if (currentVideoIndex < videoUrls.length - 1) {
                                setCurrentVideoIndex((prev)=>prev + 1);
                            }
                        },
                        className: "w-full",
                        style: {
                            maxHeight: '500px'
                        },
                        children: "Your browser does not support the video tag."
                    }, activeBlobUrl, false, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 539,
                        columnNumber: 25
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-full h-[500px] flex flex-col items-center justify-center text-gray-brand-400 bg-black",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                className: "w-16 h-16 mb-6 animate-spin text-orange-brand-500"
                            }, void 0, false, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 556,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xl font-bold text-orange-brand-300",
                                children: isLoadingBlob ? 'Loading Video...' : `Generating Scene ${currentVideoIndex + 1}...`
                            }, void 0, false, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 557,
                                columnNumber: 29
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-sm text-gray-400 mt-2",
                                children: "Please wait"
                            }, void 0, false, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 560,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 555,
                        columnNumber: 25
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-6 left-6 bg-black rounded-xl px-4 py-2 text-sm font-bold text-white pointer-events-none border border-orange-brand-700/50 backdrop-blur-sm",
                        children: [
                            "Scene ",
                            currentVideoIndex + 1,
                            "/",
                            videoUrls.length
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 565,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-black p-6 space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleDownload,
                                className: "w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                        className: "w-6 h-6"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 575,
                                        columnNumber: 29
                                    }, this),
                                    "Save Current Scene"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 571,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleDownloadAll,
                                className: "w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-brand-900 transition-all flex items-center justify-center gap-3 border border-orange-brand-800/50 transform hover:scale-105 active:scale-95",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                        className: "w-6 h-6"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/VideoPlayer.tsx",
                                        lineNumber: 583,
                                        columnNumber: 29
                                    }, this),
                                    "Download All 3 Scenes"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 579,
                                columnNumber: 25
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleStitchAndDownload,
                                disabled: isStitching,
                                className: "w-full bg-gradient-to-r from-orange-brand-600 to-orange-brand-500 text-white py-4 rounded-xl font-bold hover:from-orange-brand-500 hover:to-orange-brand-400 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-orange-brand-600/30",
                                children: isStitching ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                            className: "w-6 h-6 animate-spin"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                            lineNumber: 594,
                                            columnNumber: 37
                                        }, this),
                                        "Stitching Videos (This takes ~20s)..."
                                    ]
                                }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                            className: "w-6 h-6"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/VideoPlayer.tsx",
                                            lineNumber: 599,
                                            columnNumber: 37
                                        }, this),
                                        "Download Full Movie (Merged)"
                                    ]
                                }, void 0, true)
                            }, void 0, false, {
                                fileName: "[project]/src/components/VideoPlayer.tsx",
                                lineNumber: 587,
                                columnNumber: 25
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/VideoPlayer.tsx",
                        lineNumber: 570,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/VideoPlayer.tsx",
                lineNumber: 536,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/VideoPlayer.tsx",
        lineNumber: 192,
        columnNumber: 9
    }, this);
}
_s(VideoPlayer, "0qmOJWYgvpUAttfUcwjOwXOCr6A=");
_c = VideoPlayer;
var _c;
__turbopack_context__.k.register(_c, "VideoPlayer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Brick2Brick
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$film$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Film$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/film.js [app-client] (ecmascript) <export default as Film>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/send.js [app-client] (ecmascript) <export default as Send>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bot.js [app-client] (ecmascript) <export default as Bot>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2d$big$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check-big.js [app-client] (ecmascript) <export default as CheckCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useVideoGeneration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/hooks/useVideoGeneration.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useChatFlow$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/hooks/useChatFlow.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$VideoPlayer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/VideoPlayer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/config/models.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
function Brick2Brick() {
    _s();
    const { analyzedScenes, videoUrls, error: videoError, setAnalyzedScenes, generateVideosFromScenes, resetAnalysis, updateAnalyzedScene } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useVideoGeneration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useVideoGeneration"])();
    const { messages, currentState, loading: chatLoading, error: chatError, generatingVideos, processUserStory, handleEnhancementConfirmation, handleProceedConfirmation, resetConversation } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useChatFlow$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatFlow"])();
    const [inputText, setInputText] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [guidanceScale] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$config$2f$models$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODELS"]['tunetales'].defaultGuidance);
    const [currentVideoIndex, setCurrentVideoIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const messagesEndRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const handleGenerateVideos = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Brick2Brick.useCallback[handleGenerateVideos]": async ()=>{
            if (analyzedScenes) {
                await generateVideosFromScenes(analyzedScenes, guidanceScale);
            }
        }
    }["Brick2Brick.useCallback[handleGenerateVideos]"], [
        analyzedScenes,
        guidanceScale,
        generateVideosFromScenes
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Brick2Brick.useEffect": ()=>{
            messagesEndRef.current?.scrollIntoView({
                behavior: 'smooth'
            });
        }
    }["Brick2Brick.useEffect"], [
        messages
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Brick2Brick.useEffect": ()=>{
            if (currentState === 'scenes_ready' && analyzedScenes) {
                handleGenerateVideos();
            }
        }
    }["Brick2Brick.useEffect"], [
        currentState,
        analyzedScenes,
        handleGenerateVideos
    ]);
    const handleSendMessage = async ()=>{
        if (!inputText.trim() || chatLoading) return;
        const userMessage = inputText.trim();
        setInputText('');
        if (currentState === 'awaiting_enhancement_confirmation') {
            const scenes = await handleEnhancementConfirmation(userMessage);
            if (scenes) {
                setAnalyzedScenes(scenes);
            }
        } else if (currentState === 'awaiting_proceed_confirmation') {
            handleProceedConfirmation(userMessage);
        } else {
            await processUserStory(userMessage);
        }
    };
    const formatMessageContent = (content)=>{
        return content.split('\n').map((line, index)=>{
            if (line.startsWith('✨') || line.startsWith('🎬') || line.startsWith('🎵') || line.startsWith('🎥')) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-start gap-2 mb-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-lg",
                            children: line.substring(0, 2)
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 78,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "font-semibold text-orange-brand-300",
                            children: [
                                line.substring(2).split(':')[0],
                                ":"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 79,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-gray-brand-200",
                            children: line.substring(2).split(':')[1]
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 80,
                            columnNumber: 25
                        }, this)
                    ]
                }, index, true, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 77,
                    columnNumber: 21
                }, this);
            }
            if (line.startsWith('•')) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "ml-4 text-gray-brand-300 mb-1",
                    children: line
                }, index, false, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 86,
                    columnNumber: 21
                }, this);
            }
            if (line.trim() === '') {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-2"
                }, index, false, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 92,
                    columnNumber: 24
                }, this);
            }
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-gray-brand-200 leading-relaxed",
                children: line
            }, index, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 95,
                columnNumber: 17
            }, this);
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "h-screen bg-custom-bg text-custom-cream flex flex-col",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-shrink-0 p-4 bg-custom-bg",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-center mb-2",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "p-2 bg-custom-orange rounded-full shadow-lg shadow-custom-orange/50",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$film$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Film$3e$__["Film"], {
                                    className: "w-8 h-8 text-custom-cream"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 109,
                                    columnNumber: 29
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 108,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 107,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-2xl font-bold text-custom-orange",
                            children: "Brick2Brick"
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 112,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-custom-cream/70 text-sm",
                            children: "Transform your words into motion"
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 115,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 106,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 105,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 overflow-y-auto p-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-4xl mx-auto space-y-6",
                    children: [
                        messages.map((message, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`,
                                children: [
                                    message.role === 'assistant' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "w-8 h-8 bg-custom-orange rounded-full flex items-center justify-center flex-shrink-0",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"], {
                                            className: "w-4 h-4 text-custom-cream"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 126,
                                            columnNumber: 37
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 125,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: `max-w-3xl ${message.role === 'user' ? 'order-1' : 'order-2'}`,
                                        children: message.type === 'scene_review' && analyzedScenes ? // Render Scene Reviewer inline
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "bg-custom-cream/5 border border-custom-orange/30 rounded-2xl p-4 mr-12",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-6",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                        className: "text-2xl font-bold text-custom-orange",
                                                        children: "Scene Review"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 135,
                                                        columnNumber: 45
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "grid gap-4",
                                                        children: analyzedScenes?.map((scene, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: `bg-custom-bg border border-custom-orange/30 rounded-xl p-4 transition-all duration-300 ${generatingVideos ? 'opacity-75' : 'hover:border-custom-orange'}`,
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center justify-between mb-3",
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                            className: "font-bold text-lg text-custom-orange",
                                                                            children: [
                                                                                "Scene ",
                                                                                idx + 1
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/src/app/page.tsx",
                                                                            lineNumber: 144,
                                                                            columnNumber: 61
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/app/page.tsx",
                                                                        lineNumber: 143,
                                                                        columnNumber: 57
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "space-y-4 text-sm",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                                        className: "text-custom-cream block mb-2 font-semibold flex items-center gap-2",
                                                                                        children: [
                                                                                            "Visuals",
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                className: "text-xs text-custom-orange font-normal",
                                                                                                children: "(AI Suggested)"
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/src/app/page.tsx",
                                                                                                lineNumber: 151,
                                                                                                columnNumber: 69
                                                                                            }, this)
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/src/app/page.tsx",
                                                                                        lineNumber: 149,
                                                                                        columnNumber: 65
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                                                        value: scene.primary_visuals,
                                                                                        onChange: (e)=>updateAnalyzedScene(idx, 'primary_visuals', e.target.value),
                                                                                        readOnly: generatingVideos,
                                                                                        className: `w-full bg-custom-bg text-custom-cream p-3 rounded-lg border border-custom-orange/30 resize-none transition-all duration-300 ${generatingVideos ? 'cursor-not-allowed opacity-60' : 'focus:border-custom-orange focus:outline-none'}`,
                                                                                        rows: 3
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/app/page.tsx",
                                                                                        lineNumber: 153,
                                                                                        columnNumber: 65
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/app/page.tsx",
                                                                                lineNumber: 148,
                                                                                columnNumber: 61
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                                        className: "text-custom-cream block mb-2 font-semibold",
                                                                                        children: "Objective"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/app/page.tsx",
                                                                                        lineNumber: 166,
                                                                                        columnNumber: 65
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                                        type: "text",
                                                                                        value: scene.scene_objective,
                                                                                        onChange: (e)=>updateAnalyzedScene(idx, 'scene_objective', e.target.value),
                                                                                        readOnly: generatingVideos,
                                                                                        className: `w-full bg-custom-bg text-custom-cream p-2 rounded-lg border border-custom-orange/30 transition-all duration-300 ${generatingVideos ? 'cursor-not-allowed opacity-60' : 'focus:border-custom-orange focus:outline-none'}`
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/app/page.tsx",
                                                                                        lineNumber: 167,
                                                                                        columnNumber: 65
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/app/page.tsx",
                                                                                lineNumber: 165,
                                                                                columnNumber: 61
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "grid grid-cols-2 gap-3",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        children: [
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                                                className: "text-custom-cream block mb-2 font-semibold",
                                                                                                children: "Mood / Tone"
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/src/app/page.tsx",
                                                                                                lineNumber: 181,
                                                                                                columnNumber: 69
                                                                                            }, this),
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                                                type: "text",
                                                                                                value: scene.emotional_tone,
                                                                                                onChange: (e)=>updateAnalyzedScene(idx, 'emotional_tone', e.target.value),
                                                                                                readOnly: generatingVideos,
                                                                                                className: `w-full bg-custom-bg text-custom-cream p-2 rounded-lg border border-custom-orange/30 transition-all duration-300 ${generatingVideos ? 'cursor-not-allowed opacity-60' : 'focus:border-custom-orange focus:outline-none'}`
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/src/app/page.tsx",
                                                                                                lineNumber: 182,
                                                                                                columnNumber: 69
                                                                                            }, this)
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/src/app/page.tsx",
                                                                                        lineNumber: 180,
                                                                                        columnNumber: 65
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        children: [
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                                                                                className: "text-custom-cream block mb-2",
                                                                                                children: "Transition:"
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/src/app/page.tsx",
                                                                                                lineNumber: 195,
                                                                                                columnNumber: 69
                                                                                            }, this),
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                                className: "text-custom-cream/70 italic block py-2 bg-custom-bg p-2 rounded-lg border border-custom-orange/30 text-xs",
                                                                                                children: scene.transition_logic
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/src/app/page.tsx",
                                                                                                lineNumber: 196,
                                                                                                columnNumber: 69
                                                                                            }, this)
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/src/app/page.tsx",
                                                                                        lineNumber: 194,
                                                                                        columnNumber: 65
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/app/page.tsx",
                                                                                lineNumber: 179,
                                                                                columnNumber: 61
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/app/page.tsx",
                                                                        lineNumber: 147,
                                                                        columnNumber: 57
                                                                    }, this)
                                                                ]
                                                            }, idx, true, {
                                                                fileName: "[project]/src/app/page.tsx",
                                                                lineNumber: 141,
                                                                columnNumber: 53
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/app/page.tsx",
                                                        lineNumber: 139,
                                                        columnNumber: 45
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 134,
                                                columnNumber: 41
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 133,
                                            columnNumber: 37
                                        }, this) : // Regular message rendering
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: `rounded-2xl p-4 ${message.role === 'user' ? 'bg-custom-orange text-custom-cream ml-12' : 'bg-custom-cream/5 border border-custom-orange/30 mr-12'}`,
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-sm leading-relaxed",
                                                children: formatMessageContent(message.content)
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 211,
                                                columnNumber: 41
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 207,
                                            columnNumber: 37
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 130,
                                        columnNumber: 29
                                    }, this),
                                    message.role === 'user' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "w-8 h-8 bg-custom-cream/20 rounded-full flex items-center justify-center flex-shrink-0 order-2",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                            className: "w-4 h-4 text-custom-cream"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 220,
                                            columnNumber: 37
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 219,
                                        columnNumber: 33
                                    }, this)
                                ]
                            }, index, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 123,
                                columnNumber: 25
                            }, this)),
                        chatLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-center p-8",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                    className: "w-6 h-6 animate-spin text-custom-orange"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 228,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "ml-4 text-lg text-custom-cream",
                                    children: "Analyzing your story..."
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 229,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 227,
                            columnNumber: 25
                        }, this),
                        generatingVideos && videoUrls.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex gap-3 justify-start",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "w-8 h-8 bg-custom-orange rounded-full flex items-center justify-center flex-shrink-0",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"], {
                                        className: "w-4 h-4 text-custom-cream"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 238,
                                        columnNumber: 33
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 237,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "max-w-3xl order-2",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-custom-cream/5 border border-custom-orange/30 rounded-2xl p-4 mr-12",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                    className: "w-5 h-5 animate-spin text-custom-orange"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 244,
                                                    columnNumber: 41
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-custom-cream",
                                                    children: "Generating videos from your scenes..."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 245,
                                                    columnNumber: 41
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 243,
                                            columnNumber: 37
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 242,
                                        columnNumber: 33
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 241,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 236,
                            columnNumber: 25
                        }, this),
                        videoUrls.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "animate-in fade-in zoom-in duration-500 space-y-8 mt-8",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-3 text-custom-orange",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2d$big$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle$3e$__["CheckCircle"], {
                                                    className: "w-6 h-6"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 258,
                                                    columnNumber: 37
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-bold text-xl text-custom-orange",
                                                    children: "Video Generation Complete"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 259,
                                                    columnNumber: 37
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 257,
                                            columnNumber: 33
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: resetAnalysis,
                                            className: "text-sm text-custom-orange hover:text-orange-400 underline transition-colors",
                                            children: "Create New Video"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 263,
                                            columnNumber: 33
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 256,
                                    columnNumber: 29
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$VideoPlayer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    videoUrls: videoUrls,
                                    currentVideoIndex: currentVideoIndex,
                                    setCurrentVideoIndex: setCurrentVideoIndex
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 271,
                                    columnNumber: 29
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 255,
                            columnNumber: 25
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            ref: messagesEndRef
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 279,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 121,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 120,
                columnNumber: 13
            }, this),
            (chatError || videoError) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-4 bg-custom-orange/10 border-t border-custom-orange",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-4xl mx-auto",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 text-custom-orange",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "w-2 h-2 bg-custom-orange rounded-full animate-pulse"
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 288,
                                columnNumber: 29
                            }, this),
                            chatError || videoError
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 287,
                        columnNumber: 25
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 286,
                    columnNumber: 21
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 285,
                columnNumber: 17
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-shrink-0 p-4 bg-custom-bg",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-4xl mx-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex gap-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 relative",
                                children: [
                                    currentState === 'awaiting_story' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>setInputText('@Script '),
                                        className: "absolute bottom-3 left-3 bg-custom-orange text-custom-cream px-3 py-1 text-xs font-bold rounded hover:bg-orange-600 transition-colors z-10",
                                        children: "SCRIPT"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 301,
                                        columnNumber: 33
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                        value: inputText,
                                        onChange: (e)=>setInputText(e.target.value),
                                        placeholder: currentState === 'greeting' ? 'Loading...' : currentState === 'awaiting_story' ? 'Click SCRIPT and share your story or video idea...' : currentState === 'awaiting_enhancement_confirmation' ? 'Your response (yes/no)...' : currentState === 'awaiting_proceed_confirmation' ? 'Type "Proceed" to continue or provide feedback to regenerate scenes.' : 'Type your message...',
                                        className: "w-full h-20 bg-custom-bg text-custom-cream p-4 rounded-xl border-2 border-custom-orange/30 focus:border-custom-orange focus:outline-none resize-none placeholder-custom-cream/30 transition-all duration-300",
                                        disabled: chatLoading || ![
                                            'awaiting_story',
                                            'awaiting_enhancement_confirmation',
                                            'awaiting_proceed_confirmation'
                                        ].includes(currentState),
                                        onKeyDown: (e)=>{
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 308,
                                        columnNumber: 29
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: handleSendMessage,
                                        disabled: !inputText.trim() || chatLoading,
                                        className: "absolute bottom-3 right-3 bg-custom-orange p-2 rounded-lg text-custom-cream disabled:bg-custom-cream/10 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-110 active:scale-95",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__["Send"], {
                                            className: "w-5 h-5"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 332,
                                            columnNumber: 33
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 327,
                                        columnNumber: 29
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 299,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 298,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex justify-center mt-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: resetConversation,
                                className: "text-xs text-custom-orange hover:text-orange-400 transition-colors flex items-center gap-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                        className: "w-3 h-3"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 342,
                                        columnNumber: 29
                                    }, this),
                                    "Start New Conversation"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 338,
                                columnNumber: 25
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 337,
                            columnNumber: 21
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 297,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 296,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 103,
        columnNumber: 9
    }, this);
}
_s(Brick2Brick, "VyIgqJ95UijYCdMuoPTIwV4PCbQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useVideoGeneration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useVideoGeneration"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useChatFlow$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useChatFlow"]
    ];
});
_c = Brick2Brick;
var _c;
__turbopack_context__.k.register(_c, "Brick2Brick");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_b29d9411._.js.map