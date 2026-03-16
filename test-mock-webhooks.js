// test-mock-webhooks.js
const http = require('http');

const jobId = process.argv[2];

if (!jobId) {
    console.error('Please provide a jobId as the first argument.');
    console.error('Usage: node test-mock-webhooks.js <jobId>');
    process.exit(1);
}

const baseUrl = 'http://localhost:3000/api/fal/webhook';

async function sendWebhook(requestId, type) {
    let payload;

    if (type === 'image') {
        payload = {
            request_id: requestId,
            status: 'COMPLETED',
            output: {
                images: [{ url: 'https://firebasestorage.googleapis.com/v0/b/text2video-16cbf.firebasestorage.app/o/InfluencerAssets%2Fmock1.jpg?alt=media' }]
            }
        };
    } else if (type === 'tts') {
        payload = {
            request_id: requestId,
            status: 'COMPLETED',
            output: {
                audio: { url: 'https://firebasestorage.googleapis.com/v0/b/text2video-16cbf.firebasestorage.app/o/InfluencerAudio%2FAudio1.mpeg?alt=media' }
            }
        };
    } else if (type === 'lipsync') {
        payload = {
            request_id: requestId,
            status: 'COMPLETED',
            output: {
                video: { url: 'https://firebasestorage.googleapis.com/v0/b/text2video-16cbf.firebasestorage.app/o/AIInfluencer%2Fmock%2Favatar.mp4?alt=media' }
            }
        };
    }

    console.log(`Sending webhook for ${requestId}...`);
    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await response.text();
        console.log(`Response for ${requestId}: ${response.status} ${text}`);
    } catch (err) {
        console.error(`Failed to send webhook for ${requestId}:`, err.message);
    }
}

async function runTest() {
    console.log(`Starting mock webhook test for jobId: ${jobId}`);

    // Images
    for (let i = 0; i < 3; i++) {
        await sendWebhook(`mock-image-${i}-${jobId}`, 'image');
        await new Promise(r => setTimeout(r, 1000));
    }

    // TTS
    await sendWebhook(`mock-tts-${jobId}`, 'tts');
    await new Promise(r => setTimeout(r, 1000));

    console.log('--- Wait a few seconds for Step Function to progress to lipsync ---');
    await new Promise(r => setTimeout(r, 5000));

    // LipSync
    await sendWebhook(`mock-lipsync-${jobId}`, 'lipsync');

    console.log('All mock webhooks sent!');
}

runTest();
