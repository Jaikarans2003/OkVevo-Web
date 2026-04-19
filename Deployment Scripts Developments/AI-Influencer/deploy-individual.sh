#!/bin/bash

################################################################################
# AI-Influencer Individual Lambda Deployment Script
# 
# Usage: ./deploy-individual.sh <lambda-name>
# Example: ./deploy-individual.sh okvevo-branding
#
# This script deploys a single Lambda function to AWS
# Target AWS Account: 052120999576
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
AWS_ACCOUNT_ID="052120999576"
AWS_REGION="us-east-1"
IAM_ROLE_NAME="ai-influencer-lambda-role"

# Lambda configurations (bash 3.2 compatible)
get_lambda_config() {
    case "$1" in
        okvevo-ai-prep)           echo "512:900:nodejs20.x" ;;
        okvevo-branding)          echo "3008:900:nodejs20.x" ;;
        okvevo-fal-recovery)      echo "256:300:nodejs20.x" ;;
        okvevo-lipsync-recovery)  echo "256:300:nodejs20.x" ;;
        okvevo-lipsync-submit)    echo "256:300:nodejs20.x" ;;
        okvevo-noop)              echo "128:30:nodejs20.x" ;;
        okvevo-renderer)          echo "512:900:nodejs20.x" ;;
        *)                        echo "" ;;
    esac
}

VALID_LAMBDAS="okvevo-ai-prep okvevo-branding okvevo-fal-recovery okvevo-lipsync-recovery okvevo-lipsync-submit okvevo-noop okvevo-renderer"

# Check arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Lambda name required${NC}"
    echo ""
    echo "Usage: $0 <lambda-name>"
    echo ""
    echo "Available Lambda functions:"
    for lambda_name in $VALID_LAMBDAS; do
        echo "  • $lambda_name"
    done
    exit 1
fi

LAMBDA_NAME=$1

# Validate lambda name
if [ -z "$(get_lambda_config "$LAMBDA_NAME")" ]; then
    echo -e "${RED}Error: Unknown Lambda function: $LAMBDA_NAME${NC}"
    echo ""
    echo "Available Lambda functions:"
    for lambda_name in $VALID_LAMBDAS; do
        echo "  • $lambda_name"
    done
    exit 1
fi

# Disable AWS CLI pager
export AWS_PAGER=""

# Get script directory and find AI-Influencer source
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AI_INFLUENCER_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )/AI-Influencer"
LAMBDA_DIR="$AI_INFLUENCER_DIR/Lambdas/$LAMBDA_NAME"

if [ ! -d "$LAMBDA_DIR" ]; then
    echo -e "${RED}Error: Lambda directory not found: $LAMBDA_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Deploying: ${LAMBDA_NAME}${NC}"
echo -e "${BLUE}║   Account: ${AWS_ACCOUNT_ID}${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parse configuration
IFS=':' read -r MEMORY TIMEOUT RUNTIME <<< "$(get_lambda_config "$LAMBDA_NAME")"

echo -e "${YELLOW}[1/4] Installing dependencies...${NC}"
cd "$LAMBDA_DIR"

if [ -f "package.json" ]; then
    npm install --production
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠ No package.json found, skipping npm install${NC}"
fi
echo ""

echo -e "${YELLOW}[2/4] Creating ZIP file...${NC}"
ZIP_FILE="${LAMBDA_NAME}.zip"
rm -f "$ZIP_FILE"
zip -r "$ZIP_FILE" . -x "*.zip" "node_modules/.bin/*" "*.md" ".git/*" > /dev/null
echo -e "${GREEN}✓ Created $ZIP_FILE ($(du -h "$ZIP_FILE" | cut -f1))${NC}"
echo ""

echo -e "${YELLOW}[3/4] Deploying to AWS...${NC}"
echo -e "  Memory: ${MEMORY}MB"
echo -e "  Timeout: ${TIMEOUT}s"
echo -e "  Runtime: $RUNTIME"
echo ""

LAMBDA_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${IAM_ROLE_NAME}"

# Check if function exists
if aws lambda get-function --function-name "$LAMBDA_NAME" --region "$AWS_REGION" &> /dev/null; then
    echo -e "${BLUE}Updating existing function...${NC}"
    
    # Update function code
    aws lambda update-function-code \
        --function-name "$LAMBDA_NAME" \
        --zip-file "fileb://$ZIP_FILE" \
        --region "$AWS_REGION" \
        > /dev/null
    
    echo -e "  Waiting for code update to finish..."
    aws lambda wait function-updated \
        --function-name "$LAMBDA_NAME" \
        --region "$AWS_REGION"
    
    # Update function configuration
    aws lambda update-function-configuration \
        --function-name "$LAMBDA_NAME" \
        --memory-size "$MEMORY" \
        --timeout "$TIMEOUT" \
        --runtime "$RUNTIME" \
        --region "$AWS_REGION" \
        > /dev/null
    
    aws lambda wait function-updated \
        --function-name "$LAMBDA_NAME" \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✓ Updated $LAMBDA_NAME${NC}"
else
    echo -e "${BLUE}Creating new function...${NC}"
    
    aws lambda create-function \
        --function-name "$LAMBDA_NAME" \
        --runtime "$RUNTIME" \
        --role "$LAMBDA_ROLE_ARN" \
        --handler "index.handler" \
        --zip-file "fileb://$ZIP_FILE" \
        --memory-size "$MEMORY" \
        --timeout "$TIMEOUT" \
        --region "$AWS_REGION"
    
    echo ""
    echo -e "${GREEN}✓ Created $LAMBDA_NAME${NC}"
fi

echo ""
echo -e "${YELLOW}[4/4] Verifying deployment...${NC}"

# Get function info
FUNCTION_INFO=$(aws lambda get-function --function-name "$LAMBDA_NAME" --region "$AWS_REGION")
CODE_SIZE=$(echo "$FUNCTION_INFO" | grep -o '"CodeSize": [0-9]*' | grep -o '[0-9]*')
LAST_MODIFIED=$(echo "$FUNCTION_INFO" | grep -o '"LastModified": "[^"]*"' | cut -d'"' -f4)

echo -e "  Code Size: $(numfmt --to=iec-i --suffix=B $CODE_SIZE 2>/dev/null || echo "${CODE_SIZE} bytes")"
echo -e "  Last Modified: $LAST_MODIFIED"
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment Complete! ✓                                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Function ARN:${NC}"
echo -e "  arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:${LAMBDA_NAME}"
echo ""
