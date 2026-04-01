import { NextRequest, NextResponse } from 'next/server';
import { SFNClient, SendTaskSuccessCommand } from '@aws-sdk/client-sfn';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
    if (!saBase64) {
        throw new Error("Missing Firebase Service Account Key (FIREBASE_SERVICE_ACCOUNT_KEY or FB_SERVICE_ACCOUNT_KEY)");
    }
    const serviceAccount = JSON.parse(
        Buffer.from(saBase64, 'base64').toString('utf-8')
    );
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const sfnClient = new SFNClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

/**
 * Fal AI Webhook Handler
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { request_id, status, output, error } = body;

        console.log(`[VEVO] Fal AI Webhook received for job ${request_id}: ${status}`);

        const normalizedStatus = (status || '').toUpperCase();

        if (normalizedStatus !== 'COMPLETED') {
            console.warn(`[VEVO] ⚠️ Job ${request_id} failed with status ${status}: ${error || 'No specific error'}`);
            
            // Find the job in Firestore to update status
            const db = admin.firestore();
            const falJobRef = db.collection('falJobs').doc(request_id);
            const falJobDoc = await falJobRef.get();

            if (falJobDoc.exists) {
                const { userId, jobId, type } = falJobDoc.data() || {};
                if (userId && jobId) {
                    const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
                    
                    // Detailed Error Code Detection (404, 500, 422, etc.)
                    let errorCode = 'UNKNOWN';
                    let errorDetails = error || status;
                    
                    if (error) {
                        if (error.includes('404')) errorCode = '404 (Not Found)';
                        else if (error.includes('500')) errorCode = '500 (Internal Server Error)';
                        else if (error.includes('422')) errorCode = '422 (Unprocessable Entity - Check Input)';
                        else if (error.includes('401') || error.includes('403')) errorCode = 'AUTH_ERROR';
                    }

                    const errorMessage = `[VEVO] Major Error ${errorCode}: Fal AI ${type} job failed. Details: ${errorDetails}`;

                    await jobRef.update({
                        status: 'error',
                        errorMessage: errorMessage,
                        errorCode: errorCode,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    console.log(`[VEVO] ❌ Updated Job ${jobId} status to error (${errorCode}) due to Fal AI failure`);
                }
                // Cleanup the mapping
                await falJobRef.delete();
            }

            return NextResponse.json({ success: true });
        }

        const db = admin.firestore();
        const falJobRef = db.collection('falJobs').doc(request_id);
        const falJobDoc = await falJobRef.get();

        if (!falJobDoc.exists) {
            console.error(`[VEVO] ❌ No task mapping found for Fal request_id: ${request_id}`);
            return NextResponse.json({ success: false, error: 'Job mapping not found' }, { status: 404 });
        }

        const { taskToken, userId, jobId, type } = falJobDoc.data() || {};

        if (!taskToken) {
            console.error(`[VEVO] ❌ No taskToken found for request_id: ${request_id}`);
            return NextResponse.json({ success: false, error: 'Task token missing' }, { status: 400 });
        }

        // 2. Handle different job types
        if (type === 'ai-prep') {
            console.log(`[VEVO] 📦 AI_Prep asset completed: ${request_id}`);
            
            const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
            const jobDoc = await jobRef.get();
            
            if (!jobDoc.exists) {
                console.error(`[VEVO] ❌ Job ${jobId} not found`);
                return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
            }

            const jobData = jobDoc.data() || {};
            const expectedAssets = jobData.expectedAssets || 0;
            const completedAssets = (jobData.completedAssets || 0) + 1;
            const assetResults = jobData.assetResults || [];

            assetResults.push({
                request_id,
                output,
                type: output.images ? 'image' : 'audio'
            });

            await jobRef.update({
                completedAssets,
                assetResults,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[VEVO] 📊 AI_Prep progress: ${completedAssets}/${expectedAssets} assets completed`);

            if (completedAssets >= expectedAssets) {
                console.log(`[VEVO] ✅ All AI_Prep assets ready! Resuming Step Function...`);
                
                const images = assetResults
                    .filter((r: any) => r.type === 'image')
                    .map((r: any) => r.output.images?.[0]?.url)
                    .filter(Boolean);
                
                const audioResult = assetResults.find((r: any) => r.type === 'audio');
                const audioUrl = audioResult?.output?.audio?.url || audioResult?.output?.audio_file?.url || '';

                const moments = jobData.moments || [];
                const imageTimeline = moments.map((moment: any, idx: number) => ({
                    start: moment.start,
                    end: moment.end,
                    topic: moment.topic || `Moment ${idx + 1}`,
                    prompt: moment.prompt || '',
                    imageUrl: images[idx] || null,
                    layout: moment.layout || 'split'
                }));

                await sfnClient.send(new SendTaskSuccessCommand({
                    taskToken: taskToken,
                    output: JSON.stringify({
                        imageTimeline,
                        audioUrl,
                        jobId,
                        userId,
                        status: 'COMPLETED'
                    }),
                }));

                await falJobRef.delete();
            } else {
                await falJobRef.delete();
            }

            return NextResponse.json({ success: true });
        } else if (type === 'lipsync' || type === 'whisper-transcription') {
            console.log(`[VEVO] 📦 ${type} job completed: ${request_id}`);
            
            const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
            const jobDoc = await jobRef.get();
            
            if (!jobDoc.exists) {
                console.error(`[VEVO] ❌ Job ${jobId} not found`);
                return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
            }

            const jobData = jobDoc.data() || {};
            const expectedLipsyncResults = jobData.expectedLipsyncResults || 1;
            const completedLipsyncResults = (jobData.completedLipsyncResults || 0) + 1;
            const lipsyncResults = jobData.lipsyncResults || [];
            
            lipsyncResults.push({
                request_id,
                type,
                output
            });
            
            await jobRef.update({
                completedLipsyncResults,
                lipsyncResults,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[VEVO] 📊 Lipsync progress: ${completedLipsyncResults}/${expectedLipsyncResults} jobs completed`);

            if (completedLipsyncResults >= expectedLipsyncResults) {
                console.log(`[VEVO] ✅ All lipsync jobs ready! Resuming Step Function...`);
                
                const lipsyncResult = lipsyncResults.find((r: any) => r.type === 'lipsync');
                const whisperResult = lipsyncResults.find((r: any) => r.type === 'whisper-transcription');
                
                if (!lipsyncResult) {
                    return NextResponse.json({ success: false, error: 'Lipsync result missing' }, { status: 500 });
                }

                await sfnClient.send(new SendTaskSuccessCommand({
                    taskToken: taskToken,
                    output: JSON.stringify({
                        request_id,
                        status,
                        output: lipsyncResult.output,
                        lipSyncVideoUrl: lipsyncResult.output.video?.url || lipsyncResult.output.video_url || '',
                        transcription: whisperResult?.output?.text || '',
                        transcriptionChunks: whisperResult?.output?.chunks || []
                    }),
                }));

                await falJobRef.delete();
                if (whisperResult) {
                    await db.collection('falJobs').doc(whisperResult.request_id).delete();
                }
                if (lipsyncResult && lipsyncResult.request_id !== request_id) {
                    await db.collection('falJobs').doc(lipsyncResult.request_id).delete();
                }
            } else {
                await falJobRef.delete();
            }

            return NextResponse.json({ success: true });
        } else {
            console.log(`[VEVO] 🚀 Resuming Step Function for Job ${jobId}`);
            
            await sfnClient.send(new SendTaskSuccessCommand({
                taskToken: taskToken,
                output: JSON.stringify({
                    request_id,
                    status,
                    output
                }),
            }));

            await falJobRef.delete();
            return NextResponse.json({ success: true });
        }

    } catch (error: any) {
        console.error('[VEVO] ❌ Webhook processing error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
