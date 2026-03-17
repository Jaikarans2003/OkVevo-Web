const admin = require('firebase-admin');
const Groq = require('groq-sdk');
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
    const { jobId, userId, topic, duration, avatarVideoUrl, taskToken, script: providedScript, gender, audioSampleUrl } = event;
    console.log(`🚀 Starting AI Prep for Job: ${jobId}`);
    console.log(`📝 Script provided: ${providedScript ? 'YES (Phase 2)' : 'NO (generating now)'}`);

    // ⚡ MOCK MODE - Submit fake Fal jobs and WAIT for manual webhook trigger
    // DO NOT auto-resume. Write fake request_ids to Firestore just like production,
    // then exit. The developer will use Postman to POST to /api/fal/webhook with
    // each fake request_id to simulate Fal AI callbacks and advance the pipeline.
    if (event.fal_mode === "mock") {
        console.log("🛠️ MOCK MODE: Submitting fake Fal jobs. Waiting for manual webhook POSTs...");

        const bucket = process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';

        // Fake request IDs — one per image + one for TTS audio
        const mockImageIds = [
            `mock-image-0-${jobId}`,
            `mock-image-1-${jobId}`,
            `mock-image-2-${jobId}`,
        ];
        const mockTtsId = `mock-tts-${jobId}`;
        const allMockIds = [...mockImageIds, mockTtsId];

        // Write each fake request_id to falJobs — identical to what production does
        const batch = db.batch();
        allMockIds.forEach((reqId, i) => {
            const ref = db.collection('falJobs').doc(reqId);
            batch.set(ref, {
                userId,
                jobId,
                taskToken,
                type: 'ai-prep'
            });
        });

        // Update the main job document — identical to production flow
        const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
        batch.set(jobRef, {
            script: providedScript || '(mock script)',
            moments: [
                { start: 0, end: 5, prompt: 'mock scene 1' },
                { start: 5, end: 10, prompt: 'mock scene 2' },
                { start: 10, end: 15, prompt: 'mock scene 3' },
            ],
            status: 'preparing-assets',
            expectedAssets: allMockIds.length,
            completedAssets: 0,
            taskToken
        }, { merge: true });

        await batch.commit();

        // Log the fake request IDs clearly so developer can copy into Postman
        console.log("════════════════════════════════════════════════════");
        console.log("🛠️  MOCK MODE — Waiting for manual webhook POSTs");
        console.log("════════════════════════════════════════════════════");
        console.log(`Webhook URL: ${process.env.NEXT_PUBLIC_BASE_URL}/api/fal/webhook`);
        console.log("POST 3 image callbacks (use one of your mock image URLs):");
        mockImageIds.forEach(id => {
            console.log(`  request_id: "${id}"  (type: image)`);
        });
        console.log("POST 1 TTS audio callback:");
        console.log(`  request_id: "${mockTtsId}"  (type: audio)`);
        console.log("Mock image URL:  https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/InfluencerAssets%2Fmock1.jpg?alt=media");
        console.log("Mock audio URL:  https://firebasestorage.googleapis.com/v0/b/" + bucket + "/o/InfluencerAudio%2FAudio1.mpeg?alt=media");
        console.log("════════════════════════════════════════════════════");
        console.log("✅ MOCK MODE: Lambda done. Step Function is now paused, waiting for your webhook POSTs.");

        // DO NOT call SendTaskSuccess — let the webhook do it after your manual POST
        return { status: "mock-submitted", mockRequestIds: allMockIds };
    }

    let scriptText;
    let moments = [];

    // Phase 2: Check if script and moments were already generated and saved to Firestore
    if (providedScript && providedScript.trim()) {
        console.log('✅ Using provided script from Phase 1 (Next.js)');
        scriptText = providedScript.trim();
        
        // Check if moments were also provided
        if (event.moments && Array.isArray(event.moments) && event.moments.length > 0) {
            console.log('✅ Using provided moments from Phase 1 (Gemini)');
            moments = event.moments;
        } else {
            // Fallback: Try to read from Firestore
            console.log('📖 Reading moments from Firestore...');
            try {
                const jobDoc = await db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId).get();
                if (jobDoc.exists) {
                    const jobData = jobDoc.data();
                    if (jobData.moments && Array.isArray(jobData.moments)) {
                        moments = jobData.moments;
                        console.log(`✅ Loaded ${moments.length} moments from Firestore`);
                    }
                }
            } catch (err) {
                console.error('Failed to read moments from Firestore:', err);
            }
        }
        
        // If still no moments, generate them
        if (!moments || moments.length === 0) {
            console.log('⚠️ No moments found, extracting with Groq...');
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY });
            const model = 'llama-3.3-70b-versatile';
            
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
                moments = Array.isArray(parsed) ? parsed : (parsed.moments || Object.values(parsed)[0]);
            } catch (e) {
                console.error("Failed to parse moments JSON", e);
            }
        }
    } else {
        // Phase 1 (legacy): Generate script here (shouldn't happen with new flow)
        console.log('⚠️ No script provided, generating with Groq (legacy flow)');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY });
        const model = 'llama-3.3-70b-versatile';

        const scriptPrompt = `Generate a compelling ${duration}-second explainer video script about "${topic}". Output only the narration text.`;
        const scriptChat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: scriptPrompt }],
            model: model,
        });
        scriptText = scriptChat.choices[0]?.message?.content?.trim() || "(No script generated)";

        // Extract Moments
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
            moments = Array.isArray(parsed) ? parsed : (parsed.moments || Object.values(parsed)[0]);
        } catch (e) {
            console.error("Failed to parse moments JSON", e);
        }
    }

    console.log(`📝 Final script: ${scriptText.length} chars`);
    console.log(`🖼️ Final moments: ${moments.length} items`);


    // Use a simplified logic: for the demo, we assume we need 3 images and 1 TTS
    // In a real scenario, we'd map moments to Fal jobs.
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fal/webhook`;
    const falApiKey = process.env.FAL_API_IMAGE || process.env.FAL_API_KEY;

    const imageJobs = moments.slice(0, 3).map(m => {
        return httpsRequest('https://queue.fal.run/fal-ai/fal-ai/nano-banana-2', {
            method: 'POST',
            headers: { 'Authorization': `Key ${falApiKey}`, 'Content-Type': 'application/json' }
        }, {
            prompt: m.prompt,
            image_size: "landscape_4_3",
            webhook_url: webhookUrl
        });
    });

    // Use user's uploaded voice for cloning with Resemble AI ChatterboxHD (optional)
    const voiceUrl = event.voiceUrl || event.userVoiceUrl; // User-uploaded voice file URL
    
    const ttsPayload = {
        text: scriptText,
        webhook_url: webhookUrl
    };
    
    // Only add audio_url if user provided a voice for cloning
    if (voiceUrl) {
        ttsPayload.audio_url = voiceUrl;
        console.log(`🎤 Using user voice for cloning: ${voiceUrl}`);
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
