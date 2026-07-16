import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { pipeAgentStream, runAgent } from './agent';
import { auth, db } from './firebase';
import {
  fetchHeygenRender,
  isSfnExecutionArn,
  verifyHeygenSignature,
  videoUrlFromEventData,
} from './heygenWebhook';
import {
  claimHeygenEvent,
  finalizeRenderFromS3,
  finalizeRenderFromUrl,
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

// Raw body required for HeyGen HMAC — must mount before express.json()
app.post(
  '/webhooks/heygen',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const secret = process.env.HEYGEN_WEBHOOK_SECRET;
    if (!secret) {
      res.status(500).send('webhook secret not configured');
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    const verified = verifyHeygenSignature(
      rawBody,
      req.header('Heygen-Signature') ?? undefined,
      req.header('Heygen-Timestamp') ?? undefined,
      secret
    );
    if (!verified.ok) {
      res.status(verified.status).send(verified.error);
      return;
    }

    const eventId = req.header('Heygen-Event-Id');
    if (!eventId) {
      res.status(400).send('missing event id');
      return;
    }

    let event: {
      event_type?: string;
      event_data?: Record<string, unknown>;
    };
    try {
      event = JSON.parse(rawBody.toString('utf8')) as typeof event;
    } catch {
      res.status(400).send('invalid json');
      return;
    }

    const claimed = await claimHeygenEvent(eventId);
    if (!claimed) {
      res.status(200).send('ok');
      return;
    }

    const eventType = event.event_type ?? '';
    const eventData = event.event_data ?? {};
    const sessionId =
      typeof eventData.callback_id === 'string' ? eventData.callback_id : null;

    if (!sessionId) {
      console.error('[heygen webhook] missing callback_id', eventType, eventId);
      res.status(200).send('ok');
      return;
    }

    const sessionSnap = await db.collection('sessions').doc(sessionId).get();
    const userId = sessionSnap.data()?.userId;
    if (typeof userId !== 'string') {
      console.error('[heygen webhook] unknown session', sessionId);
      res.status(200).send('ok');
      return;
    }

    try {
      if (eventType === 'hyperframes_video.fail') {
        const message =
          (typeof eventData.failure_message === 'string' && eventData.failure_message) ||
          (typeof eventData.error === 'string' && eventData.error) ||
          'HeyGen cloud render failed';
        await recordRenderFailure(userId, sessionId, 'FAILED', message);
        res.status(200).send('ok');
        return;
      }

      if (eventType === 'hyperframes_video.success') {
        let videoUrl = videoUrlFromEventData(eventData);
        if (!videoUrl) {
          const renderId =
            (typeof eventData.render_id === 'string' && eventData.render_id) ||
            null;
          if (!renderId) {
            throw new Error('success event missing video_url and render_id');
          }
          const detail = await fetchHeygenRender(renderId);
          if (detail.status !== 'completed' || !detail.video_url) {
            throw new Error(
              `render ${renderId} not completed (${detail.status}): ${detail.failure_message ?? ''}`
            );
          }
          videoUrl = detail.video_url;
        }
        await finalizeRenderFromUrl(userId, sessionId, videoUrl);
        res.status(200).send('ok');
        return;
      }

      res.status(200).send('ok');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[heygen webhook] finalize failed', sessionId, message);
      // Non-2xx so HeyGen retries; Check Now can also finalize.
      res.status(500).send('finalize failed');
    }
  }
);

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

    if (!isSfnExecutionArn(job.executionArn)) {
      const detail = await fetchHeygenRender(job.executionArn);
      if (detail.status === 'completed' && detail.video_url) {
        const videoUrl = await finalizeRenderFromUrl(
          userId,
          req.params.sessionId,
          detail.video_url
        );
        res.json({ renderStatus: 'SUCCEEDED', draftVideoUrl: videoUrl });
        return;
      }
      if (detail.status === 'failed') {
        await recordRenderFailure(
          userId,
          req.params.sessionId,
          'FAILED',
          detail.failure_message || 'HeyGen cloud render failed'
        );
        res.json({ renderStatus: 'FAILED', errors: [detail.failure_message] });
        return;
      }
      res.json({
        renderStatus: 'RUNNING',
        heygenStatus: detail.status,
      });
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
