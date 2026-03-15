import { NextRequest, NextResponse } from 'next/server';
import { SFNClient, SendTaskSuccessCommand } from '@aws-sdk/client-sfn';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '', 'base64').toString('utf-8')
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
 * 
 * Researched Job Flow:
 * 1. Fal AI sends POST request when a job completes.
 * 2. We extract the request_id and status.
 * 3. We find the associated jobId/userId and taskToken in Firestore.
 * 4. We notify AWS Step Functions to resume.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { request_id, status, output, error } = body;

        console.log(` Fal AI Webhook received for job ${request_id}: ${status}`);

        const normalizedStatus = (status || '').toUpperCase();

        if (normalizedStatus !== 'COMPLETED') {
            console.warn(`⚠️ Job ${request_id} failed or is incomplete: ${error || status}`);
            // We might want to notify SFN about failure here using SendTaskFailure
            return NextResponse.json({ success: true }); // Still return 200 to Fal
        }

        // 1. Find the job in Firestore to get the taskToken
        // Note: In a production app, we'd ideally have a top-level 'falJobs' collection
        // or a way to query across users. For now, we assume we can find it.
        // SUGGESTION: Save a mapping in `falJobs/{request_id}` { userId, jobId, taskToken }
        
        const db = admin.firestore();
        const falJobRef = db.collection('falJobs').doc(request_id);
        const falJobDoc = await falJobRef.get();

        if (!falJobDoc.exists) {
            console.error(`❌ No task mapping found for Fal request_id: ${request_id}`);
            return NextResponse.json({ success: false, error: 'Job mapping not found' }, { status: 404 });
        }

        const { taskToken, userId, jobId, type } = falJobDoc.data() || {};

        if (!taskToken) {
            console.error(`❌ No taskToken found for request_id: ${request_id}`);
            return NextResponse.json({ success: false, error: 'Task token missing' }, { status: 400 });
        }

        // 2. Handle different job types
        if (type === 'ai-prep') {
            // This is an AI_Prep asset (image or TTS) - need to aggregate
            console.log(`📦 AI_Prep asset completed: ${request_id}`);
            
            const db = admin.firestore();
            const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
            const jobDoc = await jobRef.get();
            
            if (!jobDoc.exists) {
                console.error(`❌ Job ${jobId} not found`);
                return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
            }

            const jobData = jobDoc.data() || {};
            const expectedAssets = jobData.expectedAssets || 0;
            const completedAssets = (jobData.completedAssets || 0) + 1;
            const assetResults = jobData.assetResults || [];

            // Store this asset's result
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

            console.log(`📊 AI_Prep progress: ${completedAssets}/${expectedAssets} assets completed`);

            // Check if all assets are ready
            if (completedAssets >= expectedAssets) {
                console.log(`✅ All AI_Prep assets ready! Resuming Step Function...`);
                
                // Aggregate results
                const images = assetResults
                    .filter((r: any) => r.type === 'image')
                    .map((r: any) => r.output.images?.[0]?.url)
                    .filter(Boolean);
                
                const audioResult = assetResults.find((r: any) => r.type === 'audio');
                const audioUrl = audioResult?.output?.audio?.url || audioResult?.output?.audio_file?.url || '';

                // Resume Step Function with aggregated data
                await sfnClient.send(new SendTaskSuccessCommand({
                    taskToken: taskToken,
                    output: JSON.stringify({
                        images,
                        audioUrl,
                        jobId,
                        userId,
                        status: 'COMPLETED'
                    }),
                }));

                // Cleanup
                await falJobRef.delete();
            } else {
                // Still waiting for more assets
                await falJobRef.delete();
            }

            return NextResponse.json({ success: true });
        } else {
            // This is a LipSync job or other single-response job
            console.log(`🚀 Resuming Step Function for Job ${jobId} (User: ${userId})`);
            
            await sfnClient.send(new SendTaskSuccessCommand({
                taskToken: taskToken,
                output: JSON.stringify({
                    request_id,
                    status,
                    output,
                    lipSyncVideoUrl: output.video?.url || output.video_url || ''
                }),
            }));

            // Cleanup mapping
            await falJobRef.delete();

            return NextResponse.json({ success: true });
        }

    } catch (error: any) {
        console.error('❌ Webhook processing error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
