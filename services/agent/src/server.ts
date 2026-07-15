import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { pipeAgentStream, runAgent } from './agent';
import { auth } from './firebase';
import {
  finalizeRenderFromS3,
  getRenderJob,
  recordRenderFailure,
} from './storage';

// ponytail: Docker-only — local `node` on 3001 collides with `docker compose up agent`
if (process.env.DOCKER_AGENT !== '1') {
  console.error(
    'Agent runs in Docker only: docker compose up agent --build\n' +
      '(Local npm run dev/start is disabled to avoid port 3001 conflicts.)'
  );
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/renders/:sessionId/check', async (req, res) => {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const userId = (await auth.verifyIdToken(token)).uid;
    const job = await getRenderJob(userId, req.params.sessionId);
    if (!job) {
      res.status(404).json({ error: 'Render job not found' });
      return;
    }

    const region = process.env.AWS_REGION;
    const bucketName = process.env.HYPERFRAMES_BUCKET;
    if (!region || !bucketName) {
      throw new Error('Missing AWS_REGION or HYPERFRAMES_BUCKET');
    }

    const { getRenderProgress } = await import('@hyperframes/aws-lambda/sdk');
    const progress = await getRenderProgress({
      executionArn: job.executionArn,
      region,
    });

    if (progress.status === 'SUCCEEDED') {
      const videoUrl = await finalizeRenderFromS3(
        userId,
        req.params.sessionId,
        bucketName,
        job.outputKey,
        region
      );
      res.json({ renderStatus: progress.status, draftVideoUrl: videoUrl });
      return;
    }

    if (['FAILED', 'TIMED_OUT', 'ABORTED'].includes(progress.status)) {
      const error =
        progress.errors.map((item) => `${item.error}: ${item.cause}`).join('\n') ||
        `Render ${progress.status.toLowerCase()}`;
      await recordRenderFailure(
        userId,
        req.params.sessionId,
        progress.status as 'FAILED' | 'TIMED_OUT' | 'ABORTED',
        error
      );
    }

    res.json({
      renderStatus: progress.status,
      progress: progress.overallProgress,
      errors: progress.errors,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to check render';
    const status = message.includes('Firebase ID token') ? 401 : 500;
    res.status(status).json({ error: message });
  }
});

app.post('/chat', async (req, res) => {
  const {
    messages,
    sessionId: bodySessionId,
    userId: bodyUserId,
    videoUrl,
    model,
    skillId,
  } = req.body;

  const lastMessage = messages?.at(-1);
  const userMessage =
    typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : Array.isArray(lastMessage?.parts)
        ? lastMessage.parts
            .filter((p: { type: string }) => p.type === 'text')
            .map((p: { text?: string }) => p.text ?? '')
            .join('')
        : '';

  const sessionId = bodySessionId ?? crypto.randomUUID();
  const userId = bodyUserId ?? 'anonymous';

  if (!userMessage) {
    res.status(400).json({ error: 'userMessage is required' });
    return;
  }

  try {
    const result = await runAgent({
      userMessage,
      sessionId,
      userId,
      videoUrl,
      model,
      skillId,
    });

    pipeAgentStream(result, res, { sessionId, userId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    } else {
      res.end();
    }
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`OkVevo Agent running on port ${PORT}`);
});
