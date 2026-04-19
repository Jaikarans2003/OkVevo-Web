#!/bin/bash

################################################################################
# AI-Influencer Complete Deployment Script
# 
# This script:
# 1. Installs dependencies for all Lambda functions
# 2. Creates deployment ZIP files
# 3. Deploys Lambda functions to AWS
# 4. Creates/Updates Step Function state machine
#
# Target AWS Account: 052120999576
# Region: us-east-1
################################################################################

set -e  # Exit on error

# Disable AWS CLI pager globally (prevents (END) prompts)
export AWS_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_ACCOUNT_ID="052120999576"
AWS_REGION="us-east-1"
STATE_MACHINE_NAME="okvevo-ai-influencer-pipeline"
IAM_ROLE_NAME="ai-influencer-lambda-role"
STATE_MACHINE_ROLE_NAME="ai-influencer-stepfunction-role"

# Lambda configurations (compatible with bash 3.2)
# Format: name|memory|timeout|runtime
LAMBDAS="
okvevo-ai-prep|512|900|nodejs20.x
okvevo-branding|3008|900|nodejs20.x
okvevo-fal-recovery|256|300|nodejs20.x
okvevo-lipsync-recovery|256|300|nodejs20.x
okvevo-lipsync-submit|256|300|nodejs20.x
okvevo-noop|128|30|nodejs20.x
okvevo-renderer|512|900|nodejs20.x
"

# Get script directory and find AI-Influencer source
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Look for AI-Influencer directory in parent folder
AI_INFLUENCER_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )/AI-Influencer"
LAMBDAS_DIR="$AI_INFLUENCER_DIR/Lambdas"
STATE_MACHINE_DIR="$AI_INFLUENCER_DIR/State-Machine"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AI-Influencer Deployment Script                         ║${NC}"
echo -e "${BLUE}║   Target Account: ${AWS_ACCOUNT_ID}                        ║${NC}"
echo -e "${BLUE}║   Region: ${AWS_REGION}                                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

# Verify source directories exist
if [ ! -d "$LAMBDAS_DIR" ]; then
    echo -e "${RED}✗ Lambda source directory not found: $LAMBDAS_DIR${NC}"
    echo -e "${YELLOW}  Expected AI-Influencer folder at: $AI_INFLUENCER_DIR${NC}"
    exit 1
fi

if [ ! -d "$STATE_MACHINE_DIR" ]; then
    echo -e "${RED}✗ State Machine directory not found: $STATE_MACHINE_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found Lambda source: $LAMBDAS_DIR${NC}"
echo -e "${GREEN}✓ Found State Machine: $STATE_MACHINE_DIR${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found. Please install Node.js and npm first.${NC}"
    exit 1
fi

if ! command -v zip &> /dev/null; then
    echo -e "${RED}✗ zip not found. Please install zip utility.${NC}"
    exit 1
fi

# Verify AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}✗ AWS credentials not configured. Please run 'aws configure'.${NC}"
    exit 1
fi

CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if [ "$CURRENT_ACCOUNT" != "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}✗ Current AWS account ($CURRENT_ACCOUNT) does not match target account ($AWS_ACCOUNT_ID)${NC}"
    echo -e "${YELLOW}  Please configure AWS CLI with the correct credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Create IAM roles if they don't exist
echo -e "${YELLOW}[2/6] Setting up IAM roles...${NC}"

# Check if Lambda role exists
if ! aws iam get-role --role-name "$IAM_ROLE_NAME" &> /dev/null; then
    echo -e "${BLUE}  Creating Lambda execution role...${NC}"
    
    # Create trust policy
    cat > /tmp/lambda-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    aws iam create-role \
        --role-name "$IAM_ROLE_NAME" \
        --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
        --description "Execution role for AI-Influencer Lambda functions"

    # Attach policies
    aws iam attach-role-policy \
        --role-name "$IAM_ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    
    aws iam attach-role-policy \
        --role-name "$IAM_ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/AWSStepFunctionsFullAccess"
    
    echo -e "${GREEN}  ✓ Lambda role created${NC}"
    sleep 10  # Wait for role propagation
else
    echo -e "${GREEN}  ✓ Lambda role already exists${NC}"
fi

# Check if Step Functions role exists
if ! aws iam get-role --role-name "$STATE_MACHINE_ROLE_NAME" &> /dev/null; then
    echo -e "${BLUE}  Creating Step Functions execution role...${NC}"
    
    # Create trust policy
    cat > /tmp/stepfunction-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "states.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    aws iam create-role \
        --role-name "$STATE_MACHINE_ROLE_NAME" \
        --assume-role-policy-document file:///tmp/stepfunction-trust-policy.json \
        --description "Execution role for AI-Influencer Step Functions"

    # Create inline policy for Lambda invocation
    cat > /tmp/stepfunction-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:okvevo-*"
    }
  ]
}
EOF

    aws iam put-role-policy \
        --role-name "$STATE_MACHINE_ROLE_NAME" \
        --policy-name "LambdaInvokePolicy" \
        --policy-document file:///tmp/stepfunction-policy.json
    
    echo -e "${GREEN}  ✓ Step Functions role created${NC}"
    sleep 10  # Wait for role propagation
