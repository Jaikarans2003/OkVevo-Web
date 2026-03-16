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
    // Note: 'event' here will contain the output from the 'Wait_For_Assets' state
    // Which includes the TTS URL and the original jobId/userId
    const { jobId, userId, avatarVideoUrl, taskToken, ttsUrl } = event;
    
    console.log(`🎬 Submitting LipSync job for Job: ${jobId}`);

    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fal/webhook`;
    const falApiKey = process.env.FAL_API_VIDEO || process.env.FAL_API_KEY;

    if (event.fal_mode === "mock") {
        console.log("🛠️ MOCK MODE: Submitting fake LipSync job. Waiting for manual webhook POST...");

        // Generate a deterministic fake request ID so it's easy to copy into Postman
        const mockRequestId = `mock-lipsync-${jobId}`;

        // Write to falJobs — identical to production
        await db.collection('falJobs').doc(mockRequestId).set({
            userId,
            jobId,
            taskToken,
            type: 'lipsync'
        });

        // Update job status — identical to production
        await db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId).update({
            status: 'submitting-lipsync',
            lipSyncRequestId: mockRequestId
        });

        // Log clearly for developer to copy into Postman
        console.log("════════════════════════════════════════════════════");
        console.log("🛠️  MOCK MODE — Waiting for manual LipSync webhook POST");
        console.log("════════════════════════════════════════════════════");
        console.log(`Webhook URL: ${process.env.NEXT_PUBLIC_BASE_URL}/api/fal/webhook`);
        console.log("Send this POST body to the webhook URL:");
        console.log(`  request_id: "${mockRequestId}"`);
        const bucket = process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';
        console.log(`  Mock lipsync video URL: https://storage.googleapis.com/${bucket}/AIInfluencer/mock/avatar.mp4`);
        console.log("════════════════════════════════════════════════════");
        console.log("✅ MOCK MODE: Lambda done. Step Function is now paused, waiting for your webhook POST.");

        // DO NOT call SendTaskSuccess — let the webhook resume after your manual POST
        return { status: "mock-submitted", mockRequestId };
    }

    // Submit LipSync job to Fal AI
    const submitResponse = await httpsRequest('https://queue.fal.run/veed/lipsync', {
        method: 'POST',
        headers: {
            'Authorization': `Key ${falApiKey}`,
            'Content-Type': 'application/json',
        }
    }, {
        video_url: avatarVideoUrl,
        audio_url: ttsUrl,
        webhook_url: webhookUrl
    });

    if (submitResponse.statusCode !== 200) {
        throw new Error(`Fal AI LipSync submit failed: ${JSON.stringify(submitResponse.body)}`);
    }

    const { request_id } = submitResponse.body;
    console.log(`✅ LipSync job submitted: ${request_id}`);

    // Store taskToken for the LipSync webhook
    await db.collection('falJobs').doc(request_id).set({
        userId,
        jobId,
        taskToken,
        type: 'lipsync'
    });

    // Update job status
    await db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId).update({
        status: 'submitting-lipsync',
        lipSyncRequestId: request_id
    });

    console.log(`✅ LipSync job submitted. Waiting for webhook to resume Step Function...`);
    // DO NOT RETURN - Let webhook resume the Step Function via SendTaskSuccess
};
