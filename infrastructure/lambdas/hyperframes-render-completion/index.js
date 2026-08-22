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

/** keep in sync with services/agent/src/storage.ts renderSnapshot → draft_video.metadata
 * Locked keys: orientation, speaker_video_url, speaker_audio_url, manim_clips,
 * transcript_words, total_duration, segments_plan, composition_manifest_url, brand_colors
 */
function draftMetadataFromRenderSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return undefined;
  if (
    (snap.orientation !== 'horizontal' && snap.orientation !== 'vertical') ||
    typeof snap.speaker_video_url !== 'string' ||
    !Array.isArray(snap.manim_clips) ||
    !Array.isArray(snap.transcript_words) ||
    typeof snap.total_duration !== 'number' ||
    !snap.segments_plan ||
    !Array.isArray(snap.segments_plan.segments)
  ) {
    return undefined;
  }
  const meta = {
    orientation: snap.orientation,
    speaker_video_url: snap.speaker_video_url,
    manim_clips: snap.manim_clips,
    transcript_words: snap.transcript_words,
    total_duration: snap.total_duration,
    segments_plan: snap.segments_plan,
  };
  if (snap.speaker_audio_url != null && snap.speaker_audio_url !== '') {
    meta.speaker_audio_url = snap.speaker_audio_url;
  }
  if (typeof snap.composition_manifest_url === 'string' && snap.composition_manifest_url) {
    meta.composition_manifest_url = snap.composition_manifest_url;
  }
  if (snap.brand_colors) {
    meta.brand_colors = snap.brand_colors;
  }
  return meta;
}

export function parseOutputKey(key) {
  const match =
    /^renders\/users\/([^/]+)\/sessions\/([^/]+)\/((?:final(?:_\d+)?|draft_video|(?:edu-video|talking-head)(?:_\d+)?)\.mp4)$/.exec(
      key
    );
  if (!match) throw new Error('Unexpected render output key');

  const userId = decodeURIComponent(match[1]);
  const sessionId = decodeURIComponent(match[2]);
  const basename = match[3];
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
  return { userId, sessionId, basename };
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

async function completeSuccessfulRender(userId, sessionId, s3Location, basename) {
  const { db, bucket } = await getFirebase();
  const sessionRef = db.collection('sessions').doc(sessionId);
  const current = await sessionRef.get();
  if (!current.exists || current.data()?.userId !== userId) {
    throw new Error('Render session ownership mismatch');
  }
  // SUCCEEDED + draftVideoUrl → return existing URL; do not touch renderSnapshot.
  // keep in sync with services/agent/src/storage.ts finalizeRenderFromLocalFile
  // Note: no ffmpeg in this Lambda — faststart remux happens on agent finalize
  // path (finalizeRenderFromLocalFile) and via scripts/remux-session-videos.ts.
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

  const firebasePath = `users/${userId}/sessions/${sessionId}/${basename}`;
  const file = bucket.file(firebasePath);
  const safeBasename = basename.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'download';
  await pipeline(
    object.Body,
    file.createWriteStream({
      resumable: false,
      metadata: {
        contentType: 'video/mp4',
        contentDisposition: `attachment; filename="${safeBasename}"`,
      },
    })
  );
  await file.makePublic();
  const videoUrl = `https://storage.googleapis.com/${bucket.name}/${firebasePath}`;

  // keep in sync with services/agent/src/storage.ts renderSnapshot → draft_video.metadata
  const metadata = draftMetadataFromRenderSnapshot(current.data()?.renderSnapshot);
  await db
    .collection('users')
    .doc(userId)
    .collection('sessions')
    .doc(sessionId)
    .collection('assets')
    .add({
      kind: 'draft_video',
      url: videoUrl,
      label: basename,
      status: 'ready',
      createdAt: FieldValue.serverTimestamp(),
      ...(metadata ? { metadata } : {}),
    });
  await sessionRef.set(
    {
      renderStatus: 'SUCCEEDED',
      renderError: FieldValue.delete(),
      draftVideoUrl: videoUrl,
      pipelinePhase: 7,
      pipelineStatus: 'complete',
      pipelineUpdatedAt: FieldValue.serverTimestamp(),
      // First success only: clear stash so a later scaffold does not attach to this draft.
      renderSnapshot: FieldValue.delete(),
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
  const { userId, sessionId, basename } = parseOutputKey(s3Location.key);

  if (eventStatus === 'SUCCEEDED') {
    const draftVideoUrl = await completeSuccessfulRender(
      userId,
      sessionId,
      s3Location,
      basename
    );
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
