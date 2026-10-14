# Cloud Run Job: Fal billing-events capture. Build context = OkVevo-Web/.
# Only the capture graph is copied (.dockerignore). Never FAL_KEY.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/lib/fal/capture.ts src/lib/fal/capture.ts
COPY src/lib/gateway/reserve.ts src/lib/gateway/reserve.ts
COPY src/lib/gateway/captureCredits.ts src/lib/gateway/captureCredits.ts
COPY src/lib/ops/alert.ts src/lib/ops/alert.ts
COPY scripts/fal-capture-job.ts scripts/fal-capture-job.ts
RUN npx --yes esbuild scripts/fal-capture-job.ts \
  --bundle --platform=node --format=esm \
  --outfile=dist/capture.mjs --packages=external \
  --alias:@=./src
USER node
CMD ["node", "dist/capture.mjs"]
