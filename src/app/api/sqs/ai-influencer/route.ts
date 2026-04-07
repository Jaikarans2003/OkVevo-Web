import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

const StartJobSchema = z.object({
    jobId: z.string().min(1),
    avatarVideoUrl: z.string().nullish(),
    audioUrl: z.string().nullish(),
    script: z.string().nullish(),
    duration: z.number().nullish(),
    gender: z.string().nullish(),
    ttsPacing: z.string().nullish(),
    mood: z.string().nullish(),
    imageTimeline: z.array(z.any()).nullish(),
    moments: z.array(z.any()).nullish(),
    topic: z.string().nullish(),
    audioSampleUrl: z.string().nullish(),
    action: z.enum(['resume']).nullish(),
    taskToken: z.string().nullish(),
});

export const POST = apiHandler(async (request, ctx) => {
    const body = await request.json();
    const validation = StartJobSchema.safeParse(body);
    
    if (!validation.success) {
        throw new Error(`Invalid fields: ${validation.error.issues.map(i => i.path.join('.') + ' ' + i.message).join(', ')}`);
    }

    const {
        jobId,
        avatarVideoUrl,
        audioUrl,
        script,
        duration,
        gender,
        ttsPacing,
        mood,
        imageTimeline,
        topic,
        action,
        taskToken,
        audioSampleUrl,
        moments
    } = validation.data;

    const userId = ctx.userId;

    // ── Step Function Configuration ──────────────────────────
    const sfnRegion = process.env.AWS_REGION || 'us-east-1';
    const sfnArn = process.env.SFN_AI_INFLUENCER_ARN;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!sfnArn || !awsAccessKeyId || !awsSecretAccessKey) {
        // Fallback or Mock mode if credentials missing (as per original logic but secured)
        throw new Error('Server configuration error: missing AWS credentials');
    }

    const { SFNClient } = require('@aws-sdk/client-sfn');
    const sfnClient = new SFNClient({
        region: sfnRegion,
        credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey },
    });

    if (action === 'resume') {
        if (!taskToken || !avatarVideoUrl) {
            throw new Error('Missing taskToken or avatarVideoUrl for resume');
        }

        const { SendTaskSuccessCommand } = require('@aws-sdk/client-sfn');
        await sfnClient.send(new SendTaskSuccessCommand({
            taskToken,
            output: JSON.stringify({ avatarVideoUrl, status: 'RESUMED' })
        }));

        return apiSuccess({ message: 'Step Function resumed' });
    }

    // ── Dispatch to Step Function ──────────────────────────────
    const { StartExecutionCommand } = require('@aws-sdk/client-sfn');
    
    const executionInput = JSON.stringify({
        jobId,
        userId,
        avatarVideoUrl: avatarVideoUrl || '',
        audioUrl: audioUrl || '',
        script: script || '',
        mood: mood || 'Chill',
        moments: moments || imageTimeline || [],
        imageTimeline: imageTimeline || [],
        topic: topic || 'General AI Video',
        duration: duration || 30,
        gender: gender || 'female',
        ttsPacing: ttsPacing || 'calm',
        audioSampleUrl: audioSampleUrl || '',
        fal_mode: process.env.FAL_MODE || (process.env.NEXT_PUBLIC_MOCK_MODE === 'true' ? 'mock' : 'live')
    });

    const command = new StartExecutionCommand({
        stateMachineArn: sfnArn,
        name: `${jobId}-${Date.now()}`,
        input: executionInput,
    });

    const result = await sfnClient.send(command);
    return apiSuccess({
        jobId,
        executionArn: result.executionArn,
        message: 'AI Influencer pipeline started via AWS Step Functions',
    });
}, { limitPerMin: 5 }); // 5/min limit as per section 3 rules

