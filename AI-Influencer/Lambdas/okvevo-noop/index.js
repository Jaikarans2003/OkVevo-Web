const admin = require('firebase-admin');

// Initialize Firebase
const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
if (!saBase64) {
    throw new Error("Missing Firebase Service Account Key (FIREBASE_SERVICE_ACCOUNT_KEY or FB_SERVICE_ACCOUNT_KEY)");
}
const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

exports.handler = async (event) => {
    console.log("⏳ SFN Wait Hook Triggered", JSON.stringify(event, null, 2));
    
    const { taskToken, fal_mode, jobId, userId } = event;

    // Save token to Firestore so UI can resume
    if (jobId && userId && taskToken) {
        console.log(`💾 Saving taskToken to users/${userId}/aiInfluencerJobs/${jobId}`);
        await db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId).set({
            waitTaskToken: taskToken,
            status: 'waiting-for-avatar'
        }, { merge: true });
    }

    if (fal_mode === "mock" && taskToken) {
        console.log("🛠️ MOCK MODE DETECTED: Auto-resuming Step Function state machine!");
        
        try {
            const { SFNClient, SendTaskSuccessCommand } = require('@aws-sdk/client-sfn');
            const sfnClient = new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' });
            
            // Build a fake successful payload
            const mockOutput = {
                status: "COMPLETED",
                request_id: `mock-${Date.now()}`,
                mock: true,
                fal_mode: "mock",
                jobId,
                userId,
                avatarVideoUrl: "https://storage.googleapis.com/text2video-16cbf.firebasestorage.app/AIInfluencer/mock/avatar.mp4"
            };

            await sfnClient.send(new SendTaskSuccessCommand({
                taskToken: taskToken,
                output: JSON.stringify(mockOutput)
            }));
            
            console.log("✅ Mock auto-resume successful.");
            return { status: "auto-resumed-mock" };
        } catch (error) {
            console.error("❌ Failed to auto-resume step function in mock mode:", error);
            return { status: "mock-resume-failed", error: error.message };
        }
    }

    return { status: "waiting" };
};
