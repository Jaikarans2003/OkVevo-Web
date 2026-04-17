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
    credentials: process.env.FAL_API_VIDEO || process.env.FAL_API_KEY
});

// Configure AWS Step Functions client
const sfnClient = new SFNClient({
    region: process.env.AWS_REGION || 'us-east-1'
});

exports.handler = async (event) => {
    const { jobId, userId } = event;
    
    console.log('\n' + '='.repeat(80));
    console.log('🔄 LIPSYNC RECOVERY LAMBDA INVOKED');
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
            return { allJobsComplete: false, error: 'Job not found' };
        }
        
        const jobData = jobDoc.data();
        const { 
            requestIds = [], 
            lipsyncResults = [], 
            expectedLipsyncResults = 2, 
            taskToken,
            status,
            processingLock = false
        } = jobData;
        
        console.log('   Expected Jobs:', expectedLipsyncResults);
        console.log('   Completed Jobs:', lipsyncResults.length);
        console.log('   Request IDs:', requestIds.length);
        console.log('   Job Status:', status);
        console.log('   Processing Lock:', processingLock);
        console.log('   Task Token:', taskToken ? taskToken.substring(0, 30) + '...' : '❌ MISSING');
        
        // Guard: taskToken is required to resume the Step Function
        if (!taskToken) {
            console.error('❌ CRITICAL: taskToken is missing from Firestore! The lipsync-submit lambda must store taskToken in aiInfluencerJobs.');
            throw new Error('taskToken missing from Firestore job document. Ensure okvevo-lipsync-submit saves taskToken to aiInfluencerJobs.');
        }
        
        // 2. Check if already completed or all jobs received
        if (status === 'lipsync-completed' || lipsyncResults.length >= expectedLipsyncResults) {
            console.log('\n✅ Job already completed. Building result from Firestore data...');
            
            // Extract results from Firestore
            const lipsyncResult = lipsyncResults.find(r => r.type === 'lipsync');
            const whisperResult = lipsyncResults.find(r => r.type === 'whisper-transcription');
            
            if (!lipsyncResult) {
                console.error('❌ Lipsync result missing in Firestore!');
                return { allJobsComplete: false, error: 'Lipsync result missing' };
            }
            
            const lipSyncVideoUrl = lipsyncResult.output.video?.url || lipsyncResult.output.video_url || '';
            const transcription = whisperResult?.output?.text || '';
            const transcriptionChunks = whisperResult?.output?.chunks || [];
            
            console.log(`   LipSync Video URL: ${lipSyncVideoUrl ? lipSyncVideoUrl.substring(0, 60) + '...' : 'MISSING'}`);
            console.log(`   Transcription: ${transcription ? 'Present' : 'Missing'}`);
            console.log(`   Transcription Chunks: ${transcriptionChunks.length}`);
            
            const stepFunctionOutput = {
                request_id: lipsyncResult.request_id,
                status: 'OK',
                output: lipsyncResult.output,
                lipSyncVideoUrl: lipSyncVideoUrl,
                transcription: transcription,
                transcriptionChunks: transcriptionChunks
            };
            
            // CRITICAL FIX: Call SendTaskSuccess to resume the Submit_LipSync task
            // This ensures the first branch of the parallel state completes properly
            if (taskToken) {
                console.log('\n🚀 Resuming Step Function with already-completed data...');
                console.log('   Task Token:', taskToken.substring(0, 50) + '...');
                
                try {
                    await sfnClient.send(new SendTaskSuccessCommand({
                        taskToken: taskToken,
                        output: JSON.stringify(stepFunctionOutput),
                    }));
                    console.log('✅ Step Function resumed successfully!');
                } catch (err) {
                    console.error('❌ Failed to resume Step Function:', err.message);
                    // If SendTaskSuccess fails (e.g., token already used), just return the data
                }
            }
            
            return {
                allJobsComplete: true,
                alreadyCompleted: true,
                lipSyncResult: stepFunctionOutput
            };
        }
        
        // 4. Acquire processing lock
        if (processingLock) {
            console.log('\n⏳ Another process is already handling this job. Skipping.');
            return { allJobsComplete: false, locked: true };
        }
        
        console.log('\n🔒 Acquiring processing lock...');
        await jobRef.update({ processingLock: true });
        
        // 5. Find missing request_ids
        console.log('\n🔍 Identifying missing jobs...');
        
        // BACKWARD COMPATIBILITY: If requestIds missing, query falJobs collection
        if (!requestIds || requestIds.length === 0) {
            console.log('   ⚠️ requestIds array missing (old job format)');
            console.log('   🔎 Querying falJobs collection for this job...');
            
            const falJobsSnapshot = await db.collection('falJobs')
                .where('jobId', '==', jobId)
                .get();
            
            // Filter for lipsync and whisper jobs only
            const lipsyncWhisperDocs = falJobsSnapshot.docs.filter(doc => {
                const data = doc.data();
                return data.type === 'lipsync' || data.type === 'whisper-transcription';
            });
            
            requestIds = lipsyncWhisperDocs.map(doc => doc.id);
            console.log(`   ✅ Found ${requestIds.length} request IDs from falJobs collection`);
        }
        
        const completedIds = lipsyncResults.map(r => r.request_id);
        const missingIds = requestIds.filter(id => !completedIds.includes(id));
        
        console.log('   Completed IDs:', completedIds);
        console.log('   Missing IDs:', missingIds);
        console.log('   Missing Count:', missingIds.length);
        
        if (missingIds.length === 0) {
            console.log('\n✅ No missing jobs found!');
            await jobRef.update({ processingLock: false });
            return { allJobsComplete: true, noMissingJobs: true };
        }
        
        // 6. Poll Fal AI for each missing request_id
        console.log('\n🔎 Polling Fal AI for missing jobs...');
        const recoveredJobs = [];
        
        for (const requestId of missingIds) {
            console.log(`\n   Checking request_id: ${requestId}`);
            
            // Get model info from falJobs collection
            const falJobDoc = await db.collection('falJobs').doc(requestId).get();
            
            let model, jobType;
            
            if (!falJobDoc.exists) {
                console.warn(`   ⚠️ falJobs mapping not found for ${requestId}`);
                console.log(`   🔄 Attempting fallback: trying veed/lipsync model...`);
                // Fallback: assume it's a lipsync job (most common missing case)
                model = 'veed/lipsync';
                jobType = 'lipsync';
            } else {
                const data = falJobDoc.data();
                model = data.model;
                jobType = data.jobType;
            }
            
            console.log(`   Model: ${model}`);
            console.log(`   Type: ${jobType}`);
            
            try {
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
                    let output;
                    if (res.response_url) {
                        console.log('   � Fetching data from response_url...');
                        const dataRes = await fal.queue.result(model, { requestId: requestId });
                        output = dataRes.data || dataRes;
                    } else {
                        // Fallback: try to get data from response
                        output = res.data || res.output || res;
                    }
                    
                    if (!output || (typeof output === 'object' && Object.keys(output).length === 0)) {
                        console.error('   ❌ No data in response!');
                        continue;
                    }
                    
                    // Log output structure
                    if (jobType === 'lipsync') {
                        const videoUrl = output.video?.url || output.video_url || '';
                        console.log(`   Lipsync Video URL: ${videoUrl.substring(0, 60)}...`);
                    } else if (jobType === 'whisper-transcription') {
                        console.log(`   Whisper Text: ${output.text?.substring(0, 60)}...`);
                        console.log(`   Whisper Chunks: ${output.chunks?.length || 0}`);
                    }
                    
                    // Add to recovered jobs
                    recoveredJobs.push({
                        request_id: requestId,
                        type: jobType,
                        output: output
                    });
                    
                } else if (normalizedStatus === 'ERROR' || normalizedStatus === 'FAILED') {
                    console.error(`   ❌ Fal AI job failed: ${requestId}`);
                    const errorMsg = res.error || 'No error details provided by Fal AI';
                    console.error(`   Error details:`, errorMsg);
                    
                    // Mark the main job as failed in Firestore
                    await jobRef.update({
                        status: 'error',
                        errorMessage: `Fal AI Lipsync Job Failed: ${errorMsg}`,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        processingLock: false
                    });
                    
                    console.log(`   ❌ Marked main job ${jobId} as error and released lock`);
                    return { allJobsComplete: false, errorDetected: true };
                    
                } else {
                    console.log(`   ⏳ Job still in progress: ${normalizedStatus}`);
                }
                
            } catch (error) {
                console.error(`   ❌ Error polling Fal AI for ${requestId}:`, error.message);
            }
        }
        
        console.log(`\n📦 Recovery Summary:`);
        console.log(`   Missing Jobs: ${missingIds.length}`);
        console.log(`   Recovered Jobs: ${recoveredJobs.length}`);
        
        // 7. Update Firestore with recovered jobs
        if (recoveredJobs.length > 0) {
            console.log('\n💾 Updating Firestore with recovered jobs...');
            
            const updatedLipsyncResults = [...lipsyncResults, ...recoveredJobs];
            
            await jobRef.update({
                completedLipsyncResults: updatedLipsyncResults.length,
                lipsyncResults: updatedLipsyncResults,
                processingLock: false
            });
            
            console.log(`   ✅ Updated! Total jobs now: ${updatedLipsyncResults.length}/${expectedLipsyncResults}`);
            
            // 8. Check if all jobs are now ready
            if (updatedLipsyncResults.length >= expectedLipsyncResults) {
                console.log('\n🎉 ALL JOBS NOW COMPLETE!');
                
                // Extract results
                const lipsyncResult = updatedLipsyncResults.find(r => r.type === 'lipsync');
                const whisperResult = updatedLipsyncResults.find(r => r.type === 'whisper-transcription');
                
                if (!lipsyncResult) {
                    console.error('❌ Lipsync result missing!');
                    await jobRef.update({ processingLock: false });
                    return { allJobsComplete: false, error: 'Lipsync result missing' };
                }
                
                console.log('\n🏗️ Building Step Function output...');
                
                const lipSyncVideoUrl = lipsyncResult.output.video?.url || lipsyncResult.output.video_url || '';
                console.log(`   LipSync Video URL: ${lipSyncVideoUrl.substring(0, 60)}...`);
                
                const transcription = whisperResult?.output?.text || '';
                const transcriptionChunks = whisperResult?.output?.chunks || [];
                console.log(`   Transcription: ${transcription ? 'Present' : 'Missing'}`);
                console.log(`   Transcription Chunks: ${transcriptionChunks.length}`);
                
                const stepFunctionOutput = {
                    request_id: lipsyncResult.request_id,
                    status: 'OK',
                    output: lipsyncResult.output,
                    lipSyncVideoUrl: lipSyncVideoUrl,
                    transcription: transcription,
                    transcriptionChunks: transcriptionChunks
                };
                
                // Mark job as completed BEFORE calling SendTaskSuccess
                console.log('\n🔒 Marking job as completed...');
                await jobRef.update({
                    status: 'lipsync-completed',
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
                    allJobsComplete: true, 
                    recoveredCount: recoveredJobs.length,
                    resumedStepFunction: true
                };
            } else {
                // Still missing some jobs
                const stillMissing = expectedLipsyncResults - updatedLipsyncResults.length;
                console.log(`\n⏳ Still missing ${stillMissing} job(s)`);
                console.log(`   Will retry on next recovery cycle.`);
                console.log('='.repeat(80) + '\n');
                
                return { 
                    allJobsComplete: false, 
                    stillMissing,
                    recoveredCount: recoveredJobs.length
                };
            }
        } else {
            // No jobs recovered
            console.log('\n⏳ No jobs recovered this cycle.');
            console.log(`   Still missing: ${missingIds.length} job(s)`);
            console.log(`   Missing IDs: ${missingIds.join(', ')}`);
            
            // Release lock
            await jobRef.update({ processingLock: false });
            
            console.log('='.repeat(80) + '\n');
            
            return { 
                allJobsComplete: false, 
                stillMissing: missingIds.length,
                recoveredCount: 0
            };
        }
        
    } catch (error) {
        console.error('\n' + '❌'.repeat(40));
        console.error('LIPSYNC RECOVERY LAMBDA ERROR:');
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
