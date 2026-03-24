const admin = require('firebase-admin');
require('dotenv').config();
const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
if(!saBase64) {
    console.error('No service account key found');
    process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(saBase64, 'base64').toString())) });
const db = admin.firestore();
async function run() {
  const users = await db.collection('users').limit(5).get();
  let found = false;
  for (const user of users.docs) {
    // try to get latest job
    const jobs = await db.collection('users').doc(user.id).collection('aiInfluencerJobs').get();
    if (!jobs.empty) {
      jobs.docs.forEach(doc => {
          if(doc.data().status === 'preparing-assets' || doc.data().expectedAssets > 0) {
              const jobData = doc.data();
              console.log('User:', user.id, 'Job:', doc.id);
              console.log('Status:', jobData.status);
              console.log('Expected:', jobData.expectedAssets, 'Completed:', jobData.assetResults?.length || jobData.completedAssets);
              console.log('Request IDs:', jobData.requestIds);
              found = true;
          }
      });
    }
  }
  if (!found) console.log("No AI jobs found");
}
run().catch(console.error).finally(() => process.exit(0));
