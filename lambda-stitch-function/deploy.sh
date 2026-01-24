#!/bin/bash
# Install only production dependencies
npm install --production

# Create deployment package (exclude dev dependencies)
zip -r function.zip . -x "*.git*" "node_modules/aws-sdk/*" "*.zip"
