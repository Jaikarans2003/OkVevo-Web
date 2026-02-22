import { NextRequest, NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

/**
 * Product Shoots API Route — SQS Dispatch
 *
 * Dispatches product shoot photo generation jobs to a dedicated SQS FIFO queue.
 * The Lambda consumer will:
 *   1. Download the product image from Firebase Storage
 *   2. Call NANOBANANA PRO (Gemini) with the photography master prompt + product image
 *   3. Upload the generated photo to ProductShoots/{jobId}-shot-{n}.png
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, masterPrompt, userId, productImageUrl, outputPath, shotName } = body;

        if (!jobId || !masterPrompt) {
            return NextResponse.json(
                { success: false, error: 'jobId and masterPrompt are required' },
                { status: 400 }
            );
        }

        // ── SQS Configuration ──────────────────────────────────
        const queueUrl = process.env.SQS_PRODUCT_SHOOTS_QUEUE_URL;
        const awsRegion = process.env.AWS_REGION || 'us-east-1';
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!queueUrl || !awsAccessKeyId || !awsSecretAccessKey) {
            console.warn('⚠️ Product Shoots SQS not configured — running in mock mode');
            return NextResponse.json({
                success: true,
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
            userId: userId || 'anonymous',
            timestamp: new Date().toISOString(),
        });

        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: userId || 'shoots-default',
            MessageDeduplicationId: `${jobId}-${Date.now()}`,
        });

        console.log('📸 Dispatching product-shoot job to SQS FIFO:', {
            jobId,
            shotName,
            userId: userId || 'anonymous',
            promptLength: masterPrompt.length,
            hasProductImage: !!productImageUrl,
            outputPath: outputPath || `ProductShoots/${jobId}.png`,
            queueUrl,
        });

        const result = await sqsClient.send(command);
        console.log('✅ Product shoot SQS message sent:', result.MessageId);

        return NextResponse.json({
            success: true,
            jobId,
            messageId: result.MessageId,
            message: 'Product shoot job dispatched to SQS FIFO queue',
        });

    } catch (error) {
        console.error('Product shoot SQS dispatch error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
