import { NextRequest, NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Director Photos API Route — SQS Dispatch
 *
 * Dispatches shot photo generation jobs to the dedicated SQS FIFO queue.
 * The Lambda consumer will:
 *   1. Call NANOBANANA PRO (Gemini) with the shot prompt
 *   2. Upload the generated photo to DirectorPhotos/{jobId}.png
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, masterPrompt, userId, outputPath } = body;

        if (!jobId || !masterPrompt) {
            return NextResponse.json(
                { success: false, error: 'jobId and masterPrompt are required' },
                { status: 400 }
            );
        }

        // ── SQS Configuration ──────────────────────────────────
        const queueUrl = process.env.SQS_DIRECTOR_PHOTO_QUEUE_URL;
        const awsRegion = process.env.AWS_REGION || 'us-east-1';
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!queueUrl || !awsAccessKeyId || !awsSecretAccessKey) {
            console.warn('⚠️ Director Photo SQS not configured — running in mock mode');
            return NextResponse.json({
                success: true,
                jobId,
                message: 'Director photo job acknowledged (SQS not configured, mock mode)',
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
            type: 'director-photo',
            jobId,
            masterPrompt,
            outputPath: outputPath || `DirectorPhotos/${jobId}.png`,
            userId: userId || 'anonymous',
            timestamp: new Date().toISOString(),
        });

        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: userId || 'director-default',
            MessageDeduplicationId: `${jobId}-${Date.now()}`,
        });

        console.log('📸 Dispatching director-photo job to SQS FIFO:', {
            jobId,
            userId: userId || 'anonymous',
            promptLength: masterPrompt.length,
            outputPath: outputPath || `DirectorPhotos/${jobId}.png`,
            queueUrl,
        });

        const result = await sqsClient.send(command);
        console.log('✅ Director photo SQS message sent:', result.MessageId);

        return NextResponse.json({
            success: true,
            jobId,
            messageId: result.MessageId,
            message: 'Director photo job dispatched to SQS FIFO queue',
        });

    } catch (error) {
        console.error('Director photo SQS dispatch error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
