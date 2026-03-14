const { SFNClient, SendTaskSuccessCommand } = require('@aws-sdk/client-sfn');

/**
 * AWS Lambda Handler: No-Op Wait Task
 * 
 * Used by Step Functions to pause execution (`.waitForTaskToken`).
 * The state machine passes in the TaskToken, which we log.
 * 
 * **MOCK MODE FIX**:
 * If `fal_mode` === "mock", this function will instantly turn around and
 * call SendTaskSuccess on ITSELF using the provided token, auto-advancing
 * the Step Function instantly instead of hanging for 15 minutes!
 */
exports.handler = async (event) => {
    console.log("⏳ SFN Wait Hook Triggered", JSON.stringify(event, null, 2));
    
    const { taskToken, fal_mode, jobId, userId } = event;

    if (fal_mode === "mock" && taskToken) {
        console.log("🛠️ MOCK MODE DETECTED: Auto-resuming Step Function state machine!");
        
        try {
            const sfnClient = new SFNClient({ region: process.env.AWS_REGION || 'us-east-1' });
            
            // Build a fake successful payload that mimics Fal AI webhooks
            const mockOutput = {
                status: "COMPLETED",
                request_id: `mock-${Date.now()}`,
                mock: true,
                fal_mode: "mock",
                jobId,
                userId,
                // These are passed down by okvevo-ai-prep in mock mode normally
                ttsUrl: "https://storage.googleapis.com/text2video-16cbf.firebasestorage.app/audio/narration-director-1771518209173-1771518226280.mp3",
                avatarVideoUrl: "https://storage.googleapis.com/text2video-16cbf.firebasestorage.app/AIInfluencer/mock/avatar.mp4",
                lipSyncVideoUrl: "https://storage.googleapis.com/text2video-16cbf.firebasestorage.app/AIInfluencer/mock/avatar.mp4"
            };

            await sfnClient.send(new SendTaskSuccessCommand({
                taskToken: taskToken,
                output: JSON.stringify(mockOutput)
            }));
            
            console.log("✅ Mock auto-resume successful.");
            return { status: "auto-resumed-mock" };
        } catch (error) {
            console.error("❌ Failed to auto-resume step function in mock mode:", error);
            // We don't throw, we just let it hang as it would normally
            return { status: "mock-resume-failed", error: error.message };
        }
    }

    // Normal live mode behavior: Do nothing, wait for actual Webhook
    return { status: "waiting" };
};
