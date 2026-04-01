import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export interface Scene {
  scene: string;
  scene_objective: string;
  primary_visuals: string;
  emotional_tone: string;
  transition_logic: string;
  shots?: Shot[];
}

export interface Shot {
  shot_number: number;
  description: string;
  duration_seconds?: number;
  camera_movement?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const callWithRetry = async <T>(
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
      if (lastError.message.includes('429') || lastError.message.includes('rate limit') || lastError.message.includes('timeout')) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        await sleep(delay);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError!;
};

const repairJSON = (raw: string): object => {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();
  try { return JSON.parse(cleaned); } catch {}

  let repaired = cleaned;
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/]/g) || []).length;

  repaired = repaired.replace(/,\s*$/, '');
  const quotes = repaired.match(/(?<!\\)"/g) || [];
  if (quotes.length % 2 !== 0) repaired += '"';

  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

  try { return JSON.parse(repaired); } catch {}

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {
      let extracted = jsonMatch[0].replace(/,\s*$/, '');
      const ob = (extracted.match(/{/g) || []).length;
      const cb = (extracted.match(/}/g) || []).length;
      const oB = (extracted.match(/\[/g) || []).length;
      const cB = (extracted.match(/]/g) || []).length;
      const q = (extracted.match(/(?<!\\)"/g) || []);
      if (q.length % 2 !== 0) extracted += '"';
      for (let i = 0; i < oB - cB; i++) extracted += ']';
      for (let i = 0; i < ob - cb; i++) extracted += '}';
      return JSON.parse(extracted);
    }
  }
  throw new Error(`Could not parse or repair JSON`);
};

export const tryGeminiWithFallback = async (fullPrompt: string, duration: number = 60): Promise<Scene[]> => {
  const apiKeys = [
    process.env.GEMINI_API_KEY,      // Use secure backend keys!
    process.env.GOOGLE_API_KEY
  ].filter(Boolean);

  let lastError: Error;
  let sceneCount = duration === 10 ? 1 : duration === 20 ? 2 : duration === 30 ? 3 : 5;
  let durationInstructions = duration === 10 ? "exactly ONE self-contained cinematic scene (10s)" : 
    duration === 20 ? "exactly TWO self-contained cinematic scenes (10s each)" : 
    duration === 30 ? "exactly THREE self-contained cinematic scenes (10s each)" : 
    "exactly FIVE self-contained cinematic scenes (12s each)";

  for (const apiKey of apiKeys) {
    if (!apiKey) continue;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json", temperature: 0.5, maxOutputTokens: 8192 }
      });

      const prompt = `You are an elite film director following the LTX-2 Prompting Guide. Deconstruct the following enhanced story into ${durationInstructions} for a ${duration}s video.

Input Story: "${fullPrompt}"

IMPORTANT: If character information is provided in the input (marked by "Characters:"), you MUST:
1. Use the character names explicitly in scene_objective, primary_visuals, and shot descriptions
2. Reference character descriptions to ensure visual consistency (clothing, appearance, personality)
3. Incorporate character traits into the emotional_tone and actions
4. Maintain character consistency across ALL shots - same character should look and behave consistently

For each scene, provide a detailed, in-depth description as if it were a standalone prompt for the LTX AI model.

Requirements:
1.  **Scene Overview**: BRIEF description summarizing BOTH shots.
2.  **Two Distinct Shots Per Scene**.
3.  **Shot Details in Shots Array**.
4.  **Character Integration**. If characters are provided, describe thoroughly.
5.  **LTX-2 Guide Adherence**.
6.  **Self-Contained Scenes**.
7.  **Valid JSON Output**.
8.  **Avoid metaphorical language**.
9.  **Avoid abstract emotional commentary**.
10. **Write visually observable details only**.
11. **No symbolic interpretation**.
12. **Structure:** An array of ${sceneCount} objects under the key "scenes".
13. **Shots Array:** "shot_number" (1 or 2), "description", "duration_seconds", "camera_movement".
14. **Scene Object:** "scene", "scene_objective", "primary_visuals", "emotional_tone", "transition_logic", and "shots".

Return JSON only.`;

      const result = await callWithRetry(() => model.generateContent(prompt));
      const response = await result.response;
      const content = response.text();

      if (!content) throw new Error("No content received from Gemini");

      const parsed = repairJSON(content) as { scenes?: Scene[] };
      if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length !== sceneCount) {
        if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
          throw new Error("Invalid scene structure received");
        }
      }
      return parsed.scenes;
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }
  throw lastError!;
};

export const fallbackToGroq = async (fullPrompt: string): Promise<Scene[]> => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); // Secure backend key!
    const prompt = `You are an elite film director following the LTX-2 Prompting Guide. Deconstruct the following story into exactly THREE self-contained cinematic scenes (20s each) for a 60s video.\nInput Story: "${fullPrompt}"\nRequirements:\n1. Self-Contained. \n2. LTX-2 Guide. \n3. Valid JSON.\n4. Array of 3 objects under "scenes".\n5. Scene Object must have "scene", "scene_objective", "primary_visuals", "emotional_tone", and "transition_logic".\nReturn JSON only.`;
    const completion = await callWithRetry(() => groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    }));
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No content received from Groq");
    const parsed = repairJSON(content) as { scenes: Scene[] };
    return parsed.scenes;
  } catch (error) {
    throw error; // Will be caught by API route layer
  }
};
