import { GoogleGenerativeAI } from '@google/generative-ai';
import { callWithRetry } from './ai-server';

export interface NarrationSegment {
    text: string;
    startTime: number;
    endTime: number;
    sceneIndex: number;
}

export interface NarrationScript {
    fullNarration: string;
    segments: NarrationSegment[];
    estimatedDuration: number;
}

export const generateDirectNarrationServer = async (userScript: string) => {
    const apiKey = process.env.GEMINI_API_KEY; // Secure backend key!
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
        { model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json", temperature: 0.7 } },
        { timeout: 10000 }
    );

    const prompt = `You are a professional narrator and video director. Transform this user script into a compelling 1-minute narration for a video.
User Script: "${userScript}"

Your task:
1. Create a documentary-style, story-driven narration (150-180 words total)
2. Internally break the story into 3 cinematic scenes (20s each) for video generation
3. Create narration segments that match each scene
4. Optimize text for TTS (natural speech, proper punctuation)

Requirements:
- Engaging narrative voice
- TTS-friendly - use commas for pauses, avoid complex words
- 60-second pacing - ~30 words per 20-second segment

Return JSON ONLY:
{
  "narration": {
    "fullNarration": "complete narration as one flowing text",
    "segments": [
      {
        "text": "narration for scene 1",
        "startTime": 0,
        "endTime": 20,
        "sceneIndex": 0
      },
      ...
    ],
    "estimatedDuration": 60
  },
  "internalScenes": [
    {
      "scene": "Scene 1 (0-20s)",
      "scene_objective": "brief objective",
      "primary_visuals": "detailed visual description for video generation",
      "emotional_tone": "mood",
      "transition_logic": "transition type"
    },
    ...
  ]
}`;

    const parsedData: any = await callWithRetry(async () => {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();
        if (!content) throw new Error("No content received from Gemini");
        return JSON.parse(content);
    }, 3, 1000);

    return parsedData;
};
