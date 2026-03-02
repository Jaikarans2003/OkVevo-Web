#!/bin/bash

# Configuration
BUCKET_NAME="text2video-16cbf-lambda-deploy"
FUNCTION_NAME="brick2brick-video-stitcher"
REGION="us-east-1"
ZIP_FILE="function-clean.zip"

echo "======================================"
echo " Lambda Deployment via S3"
echo "======================================"
echo ""

# Step 1: Create S3 bucket if it doesn't exist
echo "[Step 1/4] Creating S3 bucket (if needed)..."
aws s3 mb s3://$BUCKET_NAME --region $REGION 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Bucket created"
else
    echo "ℹ️  Bucket already exists"
fi
echo ""

# Step 2: Upload ZIP to S3
echo "[Step 2/4] Uploading $ZIP_FILE to S3..."
aws s3 cp $ZIP_FILE s3://$BUCKET_NAME/$ZIP_FILE
if [ $? -ne 0 ]; then
    echo "❌ Upload failed - Check AWS credentials"
    exit 1
fi
echo "✅ Upload complete"
echo ""

# Step 3: Update Lambda from S3
echo "[Step 3/4] Updating Lambda function..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --s3-bucket $BUCKET_NAME \
    --s3-key $ZIP_FILE \
    --region $REGION

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Lambda deployment failed"
    echo "Check AWS permissions and function name"
    exit 1
fi
echo ""

# Step 4: Wait for update to complete
echo "[Step 4/4] Waiting for Lambda to be ready..."
aws lambda wait function-updated \
    --function-name $FUNCTION_NAME \
    --region $REGION

echo ""
echo "======================================"
echo "✅ Lambda deployed successfully!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Test your Lambda function"
echo "2. Check CloudWatch logs for any errors"
echo ""
