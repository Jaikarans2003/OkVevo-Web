const admin = require('firebase-admin');

// Using the key directly without dotenv for stability
const saBase64 = 'eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6InRleHQydmlkZW8tMTZjYmYiLCJwcml2YXRlX2tleV9pZCI6IjY5ZjIxYjU2ZjhkZjllMTkyNzk0NWIyNzhmYTZlOGFjMTUzMzg2ZTciLCJwcml2YXRlX2tleSI6Ii0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZBSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS1l3Z2dTaUFnRUFBb0lCQVFESkgveEZXczM4V2tPVVxubnR5ZHdNdnRIOWlmT094MVJEL2liWDFPSndJK1cvQjM1T1gvVG5pdE9zelVNWFJWMFJLdkFTQXVBMDEyY0syT1xudE4vRHVieWdPQmRTYkFSNCtJc2tHRXdxc3pqbFZlZVFOclJNcFA4Rm0zZFJFRGRBUzBKWWxnRW5HalZPckVMT1xuTWhkOFJsS0NkdURxSXd1Vm4xZ3FxVGJWMWtxS2w2MlBwQXN0THZhMGpIMFJraitDWU1UZ2N3S2dYaGVLMVZwMVxubXZ0UVcvOFFDWkVhZ08zL0s5dWYrT1E3V0hLVnQwVndEMm9NcUxrSXpTRkZGL0thbjlMeDM3Vm9XdERmdSsyTVxuRXZ6UFhka0RxbUlIU25YUUdycURQeE40ZFBNMWZucGV5bFNwYjZ0Ky9vMkpFUnQyRmNxMkpmbis1clR0OVpGMlxuaWN0MVU5cDVBZ01CQUFFQ2dnRUFJZzhrMXpEY3E2UzBoNVZNZW5tRS96T3lxU29JWHdadkJCN3pCcHBVQnEvbVxubmNNWlVONGUwUVVoWFRpL3dPMmVLcDAzOEJyV2toMWNRc3V1RGhUazFNUVM3UDRHVnQ4T0h3OXZUSmJicG5pZ1xuOVhyU0Z4Mms0elB6NVhvbnhSOUpqYnRmV0JvWDEyb1VDUnVSL3hWZ2tSL2xFRGxkazVtdm9rL1VEYXZUcFRyalxuNVlUOEJlMXgySGdlYk1qa1BwaVMzdS8vc3dyaGgrMTR6STVQVUl5a2tFT0dwRDZPUFJxdXRSNFh2TVRuRmgraFxuQ0VrL1JySEUrVnBTMitZWlpvd3V2anhDdyt6Q2l6NlZITG1nb3MzcHFpRTVGQmpaZFpOWTBsQk1ONFN0eUxQcVxuL3hoSkkxWkFiWnJGaVlRL0NSOFlyMDY0YkEyQWxlcVFicDRnRU1zbjlRS0JnUUR4V0plTkdzYUxOSHRXZDIxWFxuM1pYT3orRnhKcVhCTmVFSzl3aVduZkFMVTJVa0JvMXZaVFdYUlY5YzkzbW1MWlRzdVBQR3h3YkJlNlpzSlRVT1xuUVdWRmQrMGEzdlA3VjFLTzBib0k5WUtnbWc5eHdSbXBDU1JZNFRreEhBYkNjUXM2QXRiUlJDbG0xNkVxZUZyQlxubE4vMm1Wc3k4Z0hIcUd6MFp3bUtZZWNqYlFLQmdRRFZWalY1cVpUKzYra1FOT0sxWWJVZm9YS2pjQTJpM2FYRVxuMmZRdWpSYlcwYlMxSk1NaFBEbjcwRkhJWXJhSWVZaDBGZnNKam82WHhSVEJ1Ykl1QTdJTEFGL2gwMnFZUHBuY1xuQ3MzcVd0Z2M0eCtKMkVwK3NyblNkem5LRTNrTnY4VE9EVWFXbitnazUrQ3owaWVYRDdvYjZPZmU4bXBZNHFxVFxucyt0S2ZxYWZ2UUtCZ0RTeHVCMHAzSEdtV3N1Tk5jVjZidXdCdldJOEl2S2xkZVl6KzU4UENzc2VRVFgxYkVvSFxuR2dWV016VVVIMjVtQTE4UUhzR20wTlhMenBGTUttSmJhdVlaQWg3YzBQNXVtV3J2WmFQeEhyMDhCZVU3V1FQc1xuS0JCejFFM2hwYVFzbEZ2dEpNUDZFdVFPYm5UY1pFeGgyZWg0b1UzbFF2ZzUwTmduNnhCWXdlT2RBb0dBUWYxWVxuclRsM2pTTU1CS2RYT1NQd0VzaXQzVUJiOTNUNFFkdnBYRHpvUTZxNmF3M2tEZlBETzlGRWV1ZU43c2twSEQ5d1xuVjVSeEp5RWZPbzFtUURXRWJVTEFaZW92bnNnK2I0SW9EOFhwODRXTnkrWExwVVZEbFlhcnFZWThlN1JGL0RhL1xuRHZpSHBtTFRic3dpMHVkYWVpZWhFYVdLbjlQOVQ1TG54VE5IOTBFQ2dZQkNKTXJsQ0IzOGVCRnE4RkZiQ1F0ZVxuNzRKMTArc0hLOGJPZjBvbTdKaWhIS1Fmemd0S2I0aGpNMnNDVWxTeXk4RnRWMytUSHlDcFBJQkV3RG9ocVAxalxuT0FIM1ViQjhCOUlCRXdwbzRmM0x0aW02YTNZUER3Z2hpMEVqY1JzMHRka0lYcEgvb1hrSDJnbjZydThkVHNCS1xuQ0pQZENuUFp3ciszWnVhRXhMaEkvUT09XG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLCJjbGllbnRfZW1haWwiOiJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0B0ZXh0MnZpZGVvLTE2Y2JmLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwiY2xpZW50X2lkIjoiMTEyMjYzMzI5MTg5ODg2ODMyNjE0IiwiYXV0aF91cmkiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsInRva2VuX3VyaSI6Imh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjoiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YxL2NlcnRzIiwiY2xpZW50X3g1MDlfY2VydF91cmwiOiJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L2ZpcmViYXNlLWFkbWluc2RrLWZic3ZjJTQwdGV4dDJ2aWRlby0xNmNiZi5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsInVuaXZlcnNlX2RvbWFpbiI6Imdvb2dsZWFwaXMuY29tIn0=';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(saBase64, 'base64').toString())) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').get();
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
              return; 
          }
      }
    }
  }
}
run().catch(console.error).finally(() => process.exit(0));
