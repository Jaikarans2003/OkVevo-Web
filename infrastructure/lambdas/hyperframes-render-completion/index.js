import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { DescribeExecutionCommand, SFNClient } from '@aws-sdk/client-sfn';
import { pipeline } from 'node:stream/promises';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const region = process.env.AWS_REGION;
const renderBucket = process.env.HYPERFRAMES_BUCKET;
const secretArn = process.env.FIREBASE_ADMIN_SECRET_ARN;
const firebaseBucket = process.env.FIREBASE_STORAGE_BUCKET;

const s3 = new S3Client({ region });
const secrets = new SecretsManagerClient({ region });
const sfn = new SFNClient({ region });

function parseJson(value, label) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    throw new Error(`Invalid ${label} JSON`);
  }
}

function parseS3Uri(uri) {
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(uri || '');
  if (!match || match[1] !== renderBucket) {
    throw new Error('Execution output is outside the configured render bucket');
  }
  return { bucket: match[1], key: match[2] };
}

export function parseOutputKey(key) {
  const match = /^renders\/users\/([^/]+)\/sessions\/([^/]+)\/draft_video\.mp4$/.exec(key);
  if (!match) throw new Error('Unexpected render output key');

  const userId = decodeURIComponent(match[1]);
  const sessionId = decodeURIComponent(match[2]);
  if (
    !userId ||
    !sessionId ||
    userId.includes('/') ||
    sessionId.includes('/') ||
    encodeURIComponent(userId) !== match[1] ||
    encodeURIComponent(sessionId) !== match[2]
  ) {
    throw new Error('Invalid user or session identifier in render output key');
  }
  return { userId, sessionId };
}

async function getFirebase() {
  if (getApps().length === 0) {
    if (!secretArn || !firebaseBucket) {
      throw new Error('Missing Firebase completion Lambda configuration');
    }
    const secret = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
    if (!secret.SecretString) throw new Error('Firebase Admin secret is empty');
    initializeApp({
      credential: cert(parseJson(secret.SecretString, 'Firebase Admin secret')),
      storageBucket: firebaseBucket,
    });
  }
  return {
    db: getFirestore(),
    bucket: getStorage().bucket(firebaseBucket),
  };
}

async function completeSuccessfulRender(userId, sessionId, s3Location) {
  const { db, bucket } = await getFirebase();
  const sessionRef = db.collection('sessions').doc(sessionId);
  const current = await sessionRef.get();
  if (!current.exists || current.data()?.userId !== userId) {
    throw new Error('Render session ownership mismatch');
  }
  if (
    current.data()?.renderStatus === 'SUCCEEDED' &&
    typeof current.data()?.draftVideoUrl === 'string'
  ) {
    return current.data().draftVideoUrl;
  }

  const object = await s3.send(
    new GetObjectCommand({ Bucket: s3Location.bucket, Key: s3Location.key })
  );
  if (!object.Body) throw new Error('Successful render has no S3 object body');

  const firebasePath = `users/${userId}/sessions/${sessionId}/draft_video.mp4`;
  const file = bucket.file(firebasePath);
  await pipeline(
    object.Body,
    file.createWriteStream({
      resumable: false,
      metadata: { contentType: 'video/mp4' },
    })
  );
  await file.makePublic();
  const videoUrl = `https://storage.googleapis.com/${bucket.name}/${firebasePath}`;
  const draftMetadata = {
    label: 'Draft Video',
    type: 'video',
    createdAt: FieldValue.serverTimestamp(),
  };

  await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .set(
      {
        assets: { draft_video: videoUrl },
        assetMetadata: { draft_video: draftMetadata },
      },
      { merge: true }
    );
  await sessionRef.set(
    {
      assets: { draft_video: videoUrl },
      assetMetadata: { draft_video: draftMetadata },
      renderStatus: 'SUCCEEDED',
      renderError: FieldValue.delete(),
      draftVideoUrl: videoUrl,
      pipelinePhase: 7,
      pipelineStatus: 'complete',
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return videoUrl;
}

export async function handler(event) {
  const executionArn = event?.detail?.executionArn;
  const eventStatus = event?.detail?.status;
  if (!executionArn || !['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'].includes(eventStatus)) {
    throw new Error('Unsupported Step Functions completion event');
  }

  const execution = await sfn.send(new DescribeExecutionCommand({ executionArn }));
  const input = parseJson(execution.input, 'execution input');
  const output = parseJson(execution.output, 'execution output');
  const outputS3Uri = output?.Output?.OutputS3Uri || input.OutputS3Uri;
  const s3Location = parseS3Uri(outputS3Uri);
  const { userId, sessionId } = parseOutputKey(s3Location.key);

  if (eventStatus === 'SUCCEEDED') {
    const draftVideoUrl = await completeSuccessfulRender(userId, sessionId, s3Location);
    return { renderStatus: eventStatus, draftVideoUrl };
  }

  const { db } = await getFirebase();
  const sessionRef = db.collection('sessions').doc(sessionId);
  const session = await sessionRef.get();
  if (!session.exists || session.data()?.userId !== userId) {
    throw new Error('Render session ownership mismatch');
  }
  await sessionRef.set(
    {
      renderStatus: eventStatus,
      renderError: execution.cause || execution.error || `Render ${eventStatus.toLowerCase()}`,
      pipelineStatus: 'failed',
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { renderStatus: eventStatus };
}
