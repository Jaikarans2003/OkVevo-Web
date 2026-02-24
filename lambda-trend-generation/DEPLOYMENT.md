# Lambda Trend Generation — Deployment Guide

## Prerequisites

1. **AWS CLI** configured with credentials
2. **Node.js 18+** installed
3. **Kling AI API keys** from [klingai.com](https://klingai.com)

## 1. Create SQS FIFO Queue

```bash
aws sqs create-queue \
  --queue-name brick2brick-trend-photos.fifo \
  --attributes '{
    "FifoQueue": "true",
    "ContentBasedDeduplication": "false",
    "VisibilityTimeout": "900",
    "MessageRetentionPeriod": "86400"
  }' \
  --region us-east-1
```

Save the QueueUrl from the output.

## 2. Install Dependencies & Package

```bash
cd lambda-trend-generation
npm install
```

Create the deployment ZIP:

```bash
# Windows PowerShell
Compress-Archive -Path index.js, package.json, node_modules -DestinationPath lambda-trend-generation.zip -Force

# Linux/Mac
zip -r lambda-trend-generation.zip index.js package.json node_modules/
```

## 3. Create Lambda Function

```bash
aws lambda create-function \
  --function-name brick2brick-trend-generation \
  --runtime nodejs18.x \
  --handler index.handler \
  --timeout 900 \
  --memory-size 1024 \
  --zip-file fileb://lambda-trend-generation.zip \
  --role arn:aws:iam::315974965935:role/VidStitcherLambdaRole \
  --environment "Variables={
    FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account>,
    FIREBASE_STORAGE_BUCKET=text2video-16cbf.firebasestorage.app,
    GEMINI_API_KEY=<your-gemini-key>,
    KLING_ACCESS_KEY=<your-kling-ak>,
    KLING_SECRET_KEY=<your-kling-sk>
  }" \
  --region us-east-1
```

## 4. Add SQS Trigger

```bash
aws lambda create-event-source-mapping \
  --function-name brick2brick-trend-generation \
  --event-source-arn arn:aws:sqs:us-east-1:315974965935:brick2brick-trend-photos.fifo \
  --batch-size 1 \
  --region us-east-1
```

## 5. Grant SQS Permissions to IAM User

Make sure the `VidStitcher` IAM user has `sqs:SendMessage` permission for the new queue:

```bash
aws iam put-user-policy \
  --user-name VidStitcher \
  --policy-name TrendPhotosSQSAccess \
  --policy-document '{
    "Version": "2012-01-01",
    "Statement": [{
      "Effect": "Allow",
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:us-east-1:315974965935:brick2brick-trend-photos.fifo"
    }]
  }'
```

## 6. Environment Variables

Add to your `.env` file:

```
SQS_TREND_PHOTOS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/315974965935/brick2brick-trend-photos.fifo
KLING_ACCESS_KEY=<your-kling-ak>
KLING_SECRET_KEY=<your-kling-sk>
```

## 7. Update Lambda (Future Deployments)

```bash
cd lambda-trend-generation
npm install
Compress-Archive -Path index.js, package.json, node_modules -DestinationPath lambda-trend-generation.zip -Force

aws lambda update-function-code \
  --function-name brick2brick-trend-generation \
  --zip-file fileb://lambda-trend-generation.zip \
  --region us-east-1
```
