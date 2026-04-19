#!/bin/bash

################################################################################
# AI-Influencer Deployment Verification Script
# 
# This script verifies that all components are deployed correctly
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
STATE_MACHINE_NAME="ai-influencer-pipeline"

# Lambda functions to check
LAMBDAS=(
    "okvevo-ai-prep"
    "okvevo-branding"
    "okvevo-fal-recovery"
    "okvevo-lipsync-recovery"
    "okvevo-lipsync-submit"
    "okvevo-noop"
    "okvevo-renderer"
)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AI-Influencer Deployment Verification                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to check and report
check_item() {
    local description=$1
    local command=$2
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if eval "$command" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# 1. Check AWS CLI
echo -e "${YELLOW}[1/6] Checking Prerequisites...${NC}"
check_item "AWS CLI installed" "command -v aws"
check_item "Node.js installed" "command -v node"
check_item "npm installed" "command -v npm"
check_item "zip utility installed" "command -v zip"
echo ""

# 2. Check AWS Account
echo -e "${YELLOW}[2/6] Verifying AWS Account...${NC}"
CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ "$CURRENT_ACCOUNT" == "$AWS_ACCOUNT_ID" ]; then
    echo -e "${GREEN}✓${NC} Connected to correct AWS account ($AWS_ACCOUNT_ID)"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}✗${NC} Wrong AWS account (current: $CURRENT_ACCOUNT, expected: $AWS_ACCOUNT_ID)"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
echo ""

# 3. Check IAM Roles
echo -e "${YELLOW}[3/6] Checking IAM Roles...${NC}"
check_item "Lambda execution role exists" "aws iam get-role --role-name ai-influencer-lambda-role --region $AWS_REGION"
check_item "Step Functions role exists" "aws iam get-role --role-name ai-influencer-stepfunction-role --region $AWS_REGION"
echo ""

# 4. Check Lambda Functions
echo -e "${YELLOW}[4/6] Checking Lambda Functions...${NC}"
for lambda_name in "${LAMBDAS[@]}"; do
    if check_item "$lambda_name deployed" "aws lambda get-function --function-name $lambda_name --region $AWS_REGION"; then
        # Check if environment variables are set
        ENV_VARS=$(aws lambda get-function-configuration --function-name "$lambda_name" --region "$AWS_REGION" --query 'Environment.Variables' --output json 2>/dev/null)
        if echo "$ENV_VARS" | grep -q "FIREBASE_SERVICE_ACCOUNT_KEY"; then
            echo -e "  ${BLUE}→${NC} Environment variables configured"
        else
            echo -e "  ${YELLOW}⚠${NC} Environment variables not set"
        fi
    fi
done
echo ""

# 5. Check Step Function
echo -e "${YELLOW}[5/6] Checking Step Function...${NC}"
STATE_MACHINE_ARN="arn:aws:states:${AWS_REGION}:${AWS_ACCOUNT_ID}:stateMachine:${STATE_MACHINE_NAME}"
if check_item "State machine exists" "aws stepfunctions describe-state-machine --state-machine-arn $STATE_MACHINE_ARN --region $AWS_REGION"; then
    STATUS=$(aws stepfunctions describe-state-machine --state-machine-arn "$STATE_MACHINE_ARN" --region "$AWS_REGION" --query 'status' --output text 2>/dev/null)
    echo -e "  ${BLUE}→${NC} Status: $STATUS"
fi
echo ""

# 6. Check Deployment Files
echo -e "${YELLOW}[6/6] Checking Deployment Files...${NC}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
check_item "deploy-all.sh exists" "test -f $SCRIPT_DIR/deploy-all.sh"
check_item "deploy-individual.sh exists" "test -f $SCRIPT_DIR/deploy-individual.sh"
check_item "set-env-vars.sh exists" "test -f $SCRIPT_DIR/set-env-vars.sh"
check_item "State machine definition exists" "test -f $SCRIPT_DIR/State-Machine/state-machine.json"
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Verification Summary                                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Total Checks: $TOTAL_CHECKS"
echo -e "  ${GREEN}Passed: $PASSED_CHECKS${NC}"
echo -e "  ${RED}Failed: $FAILED_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   All Checks Passed! ✓                                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Your deployment is ready!${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. Set environment variables: ./set-env-vars.sh"
    echo -e "  2. Test a Lambda: aws lambda invoke --function-name okvevo-noop --payload '{}' response.json --region us-east-1"
    echo -e "  3. Monitor logs: aws logs tail /aws/lambda/okvevo-branding --follow --region us-east-1"
    echo ""
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   Some Checks Failed ✗                                     ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Please review the failed checks above and:${NC}"
    echo -e "  1. Run ./deploy-all.sh to deploy missing components"
    echo -e "  2. Run ./set-env-vars.sh to configure environment variables"
    echo -e "  3. Check AWS credentials are configured correctly"
    echo ""
    exit 1
fi
