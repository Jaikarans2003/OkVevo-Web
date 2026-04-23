#!/bin/bash

# deploy.sh - Deploy okvevo-branding Lambda function
set -e

LAMBDA_DIR="$(cd "$(dirname "$0")" && pwd)"
FUNCTION_NAME="okvevo-branding"
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::315974965935:role/okvevo-lambda-role"
LAYER_ARN="arn:aws:lambda:us-east-1:315974965935:layer:ffmpeg-brick2brick:1"

echo "Step 1: Installing dependencies..."
cd "$LAMBDA_DIR"
npm install --production

echo "Step 2: Getting environment variables from existing Lambdas..."
# Get Firebase credentials from okvevo-renderer
FB_KEY=$(aws lambda get-function-configuration --function-name okvevo-renderer --region $REGION --query 'Environment.Variables.FB_SERVICE_ACCOUNT_KEY' --output text 2>/dev/null)
FB_BUCKET=$(aws lambda get-function-configuration --function-name okvevo-renderer --region $REGION --query 'Environment.Variables.FIREBASE_STORAGE_BUCKET' --output text 2>/dev/null)

# Handle "None" values from AWS CLI
if [ "$FB_KEY" == "None" ] || [ -z "$FB_KEY" ]; then
    FB_KEY=$(aws lambda get-function-configuration --function-name okvevo-renderer --region $REGION --query 'Environment.Variables.FIREBASE_SERVICE_ACCOUNT_KEY' --output text 2>/dev/null)
fi
if [ "$FB_BUCKET" == "None" ] || [ -z "$FB_BUCKET" ]; then
    FB_BUCKET="text2video-16cbf.firebasestorage.app"
fi

# Try to get FAL and Gemini keys from lambda-trend-generation (may not exist)
FAL_KEY=$(aws lambda get-function-configuration --function-name lambda-trend-generation --region $REGION --query 'Environment.Variables.FAL_API_IMAGE' --output text 2>/dev/null)
GEMINI_KEY=$(aws lambda get-function-configuration --function-name lambda-trend-generation --region $REGION --query 'Environment.Variables.GEMINI_API_KEY' --output text 2>/dev/null)

# Handle "None" values
if [ "$FAL_KEY" == "None" ]; then FAL_KEY=""; fi
if [ "$GEMINI_KEY" == "None" ]; then GEMINI_KEY=""; fi

# If keys are missing, try to get from environment variables or .env file
if [ -z "$FAL_KEY" ] && [ -f "$LAMBDA_DIR/../../.env" ]; then
    FAL_KEY=$(grep FAL_API_IMAGE "$LAMBDA_DIR/../../.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "")
fi
if [ -z "$GEMINI_KEY" ] && [ -f "$LAMBDA_DIR/../../.env" ]; then
    GEMINI_KEY=$(grep GEMINI_API_KEY "$LAMBDA_DIR/../../.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "")
fi

# Create environment JSON file
ENV_FILE="$LAMBDA_DIR/env-config.json"
cat > "$ENV_FILE" << EOF
{
  "Variables": {
    "FIREBASE_SERVICE_ACCOUNT_KEY": "$FB_KEY",
    "FIREBASE_STORAGE_BUCKET": "$FB_BUCKET",
    "FAL_API_IMAGE": "$FAL_KEY",
    "GEMINI_API_KEY": "$GEMINI_KEY"
  }
}
EOF

echo "Step 3: Creating deployment package..."
ZIP_FILE="$LAMBDA_DIR/okvevo-branding.zip"
rm -f "$ZIP_FILE"
zip -r "$ZIP_FILE" index.js package.json node_modules/ -q
ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo "   Created zip: $ZIP_SIZE"

echo "Step 4: Checking if Lambda exists..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &>/dev/null; then
    echo "   Function exists - updating..."
    
    # Update code
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file "fileb://$ZIP_FILE" \
        --region $REGION \
        --output json > /dev/null
    
    echo "   Waiting for update to complete..."
    sleep 5
    
    # Update configuration
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout 300 \
        --memory-size 512 \
        --layers $LAYER_ARN \
        --environment "file://$ENV_FILE" \
        --region $REGION \
        --output json > /dev/null
else
    echo "   Function not found - creating..."
    
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs20.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file "fileb://$ZIP_FILE" \
        --timeout 300 \
        --memory-size 512 \
        --layers $LAYER_ARN \
        --environment "file://$ENV_FILE" \
        --region $REGION \
        --output json > /dev/null
fi

# Cleanup
rm -f "$ENV_FILE"

echo ""
echo "✅ SUCCESS: okvevo-branding deployed successfully!"
echo "   Function: $FUNCTION_NAME"
echo "   Region: $REGION"
