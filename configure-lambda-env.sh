#!/bin/bash

# Configure Lambda Environment Variables
# Sets environment variables for okvevo-ai-prep and okvevo-fal-recovery

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AWS_REGION="us-east-1"

echo ""
echo "=========================================="
echo "⚙️  Lambda Environment Configuration"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create a .env file with your credentials"
    exit 1
fi

# Load environment variables from .env
echo -e "${BLUE}📥 Loading credentials from .env file...${NC}"
export $(cat .env | grep -v '^#' | xargs)

# Validate required variables
REQUIRED_VARS=("FIREBASE_SERVICE_ACCOUNT_KEY" "FIREBASE_STORAGE_BUCKET" "FAL_API_IMAGE" "NEXT_PUBLIC_BASE_URL")
MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for VAR in "${MISSING_VARS[@]}"; do
        echo "   - $VAR"
    done
    exit 1
fi

echo -e "${GREEN}✅ All required variables found${NC}"
echo ""

# Function to configure Lambda environment
configure_lambda() {
    local LAMBDA_NAME=$1
    shift
    local ENV_VARS="$@"
    
    echo -e "${BLUE}⚙️  Configuring: ${LAMBDA_NAME}${NC}"
    
    aws lambda update-function-configuration \
        --function-name "$LAMBDA_NAME" \
        --environment "Variables={$ENV_VARS}" \
        --region "$AWS_REGION" \
        --output json > /dev/null
    
    echo -e "${GREEN}   ✅ Environment variables updated${NC}"
}

# Configure okvevo-ai-prep
echo ""
echo "=========================================="
echo "1. okvevo-ai-prep"
echo "=========================================="

AI_PREP_ENV="FIREBASE_SERVICE_ACCOUNT_KEY=${FIREBASE_SERVICE_ACCOUNT_KEY},FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET},FAL_API_IMAGE=${FAL_API_IMAGE},NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}"

configure_lambda "okvevo-ai-prep" "$AI_PREP_ENV"

# Configure okvevo-fal-recovery
echo ""
echo "=========================================="
echo "2. okvevo-fal-recovery"
echo "=========================================="

RECOVERY_ENV="FIREBASE_SERVICE_ACCOUNT_KEY=${FIREBASE_SERVICE_ACCOUNT_KEY},FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET},FAL_API_IMAGE=${FAL_API_IMAGE}"

configure_lambda "okvevo-fal-recovery" "$RECOVERY_ENV"

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 Configuration Complete!${NC}"
echo "=========================================="
echo ""
echo "Environment variables set for:"
echo "  ✅ okvevo-ai-prep"
echo "  ✅ okvevo-fal-recovery"
echo ""
echo "Variables configured:"
echo "  - FIREBASE_SERVICE_ACCOUNT_KEY"
echo "  - FIREBASE_STORAGE_BUCKET"
echo "  - FAL_API_IMAGE"
echo "  - NEXT_PUBLIC_BASE_URL (ai-prep only)"
echo ""
echo "Note: AWS credentials are provided automatically by Lambda execution role"
echo ""