else
    echo -e "${GREEN}  ✓ Step Functions role already exists${NC}"
fi

# Patch CDK-managed Lambda roles with StepFunctions permission (if they exist)
echo -e "${BLUE}  Patching CDK Lambda roles with StepFunctions permissions (if present)...${NC}"
CDK_ROLES=$(aws iam list-roles --query "Roles[?starts_with(RoleName, 'OkVevo-AiInfluencer-dev-')].RoleName" --output text --region "$AWS_REGION" 2>/dev/null)
if [ -n "$CDK_ROLES" ]; then
    for cdk_role in $CDK_ROLES; do
        aws iam attach-role-policy \
            --role-name "$cdk_role" \
            --policy-arn arn:aws:iam::aws:policy/AWSStepFunctionsFullAccess \
            --region "$AWS_REGION" 2>/dev/null && \
            echo -e "${GREEN}    ✓ Patched: $cdk_role${NC}" || \
            echo -e "    ↩ Already attached: $cdk_role"
    done
else
    echo -e "    (No CDK roles found, skipping)"
fi
echo ""

LAMBDA_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${IAM_ROLE_NAME}"
STATE_MACHINE_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${STATE_MACHINE_ROLE_NAME}"

echo ""

# Install dependencies and create ZIP files
echo -e "${YELLOW}[3/6] Installing dependencies and creating ZIP files...${NC}"

echo "$LAMBDAS" | while IFS='|' read -r lambda_name memory timeout runtime; do
    # Skip empty lines
    [ -z "$lambda_name" ] && continue
    
    lambda_dir="$LAMBDAS_DIR/$lambda_name"
    
    if [ ! -d "$lambda_dir" ]; then
        echo -e "${RED}  ✗ Lambda directory not found: $lambda_dir${NC}"
        continue
    fi
    
    echo -e "${BLUE}  Processing $lambda_name...${NC}"
    
    cd "$lambda_dir"
    
    # Install dependencies if package.json exists
    if [ -f "package.json" ]; then
        echo -e "    Installing dependencies..."
        npm install --production --silent
    fi
    
    # Create ZIP file
    zip_file="${lambda_name}.zip"
    echo -e "    Creating ZIP file..."
    
    # Remove old ZIP if exists
    rm -f "$zip_file"
    
    # Create ZIP with all files
    zip -r "$zip_file" . -x "*.zip" "node_modules/.bin/*" "*.md" ".git/*" > /dev/null
    
    echo -e "${GREEN}    ✓ Created $zip_file ($(du -h "$zip_file" | cut -f1))${NC}"
done

cd "$SCRIPT_DIR"
echo ""

# Deploy Lambda functions
echo -e "${YELLOW}[4/6] Deploying Lambda functions...${NC}"

