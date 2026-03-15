/**
 * Migration Script: Initialize userStats for Existing Users
 * 
 * This script creates userStats documents for all existing users
 * by aggregating data from their subscriptions and credit transactions.
 * 
 * Run this once after deploying the admin dashboard to populate
 * the userStats collection for existing users.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-user-stats.ts
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
if (!serviceAccountBase64) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set');
    process.exit(1);
}

const serviceAccount = JSON.parse(
    Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateUserStats() {
    console.log('🚀 Starting userStats migration...\n');

    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        console.log(`📊 Found ${usersSnapshot.size} users\n`);

        let successCount = 0;
        let errorCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();

            try {
                console.log(`Processing user: ${userData.email} (${userId})`);

                // Get active subscription
                const subscriptionsSnapshot = await db
                    .collection('users')
                    .doc(userId)
                    .collection('subscriptions')
                    .where('status', '==', 'active')
                    .limit(1)
                    .get();

                let userStats: any = {
                    uid: userId,
                    email: userData.email,
                    creditsAllocated: 0,
                    creditsSpent: 0,
                    creditsRemaining: 0,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                if (!subscriptionsSnapshot.empty) {
                    const subscriptionData = subscriptionsSnapshot.docs[0].data();
                    
                    userStats = {
                        ...userStats,
                        planType: subscriptionData.planType,
                        subscriptionStatus: subscriptionData.status,
                        creditsAllocated: subscriptionData.initialCredits || 0,
                        creditsSpent: subscriptionData.creditsUsed || 0,
                        creditsRemaining: subscriptionData.credits || 0,
                    };

                    console.log(`  ✓ Active subscription found: ${subscriptionData.planType}`);
                    console.log(`  ✓ Credits: ${userStats.creditsRemaining}/${userStats.creditsAllocated}`);
                } else {
                    console.log(`  ⚠ No active subscription`);
                }

                // Create/update userStats document
                await db.collection('userStats').doc(userId).set(userStats, { merge: true });
                
                successCount++;
                console.log(`  ✅ userStats created/updated\n`);

            } catch (error: any) {
                errorCount++;
                console.error(`  ❌ Error processing user ${userId}:`, error.message, '\n');
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`  Total users: ${usersSnapshot.size}`);
        console.log(`  ✅ Successful: ${successCount}`);
        console.log(`  ❌ Errors: ${errorCount}`);
        console.log('='.repeat(60));

        if (errorCount === 0) {
            console.log('\n✨ Migration completed successfully!');
        } else {
            console.log('\n⚠️  Migration completed with errors. Check logs above.');
        }

    } catch (error: any) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateUserStats()
    .then(() => {
        console.log('\n👋 Exiting...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
