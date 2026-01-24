import { NextRequest, NextResponse } from 'next/server';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, videoUrls, audioUrl } = body;

        // Validate input
        if (!jobId || !videoUrls || !Array.isArray(videoUrls)) {
            return NextResponse.json(
                { success: false, error: 'Invalid request: jobId and videoUrls array required' },
                { status: 400 }
            );
        }

        if (videoUrls.length !== 3) {
            return NextResponse.json(
                { success: false, error: 'Exactly 3 video URLs required for stitching' },
                { status: 400 }
            );
        }

        // Validate environment variables
        const queueUrl = process.env.SQS_STITCHING_QUEUE_URL;
        const awsRegion = process.env.AWS_REGION || 'us-east-1';
        const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!queueUrl || !awsAccessKeyId || !awsSecretAccessKey) {
            console.error('Missing AWS SQS configuration');
            return NextResponse.json(
                { success: false, error: 'SQS not configured on server' },
                { status: 500 }
            );
        }

        // Initialize SQS client
        const sqsClient = new SQSClient({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
            },
        });

        // Prepare SQS message
        const messageBody = JSON.stringify({
            jobId,
            videoUrls,
            audioUrl, // Include audioUrl in SQS message
            timestamp: new Date().toISOString(),
        });

        // Send message to SQS FIFO queue
        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageGroupId: jobId, // FIFO ordering by jobId
            MessageDeduplicationId: `${jobId}-${Date.now()}`, // Prevent duplicates
        });

        console.log('Sending message to SQS:', { jobId, videoUrls, audioUrl });
        const result = await sqsClient.send(command);
        console.log('SQS message sent successfully:', result.MessageId);

        return NextResponse.json({
            success: true,
            jobId,
            messageId: result.MessageId,
            message: 'Stitching job dispatched to queue',
        });

    } catch (error) {
        console.error('SQS dispatch error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            { status: 500 }
        );
    }
}
