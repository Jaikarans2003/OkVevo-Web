require('dotenv').config({ path: 'c:/Users/hrudh/OneDrive/Desktop/Brick2Brick/.env' });
const { GoogleGenAI } = require('@google/genai');

async function testGenerate() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    console.log('Calling Gemini...');
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview', // Or whatever model was configured
            contents: [{ text: 'Generate a picture of a cat.' }],
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
            },
        });
        console.log('Success:', responseText);
    } catch (e) {
        console.error('Error:', e);
    }
}

testGenerate();
