require('dotenv').config({ path: '../.env' });

const admin = require('firebase-admin');
const handler = require('./index.js').handler;
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    const jobs = await db.collection('users').doc(user.id).collection('aiInfluencerJobs')
        .orderBy('createdAt', 'desc').limit(1).get()
        .catch(() => db.collection('users').doc(user.id).collection('aiInfluencerJobs').limit(5).get());
    
    if (!jobs.empty) {
        let maxCompleted = -1;
        let jobTarget = null;
      for (const doc of jobs.docs) {
          const jobData = doc.data();
          if (jobData.requestIds && jobData.requestIds.length > 0) {
              if (jobData.completedAssets > maxCompleted) {
                  maxCompleted = jobData.completedAssets;
                  jobTarget = jobData;
                  jobTarget.id = doc.id;
              }
          }
      }
      if (jobTarget) {
          console.log(`TESTING RECOVERY FOR Job ID: ${jobTarget.id}`);
          const result = await handler({ jobId: jobTarget.id, userId: user.id });
          console.log('RECOVERY RESULT:', result);
          return; 
      }
    }
  }
}
run().catch(console.error).finally(() => process.exit(0));
