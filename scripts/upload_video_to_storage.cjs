const admin = require('firebase-admin');
const fs = require('fs');

// Read .env file manually
const envContent = fs.readFileSync('./.env', 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value;
  }
});

const base64Key = env.FB_SERVICE_ACCOUNT_KEY;
if (!base64Key) {
  console.error("Missing FB_SERVICE_ACCOUNT_KEY in .env");
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function uploadVideo() {
  const filePath = './public/videos/screenrecord.webm';
  const destination = 'videos/screenrecord.webm';

  console.log(`Uploading ${filePath} to gs://${bucket.name}/${destination}...`);

  await bucket.upload(filePath, {
    destination: destination,
    metadata: {
      contentType: 'video/webm',
      // Allow anyone with the URL to view the file
      acl: [{ entity: 'allUsers', role: 'READER' }]
    }
  });

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
  console.log(`\n✅ Video uploaded successfully!`);
  console.log(`Link: ${publicUrl}`);
}

uploadVideo().catch(err => {
  console.error("Error uploading video:", err);
  process.exit(1);
});
