const admin = require('firebase-admin');
require('dotenv').config();

const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(saBase64, 'base64').toString())) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').get();
  let found = false;
  for (const user of users.docs) {
    const jobs = await db.collection('users').doc(user.id).collection('aiInfluencerJobs').get();
    if (!jobs.empty) {
      for (const doc of jobs.docs) {
          const jobData = doc.data();
          if(jobData.status === 'preparing-assets' || jobData.expectedAssets > 0) {
              console.log('\n--- JOB FOUND ---');
              console.log('User:', user.id, 'Job:', doc.id);
              console.log('Status:', jobData.status);
              console.log('Expected:', jobData.expectedAssets, 'Completed:', jobData.assetResults?.length || jobData.completedAssets);
              
              if(jobData.requestIds) {
                 for(const reqId of jobData.requestIds) {
                     try {
                         const res = await fetch(`https://queue.fal.run/resemble-ai/chatterboxhd/text-to-speech/requests/${reqId}/status`, {
                             headers: { 'Authorization': `Key ${process.env.FAL_API_KEY}` }
                         });
                         const data = await res.json();
                         if (data.status === 'ERROR' || data.status === 'FAILED') {
                             console.log(`TTS Request ID ${reqId}: ${data.status} | error:`, data.error);
                         } else if (res.status !== 404) {
                             console.log(`TTS Request ID ${reqId}: ${data.status}`);
                         }
                     } catch(err) {
                     }
                 }
              }
              found = true;
          }
      }
    }
  }
}
run().catch(console.error).finally(() => process.exit(0));
