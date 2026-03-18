const admin = require('firebase-admin');
const https = require('https');

// Initialize Firebase
const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
if (!saBase64) {
    throw new Error("Missing Firebase Service Account Key (FIREBASE_SERVICE_ACCOUNT_KEY or FB_SERVICE_ACCOUNT_KEY)");
}
const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
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
    const { jobId, userId, duration, taskToken, script, moments, audioSampleUrl } = event;
    console.log(`🚀 Starting AI Prep for Job: ${jobId}`);
    
    // Validate required inputs
    if (!script || !script.trim()) {
        throw new Error('Script is required. Script must be generated in Next.js before calling this Lambda.');
    }
    
    if (!moments || !Array.isArray(moments) || moments.length === 0) {
        throw new Error('Moments are required. Moments must be generated in Next.js before calling this Lambda.');
    }

    const scriptText = script.trim();
    console.log(`📝 Script: ${scriptText.length} chars`);
    console.log(`🖼️ Moments: ${moments.length} items`);


    // Use a simplified logic: for the demo, we assume we need 3 images and 1 TTS
    // In a real scenario, we'd map moments to Fal jobs.
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fal/webhook`;
    const falApiKey = process.env.FAL_API_IMAGE || process.env.FAL_API_KEY;

    const imageJobs = moments.slice(0, 3).map(m => {
        return httpsRequest('https://queue.fal.run/fal-ai/nano-banana-2', {
            method: 'POST',
            headers: { 'Authorization': `Key ${falApiKey}`, 'Content-Type': 'application/json' }
        }, {
            prompt: m.prompt,
            image_size: "landscape_4_3",
            webhook_url: webhookUrl
        });
    });

    // Use user's uploaded voice for cloning with Resemble AI ChatterboxHD (optional)
    const ttsPayload = {
        text: scriptText,
        webhook_url: webhookUrl
    };
    
    // Only add audio_url if user provided a voice for cloning
    if (audioSampleUrl) {
        ttsPayload.audio_url = audioSampleUrl;
        console.log(`🎤 Using user voice for cloning: ${audioSampleUrl}`);
    } else {
        console.log(`🎤 No voice provided, using default TTS voice`);
    }
    
    const ttsJob = httpsRequest('https://queue.fal.run/resemble-ai/chatterboxhd/text-to-speech', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falApiKey}`, 'Content-Type': 'application/json' }
    }, ttsPayload);

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
    batch.set(jobRef, { 
        script: scriptText, 
        moments, 
        status: 'preparing-assets',
        expectedAssets: requestIds.length,
        completedAssets: 0,
        taskToken
    }, { merge: true });

    await batch.commit();

    console.log(`✅ AI Prep complete. Submitted ${responses.length} Fal jobs. Waiting for webhooks...`);
    // DO NOT RETURN - Let webhooks resume the Step Function via SendTaskSuccess
};
