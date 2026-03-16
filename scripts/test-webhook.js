/**
 * test-webhook.js
 * 
 * Simulates a Fal AI Webhook callback for testing Mock Mode.
 * 
 * Usage:
 * node scripts/test-webhook.js <request_id> <type> [url]
 * 
 * Examples:
 * node scripts/test-webhook.js mock1 image https://picsum.photos/1024
 * node scripts/test-webhook.js mock-tts tts https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3
 * node scripts/test-webhook.js mock-lipsync lipsync https://samplelib.com/lib/preview/mp4/sample-5s.mp4
 */

const request_id = process.argv[2];
const type = process.argv[3];
const url = process.argv[4];

if (!request_id || !type) {
    console.error("Usage: node scripts/test-webhook.js <request_id> <type: image|tts|lipsync> [url]");
    process.exit(1);
}

const baseUrl = "http://localhost:3000"; // Update if your dev server runs elsewhere
const webhookUrl = `${baseUrl}/api/fal/webhook`;

let output = {};
if (type === 'image') {
    output = { images: [{ url: url || "https://picsum.photos/1024" }] };
} else if (type === 'tts') {
    output = { audio: { url: url || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" } };
} else if (type === 'lipsync') {
    output = { video: { url: url || "https://samplelib.com/lib/preview/mp4/sample-5s.mp4" } };
}

const payload = {
    request_id,
    status: "completed",
    output
};

console.log(`🚀 Sending mock ${type} webhook to ${webhookUrl}...`);
console.log(JSON.stringify(payload, null, 2));

fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
})
.then(async res => {
    const data = await res.json();
    console.log(`✅ Response (${res.status}):`, data);
})
.catch(err => {
    console.error("❌ Error sending webhook:", err.message);
});
