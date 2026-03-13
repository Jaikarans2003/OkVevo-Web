const admin = require('firebase-admin');
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
    // Note: 'event' here will contain the output from the 'Wait_For_Assets' state
    // Which includes the TTS URL and the original jobId/userId
    const { jobId, userId, avatarVideoUrl, taskToken, ttsUrl } = event;
    
    console.log(`🎬 Submitting LipSync job for Job: ${jobId}`);

    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fal/webhook`;
    const falApiKey = process.env.FAL_API_VIDEO || process.env.FAL_API_KEY;

    if (event.fal_mode === "mock") {
        console.log("🛠️ MOCK MODE ENABLED: Returning fake lipsync");
        const mockRequestId = "mock-lipsync";
        
        await db.collection('falJobs').doc(mockRequestId).set({
            userId,
            jobId,
            taskToken,
            type: 'lipsync'
        });

        await db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId).update({
            status: 'submitting-lipsync',
            lipSyncRequestId: mockRequestId
        });

        return { 
            success: true, 
            jobId, 
            request_id: mockRequestId,
            mock: true,
            video_url: "https://firebasestorage.googleapis.com/v0/b/text2video-16cbf.firebasestorage.app/o/final.mp4?alt=media&token=ea3eda9d-0e59-433d-bc85-8d8b16883f62" 
        };
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

    return { success: true, jobId, request_id };
};
