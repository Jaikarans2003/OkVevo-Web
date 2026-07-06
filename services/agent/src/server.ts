import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { pipeAgentStream, runAgent } from './agent';

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
