# AI-Influencer Deployment Guide

Complete deployment guide for the AI-Influencer video generation pipeline to AWS Account `052120999576`.

## 📋 Prerequisites

Before running the deployment scripts, ensure you have:

1. **AWS CLI** installed and configured
   ```bash
   aws --version
   # Should show AWS CLI version
   ```

2. **Node.js and npm** installed
   ```bash
   node --version
   npm --version
   ```

3. **AWS Credentials** configured for account `052120999576`
   ```bash
   aws configure
   # Enter your Access Key ID, Secret Access Key, and set region to us-east-1
   ```

4. **Verify AWS Account**
   ```bash
   aws sts get-caller-identity
   # Should show Account: 052120999576
   ```

## 🚀 Quick Start - Deploy Everything

To deploy all Lambda functions and the Step Function state machine:

```bash
cd AI-Influencer
chmod +x deploy-all.sh
./deploy-all.sh
```

This will:
1. ✅ Check prerequisites
2. ✅ Create IAM roles (if needed)
3. ✅ Install dependencies for all Lambdas
4. ✅ Create ZIP files
5. ✅ Deploy all 7 Lambda functions
6. ✅ Deploy Step Function state machine

**Estimated time:** 5-10 minutes

## 🎯 Deploy Individual Lambda

To deploy or update a single Lambda function:

```bash
chmod +x deploy-individual.sh
./deploy-individual.sh <lambda-name>
```

**Example:**
```bash
./deploy-individual.sh okvevo-branding
```

**Available Lambda Functions:**
- `okvevo-ai-prep` - Prepares assets (images + audio) via Fal AI
- `okvevo-branding` - Adds logo watermark and thumbnail generation
- `okvevo-fal-recovery` - Recovery mechanism for Fal AI webhooks
- `okvevo-lipsync-recovery` - Recovery mechanism for lipsync webhooks
- `okvevo-lipsync-submit` - Submits lipsync jobs to Fal AI
- `okvevo-noop` - No-operation Lambda for testing
- `okvevo-renderer` - Renders final video with FFmpeg

## 📦 Lambda Configurations

| Lambda Function | Memory | Timeout | Runtime |
|----------------|--------|---------|---------|
| okvevo-ai-prep | 512 MB | 900s (15min) | Node.js 18 |
| okvevo-branding | 3008 MB | 900s (15min) | Node.js 18 |
| okvevo-fal-recovery | 256 MB | 300s (5min) | Node.js 18 |
| okvevo-lipsync-recovery | 256 MB | 300s (5min) | Node.js 18 |
| okvevo-lipsync-submit | 256 MB | 300s (5min) | Node.js 18 |
| okvevo-noop | 128 MB | 30s | Node.js 18 |
| okvevo-renderer | 512 MB | 900s (15min) | Node.js 18 |

## 🔐 IAM Roles

The deployment script automatically creates two IAM roles:

### 1. Lambda Execution Role
**Name:** `ai-influencer-lambda-role`

**Permissions:**
- AWSLambdaBasicExecutionRole (CloudWatch Logs)
- AWSStepFunctionsFullAccess (Step Functions integration)

### 2. Step Functions Execution Role
**Name:** `ai-influencer-stepfunction-role`

**Permissions:**
- Lambda invocation for all `okvevo-*` functions

## 🔧 Environment Variables

After deployment, you need to set environment variables for each Lambda:

### Required for ALL Lambdas:
```bash
FIREBASE_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account>
FIREBASE_STORAGE_BUCKET=text2video-16cbf.firebasestorage.app
```

### Required for okvevo-ai-prep:
```bash
FAL_API_KEY=<your-fal-api-key>
GEMINI_API_KEY=<your-gemini-api-key>
```

### Required for okvevo-branding:
```bash
FAL_API_IMAGE=<your-fal-api-key>
GEMINI_API_KEY=<your-gemini-api-key>
```

### Required for okvevo-lipsync-submit:
```bash
FAL_API_KEY=<your-fal-api-key>
```

**Set environment variables via AWS CLI:**
```bash
aws lambda update-function-configuration \
  --function-name okvevo-branding \
  --environment "Variables={FIREBASE_SERVICE_ACCOUNT_KEY=xxx,FAL_API_IMAGE=xxx,GEMINI_API_KEY=xxx}" \
  --region us-east-1
```

## 📊 Step Function State Machine

**Name:** `ai-influencer-pipeline`

**ARN:** `arn:aws:states:us-east-1:052120999576:stateMachine:ai-influencer-pipeline`

The state machine orchestrates the entire video generation pipeline:

1. **AI_Prep** - Generate images and audio
2. **Recovery Loop** - Handle webhook failures
3. **Wait for Avatar** - Human-in-the-loop pause
4. **LipSync Submit** - Submit lipsync job
5. **LipSync Recovery** - Handle lipsync webhook failures
6. **Renderer** - Render final video
7. **NoOp** - Completion handler

## 🧪 Testing

### Test Individual Lambda
```bash
aws lambda invoke \
  --function-name okvevo-noop \
  --payload '{"test": true}' \
  --region us-east-1 \
  response.json

cat response.json
```

### Test Step Function
```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:052120999576:stateMachine:ai-influencer-pipeline \
  --input '{"jobId":"test-123","userId":"user-456","topic":"test video","duration":30}' \
  --region us-east-1
```

## 📝 Manual Deployment Steps

If you prefer manual deployment:

### 1. Install Dependencies
```bash
cd Lambdas/okvevo-branding
npm install --production
```

### 2. Create ZIP
```bash
zip -r okvevo-branding.zip . -x "*.zip" "node_modules/.bin/*" "*.md"
```

### 3. Deploy via AWS CLI
```bash
aws lambda update-function-code \
  --function-name okvevo-branding \
  --zip-file fileb://okvevo-branding.zip \
  --region us-east-1
```

### 4. Update Configuration
```bash
aws lambda update-function-configuration \
  --function-name okvevo-branding \
  --memory-size 3008 \
  --timeout 900 \
  --region us-east-1
```

## 🔍 Monitoring

### View Lambda Logs
```bash
aws logs tail /aws/lambda/okvevo-branding --follow --region us-east-1
```

### View Step Function Executions
```bash
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:052120999576:stateMachine:ai-influencer-pipeline \
  --region us-east-1
```

## 🐛 Troubleshooting

### Issue: "AccessDeniedException"
**Solution:** Verify AWS credentials are configured for account `052120999576`

### Issue: "Role not found"
**Solution:** Wait 10-15 seconds after role creation for AWS IAM propagation

### Issue: "Function code size too large"
**Solution:** 
- Remove unnecessary files from ZIP
- Use Lambda Layers for large dependencies
- Check node_modules size

### Issue: "Timeout during deployment"
**Solution:** Increase timeout in Lambda configuration or split into smaller functions

## 📚 Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS Step Functions Documentation](https://docs.aws.amazon.com/step-functions/)
- [Fal AI Documentation](https://fal.ai/docs)

## 🆘 Support

For issues or questions:
1. Check CloudWatch Logs for error messages
2. Verify environment variables are set correctly
3. Ensure IAM roles have correct permissions
4. Check AWS service quotas and limits

---

**Last Updated:** April 2026  
**Target Account:** 052120999576  
**Region:** us-east-1