echo "$LAMBDAS" | while IFS='|' read -r lambda_name memory timeout runtime; do
    # Skip empty lines
    [ -z "$lambda_name" ] && continue
    
    lambda_dir="$LAMBDAS_DIR/$lambda_name"
    zip_file="$lambda_dir/${lambda_name}.zip"
    
    if [ ! -f "$zip_file" ]; then
        echo -e "${RED}  ✗ ZIP file not found: $zip_file${NC}"
        continue
    fi
    
    echo -e "${BLUE}  Deploying $lambda_name...${NC}"
    echo -e "    Memory: ${memory}MB, Timeout: ${timeout}s, Runtime: $runtime"
    
    # Check if function exists
    if aws lambda get-function --function-name "$lambda_name" --region "$AWS_REGION" &> /dev/null; then
        echo -e "    Updating existing function..."
        
        # Update function code
        aws lambda update-function-code \
            --function-name "$lambda_name" \
            --zip-file "fileb://$zip_file" \
            --region "$AWS_REGION" \
            > /dev/null
        
        # Wait for code update to complete before updating configuration
        echo -e "    Waiting for code update to finish..."
        aws lambda wait function-updated \
            --function-name "$lambda_name" \
            --region "$AWS_REGION"
        
        # Update function configuration
        aws lambda update-function-configuration \
            --function-name "$lambda_name" \
            --memory-size "$memory" \
            --timeout "$timeout" \
            --runtime "$runtime" \
            --region "$AWS_REGION" \
            > /dev/null
        
        # Wait for config update to complete
        aws lambda wait function-updated \
            --function-name "$lambda_name" \
            --region "$AWS_REGION"
        
        echo -e "${GREEN}    ✓ Updated $lambda_name${NC}"
    else
        echo -e "    Creating new function..."
        
        aws lambda create-function \
            --function-name "$lambda_name" \
            --runtime "$runtime" \
            --role "$LAMBDA_ROLE_ARN" \
            --handler "index.handler" \
            --zip-file "fileb://$zip_file" \
            --memory-size "$memory" \
            --timeout "$timeout" \
            --region "$AWS_REGION" \
            > /dev/null
        
        echo -e "${GREEN}    ✓ Created $lambda_name${NC}"
    fi
done

echo ""

# Update state machine definition with correct ARNs
echo -e "${YELLOW}[5/6] Preparing Step Function state machine...${NC}"

STATE_MACHINE_FILE="$STATE_MACHINE_DIR/state-machine.json"

if [ ! -f "$STATE_MACHINE_FILE" ]; then
    echo -e "${RED}  ✗ State machine definition not found: $STATE_MACHINE_FILE${NC}"
    exit 1
fi

# Create updated state machine definition
UPDATED_STATE_MACHINE="/tmp/state-machine-updated.json"
cp "$STATE_MACHINE_FILE" "$UPDATED_STATE_MACHINE"

# Replace account ID in ARNs
sed -i.bak "s/315974965935/${AWS_ACCOUNT_ID}/g" "$UPDATED_STATE_MACHINE"

echo -e "${GREEN}  ✓ State machine definition prepared${NC}"
echo ""

# Deploy Step Function
echo -e "${YELLOW}[6/6] Deploying Step Function state machine...${NC}"

# Check if state machine exists
STATE_MACHINE_ARN="arn:aws:states:${AWS_REGION}:${AWS_ACCOUNT_ID}:stateMachine:${STATE_MACHINE_NAME}"

if aws stepfunctions describe-state-machine --state-machine-arn "$STATE_MACHINE_ARN" --region "$AWS_REGION" &> /dev/null; then
    echo -e "${BLUE}  Updating existing state machine...${NC}"
    
    aws stepfunctions update-state-machine \
        --state-machine-arn "$STATE_MACHINE_ARN" \
        --definition "file://$UPDATED_STATE_MACHINE" \
        --region "$AWS_REGION" \
        > /dev/null
    
    echo -e "${GREEN}  ✓ Updated state machine: $STATE_MACHINE_NAME${NC}"
else
    echo -e "${BLUE}  Creating new state machine...${NC}"
    
    aws stepfunctions create-state-machine \
        --name "$STATE_MACHINE_NAME" \
        --definition "file://$UPDATED_STATE_MACHINE" \
        --role-arn "$STATE_MACHINE_ROLE_ARN" \
        --region "$AWS_REGION" \
        > /dev/null
    
    echo -e "${GREEN}  ✓ Created state machine: $STATE_MACHINE_NAME${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment Complete! ✓                                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Deployed Lambda Functions:${NC}"
echo "$LAMBDAS" | while IFS='|' read -r lambda_name memory timeout runtime; do
    [ -z "$lambda_name" ] && continue
    echo -e "  • ${lambda_name}"
done
echo ""
echo -e "${BLUE}Step Function State Machine:${NC}"
echo -e "  • Name: ${STATE_MACHINE_NAME}"
echo -e "  • ARN: ${STATE_MACHINE_ARN}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Set environment variables for Lambda functions (if needed)"
echo -e "  2. Test the state machine with a sample execution"
echo -e "  3. Monitor CloudWatch logs for any issues"
echo ""
