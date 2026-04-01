import { NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

const ProductShootsSchema = z.object({
    jobId: z.string().min(5),
    masterPrompt: z.string().min(10),
    productImageUrl: z.string().url().nullish().or(z.literal('')),
    outputPath: z.string().nullish(),
    shotName: z.string().nullish(),
    resolution: z.string().nullish(),
    aspectRatio: z.string().nullish(),
});

export const POST = apiHandler(
    async (req, { userId }) => {
        const body = await req.json();
        const validatedData = ProductShootsSchema.parse(body);
        const { jobId, masterPrompt, productImageUrl, outputPath, shotName, resolution, aspectRatio } = validatedData;

        // ── SQS Configuration ──────────────────────────────────
        const queueUrl = process.env.SQS_PRODUCT_SHOOTS_QUEUE_URL;
        const awsRegion = process.env.AWS_REGION || 'us-east-1';
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!queueUrl || !awsAccessKeyId || !awsSecretAccessKey) {
            console.warn('⚠️ Product Shoots SQS not configured — running in mock mode');
            return apiSuccess({
                jobId,
                message: 'Product shoot job acknowledged (SQS not configured, mock mode)',
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
            type: 'product-shoot',
            jobId,
            masterPrompt,
            productImageUrl: productImageUrl || null,
            outputPath: outputPath || `ProductShoots/${jobId}.png`,
            shotName: shotName || 'Unknown Shot',
            userId, // Set from Auth
            resolution: resolution || '4K',
            aspectRatio: aspectRatio || '16:9',
            timestamp: new Date().toISOString(),
        });

        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: userId,
            MessageDeduplicationId: `${jobId}-${Date.now()}`,
        });

        const result = await sqsClient.send(command);
        console.log(`✅ SQS product-shoot sent: ${jobId} (shot: ${shotName}) (UID: ${userId})`);

        return apiSuccess({
            jobId,
            messageId: result.MessageId,
            message: 'Product shoot job dispatched to SQS FIFO queue',
        });
    },
    {
        limitPerMin: 5, // 5 shots per minute
    }
);
