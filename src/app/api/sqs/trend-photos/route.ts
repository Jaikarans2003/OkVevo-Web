import { NextRequest, NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Trend Photos API Route — SQS Dispatch
 *
 * Supports both legacy single-job and new pipeline dispatch.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, jobId, userId } = body;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Authorization required: userId is missing' },
                { status: 401 }
            );
        }

        if (!jobId) {
            return NextResponse.json(
                { success: false, error: 'jobId is required' },
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
                message: 'Trend job acknowledged (SQS not configured, mock mode)',
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

        // Forward the entire body as-is to the Lambda
        const messageBody = JSON.stringify({
            ...body,
            timestamp: new Date().toISOString(),
        });

        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: userId,
            MessageDeduplicationId: `${jobId}-${Date.now()}`,
        });

        console.log('🎬 Dispatching trend job to SQS FIFO:', {
            jobId,
            type: type || 'trend-photo',
            userId,
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
