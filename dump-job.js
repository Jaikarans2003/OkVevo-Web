const admin = require('firebase-admin');
require('dotenv').config();

const saBase64 = process.env.FB_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(saBase64, 'base64').toString())) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').limit(5).get();
  for (const user of users.docs) {
    const jobs = await db.collection('users').doc(user.id).collection('aiInfluencerJobs')
        .orderBy('createdAt', 'desc').limit(1).get()
        .catch(() => db.collection('users').doc(user.id).collection('aiInfluencerJobs').limit(5).get());
    
    if (!jobs.empty) {
      for (const doc of jobs.docs) {
          const jobData = doc.data();
          if (jobData.requestIds && jobData.requestIds.length > 0) {
              console.log('\n--- LATEST JOB ---');
              console.log('Job ID:', doc.id);
              console.log('Status:', jobData.status);
              console.log('Expected:', jobData.expectedAssets);
              console.log('Completed Assets Count:', jobData.completedAssets);
              console.log('Asset Results Array Length:', jobData.assetResults?.length || 0);
              const mapped = (jobData.assetResults || []).map(r => r.type);
              console.log('Asset Types:', mapped);
              return; // Just need one recent job
          }
      }
    }
  }
}
run().catch(console.error).finally(() => process.exit(0));
