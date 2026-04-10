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
    credentials: process.env.FAL_API_VIDEO || process.env.FAL_API_KEY
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
    // Note: 'event' here will contain the output from the 'Wait_For_Assets' state
    // Which includes the TTS URL and the original jobId/userId
    const { jobId, userId, avatarVideoUrl, taskToken, ttsUrl, script } = event;
    
    try {
        console.log(`🎬 Submitting LipSync job for Job: ${jobId}`);

        const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fal/webhook`;
        const falApiKey = process.env.FAL_API_VIDEO || process.env.FAL_API_KEY;

        // Submit LipSync job to Fal AI using SDK
        const lipsyncResult = await fal.queue.submit('veed/lipsync', {
            input: {
                video_url: avatarVideoUrl,
                audio_url: ttsUrl
            },
            webhookUrl: webhookUrl
        });

        const lipsyncRequestId = lipsyncResult.request_id;
        console.log(`✅ LipSync job submitted: ${lipsyncRequestId}`);

        // Submit Whisper transcription job to Fal AI using SDK
        const whisperResult = await fal.queue.submit('fal-ai/whisper', {
            input: {
                audio_url: ttsUrl,
                task: 'transcribe',
                chunk_level: 'word',
                batch_size: 64,
                num_speakers: null,
                prompt: script || ""
            },
            webhookUrl: webhookUrl
        });

        const whisperRequestId = whisperResult.request_id;
        console.log(`✅ Whisper transcription job submitted: ${whisperRequestId}`);

        // Store taskToken for both webhooks
        await db.collection('falJobs').doc(lipsyncRequestId).set({
            userId,
            jobId,
            taskToken,
            type: 'lipsync',
            model: 'veed/lipsync',
            jobType: 'lipsync'
        });

        await db.collection('falJobs').doc(whisperRequestId).set({
            userId,
            jobId,
            taskToken,
            type: 'whisper-transcription',
            model: 'fal-ai/whisper',
            jobType: 'whisper-transcription'
        });

        // Update job status to track both jobs
        // CRITICAL: taskToken must be stored here so okvevo-lipsync-recovery can call SendTaskSuccess
        await db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId).update({
            status: 'submitting-lipsync-and-transcription',
            lipSyncRequestId: lipsyncRequestId,
            whisperRequestId: whisperRequestId,
            expectedLipsyncResults: 2,
            completedLipsyncResults: 0,
            lipsyncResults: [],
            requestIds: [lipsyncRequestId, whisperRequestId],
            processingLock: false,
            taskToken: taskToken  // ✅ Required by lipsync-recovery to resume the Step Function
        });

        console.log(`✅ Both LipSync and Whisper jobs submitted. Waiting for 2 webhooks to resume Step Function...`);
    } catch (error) {
        console.error('❌ LipSync submission failed:', error.message);
        
        // Update job status to error in Firestore
        if (userId && jobId) {
            const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
            await jobRef.update({
                status: 'error',
                errorMessage: `LipSync Submission Failed: ${error.message}`,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        throw error;
    }
};
