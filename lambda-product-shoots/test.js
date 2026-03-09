const { GoogleGenAI } = require('@google/genai');

async function testGenerate() {
    console.log('API Key available:', !!process.env.GEMINI_API_KEY);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const dummyImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const contentParts = [
        { text: 'masterPrompt' },
        { text: 'Here is the product to photograph. Use this exact product in the generated shot:' },
        {
            inlineData: {
                mimeType: 'image/png',
                data: dummyImageBase64,
            },
        },
        { text: 'Generate a stunning, photorealistic professional product photograph' },
    ];

    console.log('Calling Gemini...');
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contentParts,
        });

        console.log('Success, response received for gemini-2.5-flash with inlineData');
    } catch (e) {
        console.error('Error:', e);
    }
}

testGenerate();
