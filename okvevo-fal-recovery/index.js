const admin = require('firebase-admin');
const { fal } = require('@fal-ai/client');
const { SFNClient, SendTaskSuccessCommand } = require('@aws-sdk/client-sfn');

// Initialize Firebase
const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
if (!saBase64) {
    throw new Error("Missing Firebase Service Account Key (FIREBASE_SERVICE_ACCOUNT_KEY or FB_SERVICE_ACCOUNT_KEY)");
}
const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app'
    });
}

const db = admin.firestore();

// Configure Fal AI SDK
fal.config({
    credentials: process.env.FAL_API_IMAGE || process.env.FAL_API_KEY
});

// Configure AWS Step Functions client
// Lambda execution role provides credentials automatically
const sfnClient = new SFNClient({
    region: process.env.AWS_REGION || 'us-east-1'
});

exports.handler = async (event) => {
    const { jobId, userId } = event;
    
    console.log('\n' + '='.repeat(80));
    console.log('🔄 FAL AI RECOVERY LAMBDA INVOKED');
    console.log('='.repeat(80));
    console.log('   Job ID:', jobId);
    console.log('   User ID:', userId);
    
    try {
        // 1. Get job data from Firestore
        console.log('\n📥 Fetching job data from Firestore...');
        const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
        const jobDoc = await jobRef.get();
        
        if (!jobDoc.exists) {
            console.error('❌ Job document not found!');
            return { allAssetsComplete: false, error: 'Job not found' };
        }
        
        const jobData = jobDoc.data();
        const { 
            requestIds = [], 
            assetResults = [], 
            expectedAssets = 0, 
            taskToken,
            moments = [],
            status,
            processingLock = false
        } = jobData;
        
        console.log('   Expected Assets:', expectedAssets);
        console.log('   Completed Assets:', assetResults.length);
        console.log('   Request IDs:', requestIds.length);
        console.log('   Job Status:', status);
        console.log('   Processing Lock:', processingLock);
        
        // 2. Check if already completed (prevent duplicate SendTaskSuccess)
        if (status === 'completed') {
            console.log('\n✅ Job already completed by webhook. Skipping recovery.');
            return { allAssetsComplete: true, alreadyCompleted: true };
        }
        
        // 3. Check if all assets already received
        if (assetResults.length >= expectedAssets) {
            console.log('\n✅ All assets already received. No recovery needed.');
            return { allAssetsComplete: true, recoveryNotNeeded: true };
        }
        
        // 4. Acquire processing lock to prevent race condition
        if (processingLock) {
            console.log('\n⏳ Another process is already handling this job. Skipping.');
            return { allAssetsComplete: false, locked: true };
        }
        
        console.log('\n🔒 Acquiring processing lock...');
        await jobRef.update({ processingLock: true });
        
        // 5. Find missing request_ids
        console.log('\n🔍 Identifying missing assets...');
        
        // BACKWARD COMPATIBILITY: If requestIds missing, query falJobs collection
        if (!requestIds || requestIds.length === 0) {
            console.log('   ⚠️ requestIds array missing (old job format)');
            console.log('   🔎 Querying falJobs collection for this job...');
            
            const falJobsSnapshot = await db.collection('falJobs')
                .where('jobId', '==', jobId)
                .where('type', '==', 'ai-prep')
                .get();
            
            requestIds = falJobsSnapshot.docs.map(doc => doc.id);
            console.log(`   ✅ Found ${requestIds.length} request IDs from falJobs collection`);
        }
        
        const completedIds = assetResults.map(r => r.request_id);
        const missingIds = requestIds.filter(id => !completedIds.includes(id));
        
        console.log('   Completed IDs:', completedIds);
        console.log('   Missing IDs:', missingIds);
        console.log('   Missing Count:', missingIds.length);
        
        if (missingIds.length === 0) {
            console.log('\n✅ No missing assets found!');
            await jobRef.update({ processingLock: false });
            return { allAssetsComplete: true, noMissingAssets: true };
        }
        
        // 6. Poll Fal AI for each missing request_id
        console.log('\n🔎 Polling Fal AI for missing assets...');
        const recoveredAssets = [];
        
        // Fallback models for AI Prep jobs when falJobs mapping is missing
        const FALLBACK_MODELS = [
            'fal-ai/nano-banana-2',           // Image generation
            'resemble-ai/chatterboxhd/text-to-speech'  // TTS
        ];
        
        for (const requestId of missingIds) {
            console.log(`\n   Checking request_id: ${requestId}`);
            
            // Get model info from falJobs collection
            const falJobDoc = await db.collection('falJobs').doc(requestId).get();
            
            let modelsToTry = [];
            
            if (falJobDoc.exists) {
                const { model, jobType } = falJobDoc.data();
                if (model) {
                    console.log(`   Model from falJobs: ${model}`);
                    modelsToTry.push(model);
                } else {
                    console.warn(`   ⚠️ falJobs exists but model is undefined, using fallbacks`);
                    modelsToTry = [...FALLBACK_MODELS];
                }
            } else {
                console.warn(`   ⚠️ falJobs mapping not found for ${requestId}, trying fallback models`);
                modelsToTry = [...FALLBACK_MODELS];
            }
            
            let recovered = false;
            
            for (const model of modelsToTry) {
                if (recovered) break;
                
                try {
                    console.log(`   🔄 Trying model: ${model}`);
                    
                    // Poll Fal AI status API
                    const res = await fal.queue.status(model, { 
                        requestId: requestId,
                        logs: false 
                    });
                    
                    const normalizedStatus = (res.status || '').toUpperCase();
                    console.log(`   Status: ${normalizedStatus}`);
                    
                    if (normalizedStatus === 'OK' || normalizedStatus === 'COMPLETED') {
                        console.log('   ✅ Job completed! Webhook was missed.');
                        
                        // Fetch actual data from response_url
                        let payload;
                        if (res.response_url) {
                            console.log('   📡 Fetching data from response_url...');
                            const dataRes = await fal.queue.result(model, { requestId: requestId });
                            payload = dataRes.data || dataRes;
                        } else {
                            // Fallback: try to get data from response
                            payload = res.data || res.output || res;
                        }
                        
                        if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
                            console.error('   ❌ No data in response!');
                            continue;
                        }
                        
                        // Determine asset type from payload structure
                        const assetType = payload.images ? 'image' : 'audio';
                        console.log(`   Asset Type: ${assetType}`);
                        
                        if (assetType === 'image' && payload.images && payload.images[0]) {
                            console.log(`   Image URL: ${payload.images[0].url.substring(0, 60)}...`);
                        } else if (assetType === 'audio' && payload.audio) {
                            console.log(`   Audio URL: ${payload.audio.url.substring(0, 60)}...`);
                        }
                        
                        // Add to recovered assets
                        recoveredAssets.push({
                            request_id: requestId,
                            output: payload,
                            type: assetType
                        });
                        
                        recovered = true;
                        break; // Successfully recovered, stop trying other models
                        
                    } else if (normalizedStatus === 'ERROR' || normalizedStatus === 'FAILED') {
                        console.error(`   ❌ Fal AI job failed: ${requestId}`);
                        console.error(`   Error details:`, res.error || 'No error details');
                        
                    } else {
                        console.log(`   ⏳ Job still in progress: ${normalizedStatus}`);
                    }
                    
                } catch (error) {
                    console.error(`   ❌ Error polling with model ${model}:`, error.message);
                    // Continue to next model
                }
            }
            
            if (!recovered) {
                console.log(`   ⚠️ Could not recover asset ${requestId} with any model`);
            }
        }
        
        console.log(`\n📦 Recovery Summary:`);
        console.log(`   Missing Assets: ${missingIds.length}`);
        console.log(`   Recovered Assets: ${recoveredAssets.length}`);
        
        // 7. Update Firestore with recovered assets
        if (recoveredAssets.length > 0) {
            console.log('\n💾 Updating Firestore with recovered assets...');
            
            const updatedAssetResults = [...assetResults, ...recoveredAssets];
            
            await jobRef.update({
                completedAssets: updatedAssetResults.length,
                assetResults: updatedAssetResults,
                processingLock: false
            });
            
            console.log(`   ✅ Updated! Total assets now: ${updatedAssetResults.length}/${expectedAssets}`);
            
            // 8. Check if all assets are now ready
            if (updatedAssetResults.length >= expectedAssets) {
                console.log('\n🎉 ALL ASSETS NOW COMPLETE!');
                
                // Build Step Function output (same logic as webhook handler)
                console.log('\n🏗️ Building Step Function output...');
                
                const images = updatedAssetResults
                    .filter(r => r.type === 'image')
                    .map(r => r.output.images?.[0]?.url)
                    .filter(Boolean);
                
                console.log(`   Images found: ${images.length}`);
                
                const audioResult = updatedAssetResults.find(r => r.type === 'audio');
                const audioUrl = audioResult?.output?.audio?.url || audioResult?.output?.audio_file?.url || '';
                
                console.log(`   Audio URL: ${audioUrl ? audioUrl.substring(0, 60) + '...' : 'NOT FOUND'}`);
                
                // Build imageTimeline
                const imageTimeline = moments.map((moment, idx) => ({
                    start: moment.start,
                    end: moment.end,
                    topic: moment.topic || `Moment ${idx + 1}`,
                    prompt: moment.prompt || '',
                    imageUrl: images[idx] || null,
                    layout: moment.layout || 'split'
                }));
                
                console.log(`   ImageTimeline items: ${imageTimeline.length}`);
                
                const stepFunctionOutput = {
                    imageTimeline,
                    audioUrl,
                    jobId,
                    userId,
                    status: 'COMPLETED'
                };
                
                // Mark job as completed BEFORE calling SendTaskSuccess
                console.log('\n🔒 Marking job as completed...');
                await jobRef.update({
                    status: 'completed',
                    processingLock: false,
                    completedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                // Resume Step Function
                console.log('\n🚀 Resuming Step Function...');
                console.log('   Task Token:', taskToken.substring(0, 50) + '...');
                
                await sfnClient.send(new SendTaskSuccessCommand({
                    taskToken: taskToken,
                    output: JSON.stringify(stepFunctionOutput),
                }));
                
                console.log('✅ Step Function resumed successfully!');
                console.log('='.repeat(80) + '\n');
                
                return { 
                    allAssetsComplete: true, 
                    recoveredCount: recoveredAssets.length,
                    resumedStepFunction: true
                };
            } else {
                // Still missing some assets
                const stillMissing = expectedAssets - updatedAssetResults.length;
                console.log(`\n⏳ Still missing ${stillMissing} asset(s)`);
                console.log(`   Will retry on next recovery cycle.`);
                console.log('='.repeat(80) + '\n');
                
                return { 
                    allAssetsComplete: false, 
                    stillMissing,
                    recoveredCount: recoveredAssets.length
                };
            }
        } else {
            // No assets recovered
            console.log('\n⏳ No assets recovered this cycle.');
            console.log(`   Still missing: ${missingIds.length} asset(s)`);
            console.log(`   Missing IDs: ${missingIds.join(', ')}`);
            
            // Release lock
            await jobRef.update({ processingLock: false });
            
            console.log('='.repeat(80) + '\n');
            
            return { 
                allAssetsComplete: false, 
                stillMissing: missingIds.length,
                recoveredCount: 0
            };
        }
        
    } catch (error) {
        console.error('\n' + '❌'.repeat(40));
        console.error('RECOVERY LAMBDA ERROR:');
        console.error('❌'.repeat(40));
        console.error('Error Type:', error.constructor.name);
        console.error('Error Message:', error.message);
        console.error('Stack Trace:', error.stack);
        console.error('='.repeat(80) + '\n');
        
        // Release lock on error
        try {
            const jobRef = db.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
            await jobRef.update({ processingLock: false });
        } catch (unlockError) {
            console.error('Failed to release lock:', unlockError.message);
        }
        
        throw error;
    }
};
