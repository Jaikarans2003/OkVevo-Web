const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const https = require('https');

// Initialize Firebase
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app'
    });
}

const db = admin.firestore();

function httpsRequest(url, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const reqOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        };
        const req = https.request(reqOptions, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const str = buffer.toString();
                try { resolve({ statusCode: res.statusCode, body: JSON.parse(str) }); }
                catch { resolve({ statusCode: res.statusCode, body: str }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

exports.handler = async (event) => {
    const { jobId, userId, topic, duration, avatarVideoUrl, taskToken } = event;
    console.log(`🚀 Starting AI Prep for Job: ${jobId}`);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Step 1: Generate Script
    const scriptPrompt = `Generate a compelling ${duration}-second explainer video script about "${topic}". Output only the narration text.`;
    const scriptResult = await model.generateContent(scriptPrompt);
    const scriptText = scriptResult.response.text().trim();

    // Step 2: Extract Moments
    const momentsPrompt = `Given this script: "${scriptText}", extract visual moments for a ${duration}s video. 
    Output ONLY a JSON array of objects: { start: number, end: number, prompt: string }.`;
    const momentsResult = await model.generateContent(momentsPrompt);
    let moments = [];
    try {
        const text = momentsResult.response.text();
        moments = JSON.parse(text.substring(text.indexOf('['), text.lastIndexOf(']') + 1));
    } catch (e) {
        console.error("Failed to parse moments JSON", e);
    }

    // Step 3: Submit Fal Jobs (Parallel)
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fal/webhook`;
    const falApiKey = process.env.FAL_API_KEY;

    if (event.fal_mode === "mock") {
        console.log("🛠️ MOCK MODE ENABLED: Auto-resuming with fake assets");
        const bucket = process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';
        const fakeImages = [
            `https://storage.googleapis.com/${bucket}/InfluencerAssets/mock1.jpg`,
            `https://storage.googleapis.com/${bucket}/InfluencerAssets/mock2.jpg`,
            `https://storage.googleapis.com/${bucket}/InfluencerAssets/mock3.jpg`
        ];
        const fakeAudio = `https://storage.googleapis.com/${bucket}/InfluencerAudio/Audio1.mpeg`;

        // Update job status
        const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
        await jobRef.update({ script: scriptText, moments, status: 'preparing-assets' });

        // Immediately resume Step Function with mock data
        const { SFNClient, SendTaskSuccessCommand } = require('@aws-sdk/client-sfn');
        const sfnClient = new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' });

        await sfnClient.send(new SendTaskSuccessCommand({
            taskToken: taskToken,
            output: JSON.stringify({
                images: fakeImages,
                audioUrl: fakeAudio,
                jobId,
                userId,
                status: 'COMPLETED',
                mock: true
            })
        }));

        console.log("✅ Mock mode: Step Function resumed with fake assets");
        return { status: "mock-resumed" };
    }

    // Use a simplified logic: for the demo, we assume we need 3 images and 1 TTS
    // In a real scenario, we'd map moments to Fal jobs.
    const imageJobs = moments.slice(0, 3).map(m => {
        return httpsRequest('https://queue.fal.run/fal-ai/flux/schnell', {
            method: 'POST',
            headers: { 'Authorization': `Key ${falApiKey}`, 'Content-Type': 'application/json' }
        }, {
            prompt: m.prompt,
            image_size: "landscape_4_3",
            webhook_url: webhookUrl
        });
    });

    const ttsJob = httpsRequest('https://queue.fal.run/fal-ai/playht/tts/v3', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falApiKey}`, 'Content-Type': 'application/json' }
    }, {
        input: scriptText,
        voice: "s3://voice-cloning-zero-shot/d9ff78ba-d016-41f6-b092-2300259e1dff/original/manifest.json",
        webhook_url: webhookUrl
    });

    const responses = await Promise.all([...imageJobs, ttsJob]);
    
    // Step 4: Map request_ids to taskToken in Firestore
    const batch = db.batch();
    const requestIds = [];
    responses.forEach(res => {
        if (res.body.request_id) {
            const ref = db.collection('falJobs').doc(res.body.request_id);
            batch.set(ref, { userId, jobId, taskToken, type: 'ai-prep' });
            requestIds.push(res.body.request_id);
        }
    });

    // Store job metadata to track webhook completion
    const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
    batch.update(jobRef, { 
        script: scriptText, 
        moments, 
        status: 'preparing-assets',
        expectedAssets: requestIds.length,
        completedAssets: 0,
        taskToken
    });

    await batch.commit();

    console.log(`✅ AI Prep complete. Submitted ${responses.length} Fal jobs. Waiting for webhooks...`);
    // DO NOT RETURN - Let webhooks resume the Step Function via SendTaskSuccess
};
