#!/bin/bash

# Deploy Script for AWS Step Function TaskToken Fix
# This script deploys the updated Lambda functions and state machine

set -e  # Exit on error

echo "🚀 Deploying AWS Step Function TaskToken Fix..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Get the state machine ARN from environment or use default
STATE_MACHINE_ARN=${SFN_AI_INFLUENCER_ARN:-"arn:aws:states:us-east-1:315974965935:stateMachine:okvevo-ai-influencer-pipeline"}
AWS_REGION=${AWS_REGION:-"us-east-1"}

echo -e "${YELLOW}📋 Step 1: Updating State Machine Definition${NC}"
aws stepfunctions update-state-machine \
  --state-machine-arn "$STATE_MACHINE_ARN" \
  --definition file://state-machine.json \
  --region "$AWS_REGION"
echo -e "${GREEN}✅ State machine updated${NC}"

echo ""
echo -e "${YELLOW}📦 Step 2: Deploying lambda-ai-prep${NC}"
cd lambda-ai-prep
if [ ! -d "node_modules/@aws-sdk/client-sfn" ]; then
    echo "Installing @aws-sdk/client-sfn..."
    npm install @aws-sdk/client-sfn
fi
zip -q -r lambda-ai-prep.zip . -x "*.git*" -x "node_modules/.cache/*"
aws lambda update-function-code \
  --function-name lambda-ai-prep \
  --zip-file fileb://lambda-ai-prep.zip \
  --region "$AWS_REGION"
rm lambda-ai-prep.zip
echo -e "${GREEN}✅ lambda-ai-prep deployed${NC}"

echo ""
echo -e "${YELLOW}📦 Step 3: Deploying lambda-lipsync-submit${NC}"
cd ../lambda-lipsync-submit
if [ ! -d "node_modules/@aws-sdk/client-sfn" ]; then
    echo "Installing @aws-sdk/client-sfn..."
    npm install @aws-sdk/client-sfn
fi
zip -q -r lambda-lipsync-submit.zip . -x "*.git*" -x "node_modules/.cache/*"
aws lambda update-function-code \
  --function-name lambda-lipsync-submit \
  --zip-file fileb://lambda-lipsync-submit.zip \
  --region "$AWS_REGION"
rm lambda-lipsync-submit.zip
echo -e "${GREEN}✅ lambda-lipsync-submit deployed${NC}"

cd ..

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test mock mode by setting FAL_MODE=mock"
echo "2. Monitor Step Function execution in AWS console"
echo "3. Check CloudWatch logs for any errors"
echo ""
echo "State Machine ARN: $STATE_MACHINE_ARN"
echo "Region: $AWS_REGION"
