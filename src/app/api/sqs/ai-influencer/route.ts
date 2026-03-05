import { NextRequest, NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * AI Influencer API Route — SQS Dispatch
 *
 * Dispatches AI Influencer video generation jobs to the dedicated SQS FIFO queue.
 * The Lambda consumer will:
 *   1. Download avatar video and TTS audio from Firebase
 *   2. Generate LipSync video using Fal AI veed/lipsync
 *   3. Upload final video to Firebase Storage
 *
 * POST /api/sqs/ai-influencer
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            jobId,
            userId,
            avatarVideoUrl,
            audioUrl,
            script,
            duration,
            gender,
        } = body;

        // ── Validation ─────────────────────────────────────────
        if (!jobId || !avatarVideoUrl || !audioUrl) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Missing required fields: jobId, avatarVideoUrl, audioUrl',
                },
                { status: 400 }
            );
        }


        // ── SQS Configuration ──────────────────────────────────
        const queueUrl = process.env.SQS_AI_INFLUENCER_QUEUE_URL;
        const awsRegion = process.env.AWS_REGION || 'us-east-1';
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!queueUrl || !awsAccessKeyId || !awsSecretAccessKey) {
            console.warn('⚠️ AI Influencer SQS not configured — running in mock mode');
            return NextResponse.json({
                success: true,
                jobId,
                message: 'AI Influencer job acknowledged (SQS not configured, mock mode)',
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
            type: 'ai-influencer-lipsync',
            jobId,
            userId: userId || 'anonymous',
            avatarVideoUrl,
            audioUrl,
            script: script || null,
            duration: duration || null,
            gender: gender || null,
            timestamp: new Date().toISOString(),
        });

        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: userId || 'ai-influencer-default',
            MessageDeduplicationId: `${jobId}-${Date.now()}`,
        });

        console.log('🎬 Dispatching AI Influencer LipSync job to SQS FIFO:', {
            jobId,
            userId: userId || 'anonymous',
            avatarVideoUrl,
            audioUrl,
            queueUrl,
        });

        const result = await sqsClient.send(command);
        console.log('✅ AI Influencer SQS message sent:', result.MessageId);

        return NextResponse.json({
            success: true,
            jobId,
            messageId: result.MessageId,
            message: 'AI Influencer job dispatched to SQS FIFO queue',
        });

    } catch (error) {
        console.error('AI Influencer SQS dispatch error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
