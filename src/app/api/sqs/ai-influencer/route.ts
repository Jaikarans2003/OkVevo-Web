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
            imageTimeline,
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

        // Require authentication - reject anonymous requests
        if (!userId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Authentication required. Please sign in to generate AI influencer videos.',
                },
                { status: 401 }
            );
        }


        // ── Step Function Configuration ──────────────────────────
        const sfnRegion = process.env.AWS_REGION || 'us-east-1';
        const sfnArn = process.env.SFN_AI_INFLUENCER_ARN;
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!sfnArn || !awsAccessKeyId || !awsSecretAccessKey) {
            console.warn('⚠️ AI Influencer Step Function not configured — running in mock mode');
            return NextResponse.json({
                success: true,
                jobId,
                message: 'AI Influencer job acknowledged (Step Function not configured, mock mode)',
                mock: true,
            });
        }

        // ── Dispatch to Step Function ──────────────────────────────
        const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
        const sfnClient = new SFNClient({
            region: sfnRegion,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
            },
        });

        const executionInput = JSON.stringify({
            jobId,
            userId,
            avatarVideoUrl,
            topic: body.topic || 'General AI Video',
            duration: duration || 30,
            fal_mode: process.env.FAL_MODE || 'live'
        });

        const command = new StartExecutionCommand({
            stateMachineArn: sfnArn,
            name: `${jobId}-${Date.now()}`,
            input: executionInput,
        });

        console.log('🎬 Starting AI Influencer Step Function:', {
            jobId,
            userId,
            sfnArn,
        });

        const result = await sfnClient.send(command);
        console.log('✅ AI Influencer Step Function started:', result.executionArn);

        return NextResponse.json({
            success: true,
            jobId,
            executionArn: result.executionArn,
            message: 'AI Influencer pipeline started via AWS Step Functions',
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
