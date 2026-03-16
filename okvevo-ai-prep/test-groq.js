const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

// Manually read .env from root
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim();
});

async function testGroq() {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY });
    const model = 'llama-3.3-70b-versatile';
    const duration = 30;
    const topic = "Benefits of AI in healthcare";

    console.log("🚀 Testing Script Generation...");
    const scriptPrompt = `Generate a compelling ${duration}-second explainer video script about "${topic}". Output only the narration text.`;
    const scriptChat = await groq.chat.completions.create({
        messages: [{ role: 'user', content: scriptPrompt }],
        model: model,
    });
    const scriptText = scriptChat.choices[0]?.message?.content?.trim();
    console.log("📜 Generated Script:", scriptText);

    console.log("\n🚀 Testing Moments Extraction...");
    const momentsPrompt = `Given this script: "${scriptText}", extract visual moments for a ${duration}s video. 
    Output ONLY a JSON array of objects: [{ start: number, end: number, prompt: string }]. No other text.`;
    const momentsChat = await groq.chat.completions.create({
        messages: [{ role: 'user', content: momentsPrompt }],
        model: model,
        response_format: { type: "json_object" }
    });
    
    try {
        const content = momentsChat.choices[0]?.message?.content;
        const parsed = JSON.parse(content);
        const moments = Array.isArray(parsed) ? parsed : (parsed.moments || Object.values(parsed)[0]);
        console.log("✅ Parsed Moments:", JSON.stringify(moments, null, 2));
    } catch (e) {
        console.error("❌ Failed to parse moments:", e);
        console.log("Raw content:", momentsChat.choices[0]?.message?.content);
    }
}

testGroq();
