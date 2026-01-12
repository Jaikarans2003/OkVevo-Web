import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export interface Scene {
  scene: string;
  scene_objective: string;
  primary_visuals: string;
  emotional_tone: string;
  transition_logic: string;
}

// Retry logic with exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

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

  throw lastError!;
};

const tryGeminiWithFallback = async (fullPrompt: string): Promise<Scene[]> => {
  const apiKeys = [
    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  ].filter(Boolean);

  let lastError: Error;

  for (const apiKey of apiKeys) {
    if (!apiKey) continue; // Skip undefined keys

    try {
      console.log(`Trying Gemini API with key: ${apiKey.substring(0, 10)}...`);

      const genAI = new GoogleGenerativeAI(apiKey);
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

      const result = await callWithRetry(() => model.generateContent(prompt));
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
      lastError = error as Error;
      console.error(`Failed with key ${apiKey.substring(0, 10)}...:`, lastError.message);
      continue;
    }
  }

  throw lastError!;
};

const fallbackToGroq = async (fullPrompt: string): Promise<Scene[]> => {
  try {
    console.log('Falling back to Groq API...');
    const groq = new Groq({
      apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
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
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: "json_object" }
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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'greeting' | 'enhancement' | 'scenes' | 'scene_review';
}

export interface EnhancedStory {
  originalStory: string;
  enhancedPrompt: string;
  keyVisuals: string[];
  moodSuggestions: string[];
  cinematicElements: string[];
}

export const generateGreeting = async (): Promise<string> => {
  return "Welcome to TuneTalez! Share your story, and I'll help bring it to life.";
};

export const enhanceStory = async (userStory: string): Promise<EnhancedStory> => {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing NEXT_PUBLIC_GEMINI_API_KEY in .env file");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", temperature: 0.6 }
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

export const analyzeScenes = async (fullPrompt: string): Promise<Scene[]> => {
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
