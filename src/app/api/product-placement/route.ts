import { NextRequest, NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Product Placement API Route
 *
 * Dispatches a compositing job to the SQS FIFO queue, just like
 * the video stitching pipeline. MessageGroupId is set to `userId`
 * to prevent cross-user job interference.
 *
 * In production a Lambda consumer would:
 *   1. Read the message from SQS
 *   2. Call NANOBANANA PRO with the master prompt
 *   3. Upload the composite image to Firebase Storage
 *
 * For the mock flow, the frontend polls `MockAIGeneratedPhotos/`
 * in Firebase Storage for a pre-stored test image.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, masterPrompt, userId } = body;

        if (!jobId || !masterPrompt) {
            return NextResponse.json(
                { success: false, error: 'jobId and masterPrompt are required' },
                { status: 400 }
            );
        }

        // ── SQS Configuration ──────────────────────────────────
        const queueUrl = process.env.SQS_PLACEMENT_QUEUE_URL;
        const awsRegion = process.env.AWS_REGION || 'us-east-1';
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!queueUrl || !awsAccessKeyId || !awsSecretAccessKey) {
            console.warn('⚠️ SQS not configured — running in mock mode');
            // Fallback to mock: just acknowledge the job
            return NextResponse.json({
                success: true,
                jobId,
                message: 'Compositing job acknowledged (SQS not configured, mock mode)',
                mock: true,
            });
        }

        // ── Real SQS Dispatch ──────────────────────────────────
        const sqsClient = new SQSClient({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
            },
        });

        const messageBody = JSON.stringify({
            type: 'product-placement',
            jobId,
            masterPrompt,
            userId: userId || 'anonymous',
            timestamp: new Date().toISOString(),
        });

        // FIFO queue: MessageGroupId = userId to prevent cross-user interference
        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: userId || 'default-user',     // FIFO ordering per user
            MessageDeduplicationId: `${jobId}-${Date.now()}`, // Prevent duplicates
        });

        console.log('📦 Dispatching product-placement job to SQS FIFO:', {
            jobId,
            userId: userId || 'anonymous',
            promptLength: masterPrompt.length,
            queueUrl,
        });

        const result = await sqsClient.send(command);
        console.log('✅ SQS message sent:', result.MessageId);

        return NextResponse.json({
            success: true,
            jobId,
            messageId: result.MessageId,
            message: 'Compositing job dispatched to SQS FIFO queue',
        });

    } catch (error) {
        console.error('Product Placement SQS dispatch error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
