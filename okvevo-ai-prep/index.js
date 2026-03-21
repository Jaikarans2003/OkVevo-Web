const admin = require('firebase-admin');
const https = require('https');
const { fal } = require('@fal-ai/client');

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

// Configure Fal AI client
fal.config({
    credentials: process.env.FAL_API_KEY || process.env.FAL_API_IMAGE
});

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
    const falApiKey = process.env.FAL_API_KEY || process.env.FAL_API_IMAGE;

    const startTime = Date.now();
    console.log(`⏱️ Starting job submissions at ${new Date().toISOString()}`);

    // Submit image jobs using Fal AI SDK
    const imageJobs = moments.slice(0, 3).map((m, idx) => {
        console.log(`🖼️ Submitting image job ${idx + 1}...`);
        return fal.queue.submit('fal-ai/nano-banana-2', {
            input: {
                prompt: m.prompt,
                image_size: "landscape_4_3"
            },
            webhookUrl: webhookUrl
        });
    });

    // Submit TTS job using Fal AI SDK
    const ttsInput = {
        text: scriptText
    };
    
    // Only add audio_url if user provided a voice for cloning
    if (audioSampleUrl) {
        ttsInput.audio_url = audioSampleUrl;
        console.log(`🎤 Using user voice for cloning: ${audioSampleUrl}`);
    } else {
        console.log(`🎤 No voice provided, using default TTS voice`);
    }
    
    console.log('📝 TTS Input:', JSON.stringify(ttsInput, null, 2));
    console.log('🔗 Webhook URL:', webhookUrl);
    
    let ttsJob;
    try {
        const ttsSubmitStart = Date.now();
        console.log(`🎙️ Submitting TTS job at ${new Date().toISOString()}...`);
        ttsJob = fal.queue.submit('resemble-ai/chatterboxhd/text-to-speech', {
            input: ttsInput,
            webhookUrl: webhookUrl
        });
        console.log(`✅ TTS job promise created successfully (${Date.now() - ttsSubmitStart}ms)`);
    } catch (error) {
        console.error('❌ TTS job submission failed:', error.message);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
    }

    const responses = await Promise.all([...imageJobs, ttsJob]);
    const totalTime = Date.now() - startTime;
    console.log(`📊 Received ${responses.length} responses from Fal AI in ${totalTime}ms`);
    
    // Step 4: Map request_ids to taskToken in Firestore
    const batch = db.batch();
    const requestIds = [];
    responses.forEach((res, idx) => {
        if (res.request_id) {
            const ref = db.collection('falJobs').doc(res.request_id);
            batch.set(ref, { userId, jobId, taskToken, type: 'ai-prep' });
            requestIds.push(res.request_id);
            const jobType = idx < imageJobs.length ? 'image' : 'tts';
            console.log(`✅ Job ${idx + 1} (${jobType}): ${res.request_id}`);
        } else {
            console.warn(`⚠️ Job ${idx + 1}: Missing request_id`, res);
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
        requestIds: requestIds,
        processingLock: false,
        taskToken
    }, { merge: true });

    await batch.commit();

    console.log(`✅ AI Prep complete. Submitted ${responses.length} Fal jobs. Waiting for webhooks...`);
    // DO NOT RETURN - Let webhooks resume the Step Function via SendTaskSuccess
};
