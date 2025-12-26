import Groq from "groq-sdk";

export interface Scene {
  scene: string;
  scene_objective: string;
  primary_visuals: string;
  emotional_tone: string;
  transition_logic: string;
}

export const analyzeScenes = async (fullPrompt: string): Promise<Scene[]> => {
  try {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Missing VITE_GROQ_API_KEY in .env file");
    }

    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });

    const prompt = `You are an elite film director. Deconstruct the following concept into exactly THREE cinematic scenes (20s each) for a 60s video.

Input: "${fullPrompt}"

Requirements:
1. Output MUST be valid JSON only. No markdown, no commentary.
2. Structure: Array of 3 objects under key "scenes".
3. Each scene must have: "scene" (title/time), "scene_objective", "primary_visuals" (visually detailed), "emotional_tone", "transition_logic".
4. Ensure continuity between Scene 1 -> 2 -> 3.

Example Output format:
{
  "scenes": [
    { "scene": "Scene 1 (0-20s)", "scene_objective": "...", "primary_visuals": "...", "emotional_tone": "...", "transition_logic": "..." },
    { "scene": "Scene 2 (20-40s)", "scene_objective": "...", "primary_visuals": "...", "emotional_tone": "...", "transition_logic": "..." },
    { "scene": "Scene 3 (40-60s)", "scene_objective": "...", "primary_visuals": "...", "emotional_tone": "...", "transition_logic": "..." }
  ]
}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a JSON-speaking API. Output only valid JSON." },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      response_format: { type: "json_object" } // Force JSON mode
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No content received from Groq");

    console.log("Groq Response:", content);

    const parsed = JSON.parse(content);

    if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length !== 3) {
      throw new Error("Invalid scene structure received");
    }

    return parsed.scenes;

  } catch (err: any) {
    console.error('Groq Analysis Failed:', err);
    throw new Error(`AI Analysis Failed (Groq): ${err.message}`);
  }
};
