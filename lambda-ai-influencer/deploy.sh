#!/bin/bash

# AI Influencer Lambda Deployment Script

echo "🚀 Starting Lambda deployment process..."

# 1. Clean up old deployment package
echo "🧹 Cleaning up old deployment package..."
rm -f lambda-deployment.zip

# 2. Create deployment package with dependencies
echo "📦 Creating deployment package..."
zip -r lambda-deployment.zip index.js package.json package-lock.json node_modules/ -x "*.git*" -x "*node_modules/.cache/*"

# 3. Get package size
SIZE=$(du -h lambda-deployment.zip | cut -f1)
echo "✅ Deployment package created: lambda-deployment.zip ($SIZE)"

# 4. Upload to AWS Lambda
echo "☁️  Uploading to AWS Lambda..."
aws lambda update-function-code \
    --function-name okvevo-ai-influencer-pipeline-ai-influencer \
    --zip-file fileb://lambda-deployment.zip \
    --region us-east-1

if [ $? -eq 0 ]; then
    echo "✅ Lambda function updated successfully!"
else
    echo "❌ Failed to update Lambda function"
    exit 1
fi

echo "🎉 Deployment complete!"
