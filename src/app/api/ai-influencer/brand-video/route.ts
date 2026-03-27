import { NextRequest, NextResponse } from 'next/server';

const BRANDING_LAMBDA_ARN =
    process.env.BRANDING_LAMBDA_ARN ||
    'arn:aws:lambda:us-east-1:315974965935:function:okvevo-branding';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            jobId,
            userId,
            finalVideoUrl,
            logoBase64,
            logoMimeType,
            logoPosition,
            marqueeText,
            marqueePosition,
            generateThumbnail,
            thumbnailPrompt,
            thumbnailPersonPhotoBase64,
        } = body;

        // ── Validation ──────────────────────────────────────────────────────
        if (!jobId || !userId || !finalVideoUrl) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: jobId, userId, finalVideoUrl' },
                { status: 400 }
            );
        }
        if (!logoBase64 && !marqueeText && !generateThumbnail) {
            return NextResponse.json(
                { success: false, error: 'Provide at least a logo, marquee, or thumbnail instructions.' },
                { status: 400 }
            );
        }

        // ── AWS credentials ─────────────────────────────────────────────────
        const awsRegion          = process.env.AWS_REGION           || 'us-east-1';
        const awsAccessKeyId     = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!awsAccessKeyId || !awsSecretAccessKey) {
            console.error('Missing AWS credentials — cannot invoke branding Lambda');
            return NextResponse.json(
                { success: false, error: 'Server configuration error: missing AWS credentials.' },
                { status: 500 }
            );
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

        // ── Invoke Lambda using dynamic require to match project conventions ──
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
            console.error('Branding Lambda error:', errMsg);
            return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
        }

        return NextResponse.json({ success: true, brandedVideoUrl: result.brandedVideoUrl });

    } catch (error: any) {
        console.error('Brand-video API error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
