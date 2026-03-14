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

        const isMockMode = !sfnArn || !awsAccessKeyId || !awsSecretAccessKey || process.env.FAL_MODE === 'mock' || process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

        if (isMockMode) {
            console.warn('⚠️ AI Influencer Step Function not configured or mock mode enabled — returning dummy video');

            try {
                const admin = require('firebase-admin');
                if (!admin.apps.length) {
                    const svcKey = process.env.FB_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';
                    if (svcKey) {
                        const serviceAccount = JSON.parse(Buffer.from(svcKey.trim(), 'base64').toString('utf-8'));
                        admin.initializeApp({
                            credential: admin.credential.cert(serviceAccount)
                        });
                    }
                }
                
                if (admin.apps.length) {
                    const db = admin.firestore();
                    await db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId).set({
                        status: 'complete',
                        finalVideoUrl: 'https://storage.googleapis.com/text2video-16cbf.firebasestorage.app/MockAIGeneratedVideos/1.mp4',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                    console.log('✅ Mock mode: Updated Firestore with dummy video URL');
                }
            } catch (err) {
                 console.error('⚠️ Failed to update Firestore in mock mode:', err);
            }

            return NextResponse.json({
                success: true,
                jobId,
                message: 'AI Influencer job finished (mock mode)',
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
