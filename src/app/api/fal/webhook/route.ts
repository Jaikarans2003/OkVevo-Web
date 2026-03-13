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

        const { taskToken, userId, jobId } = falJobDoc.data() || {};

        if (!taskToken) {
            console.error(`❌ No taskToken found for request_id: ${request_id}`);
            return NextResponse.json({ success: false, error: 'Task token missing' }, { status: 400 });
        }

        // 2. Resume Step Function
        console.log(`🚀 Resuming Step Function for Job ${jobId} (User: ${userId})`);
        
        await sfnClient.send(new SendTaskSuccessCommand({
            taskToken: taskToken,
            output: JSON.stringify({
                request_id,
                status,
                output,
            }),
        }));

        // 3. Cleanup mapping (optional but recommended)
        await falJobRef.delete();

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('❌ Webhook processing error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
