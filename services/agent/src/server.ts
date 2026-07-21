import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { pipeAgentStream, runAgent } from './agent';
import { CheckpointConflictError } from './checkpoint';
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
import { deliverEvent, parseRenderEvent } from './deliverEvent';
import { parseTaggedAssets } from './taggedAssets';

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
    // HeyGen's hyperframes webhook sends a legacy `Signature` header; the v3
    // scheme uses `Heygen-Signature` (+ timestamp). Accept either.
    const verified = verifyHeygenSignature(
      rawBody,
      req.header('Heygen-Signature') ?? req.header('Signature') ?? undefined,
      req.header('Heygen-Timestamp') ?? undefined,
      secret
    );
    if (!verified.ok) {
      res.status(verified.status).send(verified.error);
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

    const eventType = event.event_type ?? '';
    const eventData = event.event_data ?? {};
    const sessionId =
      typeof eventData.callback_id === 'string' ? eventData.callback_id : null;

    // Dedup key: prefer Heygen-Event-Id, but legacy deliveries omit it, so fall
    // back to render_id (stable across retries of the same delivery). finalize
    // is idempotent, so processing without a key is still safe.
    const renderId =
      typeof eventData.render_id === 'string' ? eventData.render_id : null;
    const dedupKey = req.header('Heygen-Event-Id') ?? renderId ?? sessionId;
    if (dedupKey) {
      const claimed = await claimHeygenEvent(dedupKey);
      if (!claimed) {
        res.status(200).send('ok');
        return;
      }
    }

    if (!sessionId) {
      console.error('[heygen webhook] missing callback_id', eventType, dedupKey);
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

// Bedrock AgentCore Runtime contract (keep /health + /chat for local Compose)
app.get('/ping', (_req, res) => {
  res.json({ status: 'Healthy' });
});

app.post('/invocations', async (req, res) => {
  try {
    const input = (req.body?.input ?? req.body ?? {}) as Record<string, unknown>;
    const prompt =
      (typeof input.prompt === 'string' && input.prompt) ||
      (typeof input.userMessage === 'string' && input.userMessage) ||
      (typeof input.message === 'string' && input.message) ||
      '';

    if (!prompt.trim()) {
      res.status(400).json({
        error: "No prompt found in input. Provide input.prompt (AgentCore) or a message.",
      });
      return;
    }

    const sessionId =
      (typeof input.sessionId === 'string' && input.sessionId) ||
      (typeof req.body?.sessionId === 'string' && req.body.sessionId) ||
      crypto.randomUUID();
    const userId =
      (typeof input.userId === 'string' && input.userId) ||
      (typeof req.body?.userId === 'string' && req.body.userId) ||
      'agentcore';
    const videoUrl =
      typeof input.videoUrl === 'string' ? input.videoUrl : undefined;
    const videoName =
      typeof input.videoName === 'string' ? input.videoName : undefined;
    const taggedAssets = parseTaggedAssets(input.taggedAssets);
    const skillId =
      typeof input.skillId === 'string' ? input.skillId : undefined;
    const model = typeof input.model === 'string' ? input.model : undefined;
    const source = typeof input.source === 'string' ? input.source : undefined;
    const pipelineMode =
      input.pipelineMode === 'auto' || input.pipelineMode === 'ask'
        ? input.pipelineMode
        : undefined;
    const checkpointAnswer =
      input.checkpointAnswer &&
      typeof input.checkpointAnswer === 'object' &&
      typeof (input.checkpointAnswer as { checkpointId?: string }).checkpointId === 'string'
        ? (input.checkpointAnswer as {
            checkpointId: string;
            type: 'approve' | 'choice' | 'revision' | 'freeform';
            text: string;
            choiceId?: string;
          })
        : undefined;

    // Webhook turns short-circuit the LLM: write the render result directly.
    if (source === 'webhook') {
      const message = await deliverEvent(
        { sessionId, userId },
        parseRenderEvent(prompt)
      );
      res.json({
        output: {
          message,
          sessionId,
          userId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const accept = String(req.headers.accept ?? '');
    const wantsStream =
      input.stream === true ||
      accept.includes('text/event-stream') ||
      accept.includes('text/plain') ||
      req.headers['x-vercel-ai-ui-message-stream'] === 'v1';

    const result = await runAgent({
      userMessage: prompt,
      sessionId,
      userId,
      videoUrl,
      videoName,
      taggedAssets,
      skillId,
      model,
      pipelineMode,
      checkpointAnswer,
    });

    if (wantsStream) {
      // Live UI message stream (same protocol as /chat) for AgentCore → Next → useChat
      pipeAgentStream(result, res, { sessionId, userId });
      return;
    }

    const text = await result.result.text;
    res.json({
      output: {
        message: text,
        sessionId,
        userId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invocation failed';
    console.error('[agentcore] /invocations error:', message);
    if (!res.headersSent) {
      const status = error instanceof CheckpointConflictError ? 409 : 500;
      res.status(status).json({ error: message });
    } else {
      res.end();
    }
  }
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
    videoName,
    taggedAssets: rawTaggedAssets,
    model,
    skillId,
    pipelineMode: bodyPipelineMode,
    checkpointAnswer,
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

  const pipelineMode =
    bodyPipelineMode === 'auto' || bodyPipelineMode === 'ask'
      ? bodyPipelineMode
      : 'ask';
  const taggedAssets = parseTaggedAssets(rawTaggedAssets);

  try {
    const agentRun = await runAgent({
      userMessage,
      sessionId,
      userId,
      videoUrl,
      videoName,
      taggedAssets,
      model,
      skillId,
      pipelineMode,
      checkpointAnswer,
    });

    pipeAgentStream(agentRun, res, { sessionId, userId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) {
      const status = error instanceof CheckpointConflictError ? 409 : 500;
      res.status(status).json({ error: message });
    } else {
      res.end();
    }
  }
});

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OkVevo Agent running on 0.0.0.0:${PORT}`);
});
