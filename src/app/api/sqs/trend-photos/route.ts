import { NextRequest, NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Trend Photos API Route — SQS Dispatch
 *
 * Dispatches trend photo/video generation jobs to a dedicated SQS FIFO queue.
 * The Lambda consumer will:
 *   1. Download the person's image from Firebase Storage
 *   2. Call NANOBANANA PRO (Gemini) with the trend prompt + person's image
 *   3. Optionally call Kling 2.5 Turbo for video generation
 *   4. Upload results to TrendPhotos/{jobId}.png or .mp4
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            jobId,
            masterPrompt,
            personImageUrl,
            outputPath,
            shotName,
            userId,
            jobType,          // 'image' (default) or 'video'
            videoDuration,    // 5 or 10 seconds
        } = body;

        if (!jobId || !masterPrompt) {
            return NextResponse.json(
                { success: false, error: 'jobId and masterPrompt are required' },
                { status: 400 }
            );
        }

        // ── SQS Configuration ──────────────────────────────────
        const queueUrl = process.env.SQS_TREND_PHOTOS_QUEUE_URL;
        const awsRegion = process.env.AWS_REGION || 'us-east-1';
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!queueUrl || !awsAccessKeyId || !awsSecretAccessKey) {
            console.warn('⚠️ Trend Photos SQS not configured — running in mock mode');
            return NextResponse.json({
                success: true,
                jobId,
                message: 'Trend photo job acknowledged (SQS not configured, mock mode)',
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
            type: jobType === 'video' ? 'trend-video' : 'trend-photo',
            jobId,
            masterPrompt,
            personImageUrl: personImageUrl || null,
            outputPath: outputPath || `TrendPhotos/${jobId}.png`,
            shotName: shotName || 'Unknown Shot',
            userId: userId || 'anonymous',
            videoDuration: videoDuration || 5,
            timestamp: new Date().toISOString(),
        });

        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: userId || 'trend-default',
            MessageDeduplicationId: `${jobId}-${Date.now()}`,
        });

        console.log('🎬 Dispatching trend job to SQS FIFO:', {
            jobId,
            shotName,
            jobType: jobType || 'image',
            userId: userId || 'anonymous',
            promptLength: masterPrompt.length,
            hasPersonImage: !!personImageUrl,
            outputPath: outputPath || `TrendPhotos/${jobId}.png`,
            queueUrl,
        });

        const result = await sqsClient.send(command);
        console.log('✅ Trend SQS message sent:', result.MessageId);

        return NextResponse.json({
            success: true,
            jobId,
            messageId: result.MessageId,
            message: 'Trend job dispatched to SQS FIFO queue',
        });

    } catch (error) {
        console.error('Trend SQS dispatch error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
