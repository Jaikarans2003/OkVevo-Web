#!/bin/bash

################################################################################
# AI-Influencer Environment Variables Setup Script
# 
# This script sets environment variables for all Lambda functions
# 
# Usage: 
#   1. Edit the variables below with your actual values
#   2. Run: ./set-env-vars.sh
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
AWS_REGION="us-east-1"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AI-Influencer Environment Variables Setup                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# EDIT THESE VALUES WITH YOUR ACTUAL CREDENTIALS
# ============================================================================

# Firebase Service Account (Base64 encoded)
FIREBASE_SERVICE_ACCOUNT_KEY="YOUR_BASE64_ENCODED_SERVICE_ACCOUNT_HERE"

# Firebase Storage Bucket
FIREBASE_STORAGE_BUCKET="text2video-16cbf.firebasestorage.app"

# Fal AI API Keys
FAL_API_KEY="YOUR_FAL_API_KEY_HERE"
FAL_API_IMAGE="YOUR_FAL_API_IMAGE_KEY_HERE"

# Gemini API Key
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"

# ============================================================================
# DO NOT EDIT BELOW THIS LINE
# ============================================================================

# Validate that values have been set
if [[ "$FIREBASE_SERVICE_ACCOUNT_KEY" == "YOUR_BASE64_ENCODED_SERVICE_ACCOUNT_HERE" ]]; then
    echo -e "${RED}Error: Please edit this script and set your actual credentials${NC}"
    echo -e "${YELLOW}Edit the variables at the top of set-env-vars.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}Setting environment variables for Lambda functions...${NC}"
echo ""

# Function to set environment variables
set_lambda_env() {
    local function_name=$1
    local env_vars=$2
    
    echo -e "${BLUE}Setting environment for: $function_name${NC}"
    
    aws lambda update-function-configuration \
        --function-name "$function_name" \
        --environment "$env_vars" \
        --region "$AWS_REGION" \
        > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Updated $function_name${NC}"
    else
        echo -e "${RED}✗ Failed to update $function_name${NC}"
    fi
}

# Set environment for okvevo-ai-prep
set_lambda_env "okvevo-ai-prep" \
    "Variables={FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,FAL_API_KEY=$FAL_API_KEY,GEMINI_API_KEY=$GEMINI_API_KEY}"

# Set environment for okvevo-branding
set_lambda_env "okvevo-branding" \
    "Variables={FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,FAL_API_IMAGE=$FAL_API_IMAGE,GEMINI_API_KEY=$GEMINI_API_KEY}"

# Set environment for okvevo-fal-recovery
set_lambda_env "okvevo-fal-recovery" \
    "Variables={FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,FAL_API_KEY=$FAL_API_KEY}"

# Set environment for okvevo-lipsync-recovery
set_lambda_env "okvevo-lipsync-recovery" \
    "Variables={FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,FAL_API_KEY=$FAL_API_KEY}"

# Set environment for okvevo-lipsync-submit
set_lambda_env "okvevo-lipsync-submit" \
    "Variables={FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,FAL_API_KEY=$FAL_API_KEY}"

# Set environment for okvevo-noop
set_lambda_env "okvevo-noop" \
    "Variables={FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET}"

# Set environment for okvevo-renderer
set_lambda_env "okvevo-renderer" \
    "Variables={FIREBASE_SERVICE_ACCOUNT_KEY=$FIREBASE_SERVICE_ACCOUNT_KEY,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Environment Variables Set Successfully! ✓                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Note: Environment variables are encrypted at rest by AWS${NC}"
echo ""
