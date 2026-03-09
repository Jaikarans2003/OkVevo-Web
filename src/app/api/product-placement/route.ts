import { NextRequest, NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Product Placement API Route — SQS Dispatch
 *
 * Dispatches a compositing job to the SQS FIFO queue.
 * The Lambda consumer will:
 *   1. Download hero + scene images from Firebase Storage
 *   2. Call NANOBANANA PRO (Gemini) with the master prompt + images
 *   3. Upload the composite image to ProductPlacement/{jobId}.png
 *
 * MessageGroupId = userId for per-user FIFO ordering.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, masterPrompt, userId, heroImageUrl, sceneImageUrl, resolution, aspectRatio } = body;

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
            return NextResponse.json({
                success: true,
                jobId,
                message: 'Compositing job acknowledged (SQS not configured, mock mode)',
                mock: true,
            });
        }

        // ── Dispatch to SQS ────────────────────────────────────
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
            heroImageUrl: heroImageUrl || null,
            sceneImageUrl: sceneImageUrl || null,
            userId: userId || 'anonymous',
            resolution: resolution || '4K',
            aspectRatio: aspectRatio || '16:9',
            timestamp: new Date().toISOString(),
        });

        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: userId || 'default-user',
            MessageDeduplicationId: `${jobId}-${Date.now()}`,
        });

        console.log('📦 Dispatching product-placement job to SQS FIFO:', {
            jobId,
            userId: userId || 'anonymous',
            promptLength: masterPrompt.length,
            hasImages: !!(heroImageUrl && sceneImageUrl),
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
