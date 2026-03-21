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
                
                // Aggregate image URLs
                const images = assetResults
                    .filter((r: any) => r.type === 'image')
                    .map((r: any) => r.output.images?.[0]?.url)
                    .filter(Boolean);
                
                const audioResult = assetResults.find((r: any) => r.type === 'audio');
                const audioUrl = audioResult?.output?.audio?.url || audioResult?.output?.audio_file?.url || '';

                // Merge images with moments timing data from Firestore
                const moments = jobData.moments || [];
                const imageTimeline = moments.map((moment: any, idx: number) => ({
                    start: moment.start,
                    end: moment.end,
                    topic: moment.topic || `Moment ${idx + 1}`,
                    prompt: moment.prompt || '',
                    imageUrl: images[idx] || null,  // Match image URL by index
                    layout: moment.layout || 'split'
                }));

                console.log(`🖼️ Built imageTimeline with ${imageTimeline.length} items`);

                // Resume Step Function with imageTimeline (not just images array)
                await sfnClient.send(new SendTaskSuccessCommand({
                    taskToken: taskToken,
                    output: JSON.stringify({
                        imageTimeline,  // Pass full timeline with timing data
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
        } else if (type === 'lipsync' || type === 'whisper-transcription') {
            // This is a LipSync or Whisper job - need to wait for both
            console.log(`📦 ${type} job completed: ${request_id}`);
            
            const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
            const jobDoc = await jobRef.get();
            
            if (!jobDoc.exists) {
                console.error(`❌ Job ${jobId} not found`);
                return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
            }

            const jobData = jobDoc.data() || {};
            const expectedLipsyncResults = jobData.expectedLipsyncResults || 1;
            const completedLipsyncResults = (jobData.completedLipsyncResults || 0) + 1;
            const lipsyncResults = jobData.lipsyncResults || [];
            
            // Store this result
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

            console.log(`� Lipsync progress: ${completedLipsyncResults}/${expectedLipsyncResults} jobs completed`);

            // Check if all lipsync-related jobs are ready
            if (completedLipsyncResults >= expectedLipsyncResults) {
                console.log(`✅ All lipsync jobs ready! Resuming Step Function...`);
                
                // Extract results
                const lipsyncResult = lipsyncResults.find((r: any) => r.type === 'lipsync');
                const whisperResult = lipsyncResults.find((r: any) => r.type === 'whisper-transcription');
                
                if (!lipsyncResult) {
                    console.error('❌ Lipsync result missing!');
                    return NextResponse.json({ success: false, error: 'Lipsync result missing' }, { status: 500 });
                }

                // Resume Step Function with both results
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

                // Cleanup mappings for both jobs
                await falJobRef.delete();
                if (whisperResult) {
                    await db.collection('falJobs').doc(whisperResult.request_id).delete();
                }
                if (lipsyncResult && lipsyncResult.request_id !== request_id) {
                    await db.collection('falJobs').doc(lipsyncResult.request_id).delete();
                }
            } else {
                // Still waiting for more results
                console.log(`⏳ Waiting for ${expectedLipsyncResults - completedLipsyncResults} more job(s)`);
                await falJobRef.delete();
            }

            return NextResponse.json({ success: true });
        } else {
            // Other single-response job types (fallback)
            console.log(`🚀 Resuming Step Function for Job ${jobId} (User: ${userId})`);
            
            await sfnClient.send(new SendTaskSuccessCommand({
                taskToken: taskToken,
                output: JSON.stringify({
                    request_id,
                    status,
                    output
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
