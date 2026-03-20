#!/bin/bash

# Package Lambda Deployment Script for Fal AI Recovery System

set -e

echo "=========================================="
echo "Packaging Lambda Functions"
echo "=========================================="

# Package okvevo-ai-prep
echo ""
echo "📦 Packaging okvevo-ai-prep..."
cd okvevo-ai-prep
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
echo "Creating zip file..."
zip -r okvevo-ai-prep.zip index.js package.json node_modules/ -x "*.git*" -x "*node_modules/.cache*"
echo "✅ okvevo-ai-prep.zip created"
cd ..

# Package okvevo-fal-recovery
echo ""
echo "📦 Packaging okvevo-fal-recovery..."
cd okvevo-fal-recovery
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
echo "Creating zip file..."
zip -r okvevo-fal-recovery.zip index.js package.json node_modules/ -x "*.git*" -x "*node_modules/.cache*"
echo "✅ okvevo-fal-recovery.zip created"
cd ..

echo ""
echo "=========================================="
echo "✅ All Lambda packages created!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Upload okvevo-ai-prep/okvevo-ai-prep.zip to AWS Lambda"
echo "2. Upload okvevo-fal-recovery/okvevo-fal-recovery.zip to AWS Lambda"
echo "3. Update Step Function state machine with state-machine.json"
echo ""
echo "See DEPLOYMENT_RECOVERY.md for detailed instructions"
