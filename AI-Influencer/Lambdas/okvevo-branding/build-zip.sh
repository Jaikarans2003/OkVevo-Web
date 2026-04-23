#!/bin/bash

# build-zip.sh - Install dependencies and create deployment zip
set -e

LAMBDA_DIR="$(cd "$(dirname "$0")" && pwd)"
ZIP_FILE="$LAMBDA_DIR/okvevo-branding.zip"

echo "📦 Building okvevo-branding Lambda deployment package..."
echo ""

cd "$LAMBDA_DIR"

echo "Step 1: Installing dependencies..."
npm install --production
echo "   ✓ Dependencies installed"
echo ""

echo "Step 2: Creating deployment package..."
rm -f "$ZIP_FILE"
zip -r "$ZIP_FILE" index.js package.json node_modules/ -q
ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
echo "   ✓ Created: $ZIP_FILE ($ZIP_SIZE)"
echo ""

echo "✅ SUCCESS: Deployment package ready!"
echo ""
echo "📋 Next steps:"
echo "   1. Upload $ZIP_FILE to AWS Lambda console"
echo "   2. Or use AWS CLI: aws lambda update-function-code --function-name okvevo-branding --zip-file fileb://$ZIP_FILE --region us-east-1"
