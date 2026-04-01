import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

const BrandVideoSchema = z.object({
    jobId: z.string().min(1),
    finalVideoUrl: z.string().url(),
    logoBase64: z.string().optional(),
    logoMimeType: z.string().optional(),
    logoPosition: z.string().optional(),
    marqueeText: z.string().optional(),
    marqueePosition: z.string().optional(),
    generateThumbnail: z.boolean().optional(),
    thumbnailPrompt: z.string().optional(),
    thumbnailPersonPhotoBase64: z.string().optional(),
});

const BRANDING_LAMBDA_ARN =
    process.env.BRANDING_LAMBDA_ARN ||
    'arn:aws:lambda:us-east-1:315974965935:function:okvevo-branding';

export const POST = apiHandler(async (req, ctx) => {
    const body = await req.json();
    const validation = BrandVideoSchema.safeParse(body);
    
    if (!validation.success) {
        throw new Error(`Invalid request format: ${validation.error.issues[0].message}`);
    }

    const {
        jobId,
        finalVideoUrl,
        logoBase64,
        logoMimeType,
        logoPosition,
        marqueeText,
        marqueePosition,
        generateThumbnail,
        thumbnailPrompt,
        thumbnailPersonPhotoBase64,
    } = validation.data;

    const userId = ctx.userId;

    // ── AWS credentials ─────────────────────────────────────────────────
    const awsRegion          = process.env.AWS_REGION           || 'us-east-1';
    const awsAccessKeyId     = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!awsAccessKeyId || !awsSecretAccessKey) {
        throw new Error('Server configuration error: missing AWS credentials.');
    }

    // ── Build Lambda payload ────────────────────────────────────────────
    const lambdaPayload: Record<string, any> = { jobId, userId, finalVideoUrl };
    if (logoBase64)      lambdaPayload.logoBase64      = logoBase64;
    if (logoMimeType)    lambdaPayload.logoMimeType    = logoMimeType;
    if (logoPosition)    lambdaPayload.logoPosition    = logoPosition;
    if (marqueeText)     lambdaPayload.marqueeText     = marqueeText;
    if (marqueePosition) lambdaPayload.marqueePosition = marqueePosition;
    if (generateThumbnail) {
        lambdaPayload.generateThumbnail = generateThumbnail;
        lambdaPayload.thumbnailPrompt = thumbnailPrompt;
        if (thumbnailPersonPhotoBase64) {
            lambdaPayload.thumbnailPersonPhotoBase64 = thumbnailPersonPhotoBase64;
        }
    }

    // ── Invoke Lambda ──────────────────────────────────────────────────
    const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
    const lambdaClient = new LambdaClient({
        region: awsRegion,
        credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey },
    });

    const command = new InvokeCommand({
        FunctionName:   BRANDING_LAMBDA_ARN,
        InvocationType: 'RequestResponse',
        Payload:        Buffer.from(JSON.stringify(lambdaPayload)),
    });

    const response = await lambdaClient.send(command);

    if (!response.Payload) {
        throw new Error('No payload returned from branding Lambda.');
    }
    const result = JSON.parse(Buffer.from(response.Payload).toString('utf8'));

    if (response.FunctionError) {
        const errMsg = result?.errorMessage || result?.error || 'Branding Lambda returned an error.';
        throw new Error(errMsg);
    }

    return apiSuccess({ brandedVideoUrl: result.brandedVideoUrl });
}, { limitPerMin: 5 });

