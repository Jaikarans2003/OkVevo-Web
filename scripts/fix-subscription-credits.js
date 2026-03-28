/**
 * Fix Subscription Credits
 * Updates the existing Pro subscription with correct credit amount (40,000)
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
if (!saBase64) {
    console.error('❌ Missing Firebase Service Account Key');
    process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixSubscriptionCredits() {
    const subscriptionId = 'sub_SWm31MGN4wV8Cp';
    const userId = 'HXUGPOKWDpazCdu1LWvKJD9keJB3';
    const correctCredits = 40000;

    console.log(`🔧 Fixing credits for subscription: ${subscriptionId}`);
    console.log(`   User: ${userId}`);
    console.log(`   Updating credits: 180 → ${correctCredits}`);

    try {
        // Update both collections atomically
        const batch = db.batch();

        // Top-level collection
        const topLevelRef = db.collection('razorpaySubscriptions').doc(subscriptionId);
        batch.update(topLevelRef, {
            credits: correctCredits,
            initialCredits: correctCredits,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // User-scoped subcollection
        const userRef = db.collection('users').doc(userId).collection('subscriptions').doc(subscriptionId);
        batch.update(userRef, {
            credits: correctCredits,
            initialCredits: correctCredits,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();

        console.log('✅ Credits updated successfully!');
        console.log(`   New credits: ${correctCredits}`);
        console.log(`   Both collections updated atomically`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating credits:', error);
        process.exit(1);
    }
}

fixSubscriptionCredits();
