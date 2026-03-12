const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

// Initialize Firebase Admin SDK
admin.initializeApp();

const app = express();

// Enable CORS for all requests
app.use(cors({ origin: true }));

// Middleware to parse JSON body
app.use(express.json());

// Google Gemini Proxy
app.post("/api/gemini", async (req, res) => {
    const apiKey = process.env.VITE_GOOGLE_API_KEY || functions.config().google.key;

    if (!apiKey) {
        console.error("Missing VITE_GOOGLE_API_KEY");
        res.status(500).send({ error: "Missing Google API Key" });
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Gemini Proxy Error:", error);
        res.status(500).json({ error: "Failed to proxy to Gemini", details: error.message });
    }
});

// Fetch Videos from Firebase Storage
app.get("/api/videos/fetch", async (req, res) => {
    try {
        const bucket = admin.storage().bucket(); // Use default bucket
        const videoIds = ['1', '2', '3'];

        console.log('Fetching videos from Firebase Storage...');

        const videos = await Promise.all(
            videoIds.map(async (videoId) => {
                const file = bucket.file(`MockAIGeneratedVideos/${videoId}.mp4`);

                // Check if file exists
                const [exists] = await file.exists();
                if (!exists) {
                    throw new Error(`Video ${videoId}.mp4 not found in storage`);
                }

                const [url] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 60 * 60 * 1000 // 1 hour expiration
                });

                return { id: videoId, url };
            })
        );

        console.log(`Successfully fetched ${videos.length} video URLs`);
        res.json({ videos });
    } catch (error) {
        console.error('Error fetching videos from storage:', error);
        res.status(500).json({
            error: 'Failed to fetch videos',
            details: error.message
        });
    }
});

// Fetch Stitched Videos from videos/ folder
app.get("/api/videos/fetch-stitched", async (req, res) => {
    try {
        const bucket = admin.storage().bucket();

        console.log('Fetching stitched videos from videos/ folder...');

        // List all files in videos/ folder that start with "stitched-"
        const [files] = await bucket.getFiles({
            prefix: 'videos/stitched-',
        });

        if (files.length === 0) {
            console.log('No stitched videos found yet');
            return res.json({ videos: [] });
        }

        // Sort by creation time (newest first)
        files.sort((a, b) => {
            const aTime = new Date(a.metadata.timeCreated).getTime();
            const bTime = new Date(b.metadata.timeCreated).getTime();
            return bTime - aTime;
        });

        // Get signed URLs for stitched videos (return max 5)
        const videosToFetch = files.slice(0, 5);
        const videos = await Promise.all(
            videosToFetch.map(async (file) => {
                const [url] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                });

                return {
                    id: file.name.replace('videos/stitched-', '').replace('.mp4', ''),
                    url,
                    name: file.name,
                    created: file.metadata.timeCreated
                };
            })
        );

        console.log(`Successfully fetched ${videos.length} stitched videos`);
        res.json({ videos });
    } catch (error) {
        console.error('Error fetching stitched videos:', error);
        res.status(500).json({
            error: 'Failed to fetch stitched videos',
            details: error.message
        });
    }
});


// Replicate API Proxy
app.all("*", async (req, res) => {
    // Get token from Firebase Config or Environment
    // Priority: Environment variable > Firebase config > Default
    const apiToken = process.env.REPLICATE_API_TOKEN ||
        (functions.config().replicate && functions.config().replicate.token) ||
        "r8_GfTTd9urXq1PAMzGsc2MkMzmQoWF2qz4OIRno"; // Fallback to the token from .env

    if (!apiToken) {
        console.error("Missing REPLICATE_API_TOKEN configuration");
        res.status(500).send({
            error: "Server configuration error",
            details: "Missing API Token. Please configure REPLICATE_API_TOKEN in Firebase Functions config or environment variables."
        });
        return;
    }

    // Strip '/api/replicate' from the path to get the target path on Replicate API
    // Incoming request: /api/replicate/predictions -> /predictions
    const targetPath = req.path.replace(/^\/api\/replicate/, "") || req.path;
    const targetUrl = `https://api.replicate.com/v1${targetPath}`;

    console.log(`Proxying request to: ${targetUrl} [${req.method}]`);
    console.log(`Using API token: ${apiToken.substring(0, 8)}...`);

    try {
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Token ${apiToken}`,
                // Forward other relevant headers if needed, but exclude Host
            },
            body: req.method === "POST" || req.method === "PUT" ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();

        console.log(`Response status: ${response.status}`);
        console.log(`Response data:`, data);

        // Forward status code
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Proxy error:", error);
        res.status(500).json({
            error: "Failed to proxy request",
            details: error.message,
            url: targetUrl,
            method: req.method
        });
    }
});

exports.replicateProxy = functions.https.onRequest(app);

// ────────────────────────────────────────────────────────────────────────────
// Firestore Trigger: Auto-refund credits for failed Product Shoots jobs
// ────────────────────────────────────────────────────────────────────────────

exports.refundFailedProductShoots = functions.firestore.onDocumentUpdated(
    'productShootsJobs/{jobId}',
    (event) => {
        // v7.x API: event.data contains before/after snapshots
        const before = event.data.before.data();
        const after = event.data.after.data();
        const jobId = event.params.jobId;

        // Only trigger if status changed to 'error'
        if (before.status !== 'error' && after.status === 'error') {
            const userId = after.userId;
            const CREDIT_REFUND_AMOUNT = 50; // Per shot

            if (!userId) {
                console.error(`❌ No userId found for job ${jobId}`);
                return null;
            }

            console.log(`🔄 Detected failed job ${jobId} for user ${userId}. Initiating refund...`);

            const db = admin.firestore();
            
            // Get user's active subscription and process refund
            return db.collection('users').doc(userId).collection('subscriptions')
                .where('status', '==', 'active').limit(1).get()
                .then(snapshot => {
                    if (snapshot.empty) {
                        console.error(`❌ No active subscription found for user ${userId}`);
                        return null;
                    }

                    const subscriptionDoc = snapshot.docs[0];
                    const subscriptionData = subscriptionDoc.data();
                    const currentCredits = subscriptionData.credits || 0;
                    const newCredits = currentCredits + CREDIT_REFUND_AMOUNT;
                    const creditsUsed = Math.max(0, (subscriptionData.creditsUsed || 0) - CREDIT_REFUND_AMOUNT);

                    // Update subscription credits
                    return subscriptionDoc.ref.update({
                        credits: newCredits,
                        creditsUsed: creditsUsed,
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    }).then(() => {
                        // Create refund transaction record
                        const transactionId = `txn-refund-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                        const transactionRef = db.collection('users').doc(userId).collection('creditTransactions').doc(transactionId);

                        return transactionRef.set({
                            transactionId,
                            userId,
                            amount: CREDIT_REFUND_AMOUNT,
                            type: 'refund',
                            feature: 'PRODUCT_SHOOTS',
                            jobId,
                            reason: `Automatic refund for failed product shoot: ${jobId}`,
                            balanceBefore: currentCredits,
                            balanceAfter: newCredits,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }).then(() => {
                        console.log(`✅ Refunded ${CREDIT_REFUND_AMOUNT} credits to user ${userId} for failed job ${jobId}`);
                        console.log(`   Balance: ${currentCredits} → ${newCredits}`);
                        return null;
                    });
                })
                .catch(error => {
                    console.error(`❌ Failed to refund credits for job ${jobId}:`, error);
                    return null;
                });
        }
        
        return null;
    }
);
