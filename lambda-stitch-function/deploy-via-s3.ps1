# === DEPLOY LAMBDA VIA S3 ===

# 1. Set variables
$bucketName = "text2video-16cbf-lambda-deploy"
$functionName = "brick2brick-video-stitcher"
$region = "us-east-1"
$zipFile = "function.zip"

Write-Host "======================================"
Write-Host " Lambda Deployment via S3"
Write-Host "======================================`n"

# 2. Create S3 bucket if it doesn't exist
Write-Host "[Step 1/3] Creating S3 bucket (if needed)..."
aws s3 mb s3://$bucketName --region $region 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Bucket created`n"
} else {
    Write-Host "ℹ️  Bucket already exists`n"
}

# 3. Upload ZIP to S3
Write-Host "[Step 2/3] Uploading $zipFile to S3..."
aws s3 cp $zipFile s3://$bucketName/$zipFile
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Upload complete`n"
} else {
    Write-Host "❌ Upload failed - Check AWS credentials`n"
    exit 1
}

# 4. Update Lambda from S3
Write-Host "[Step 3/3] Updating Lambda function..."
aws lambda update-function-code `
    --function-name $functionName `
    --s3-bucket $bucketName `
    --s3-key $zipFile `
    --region $region

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n======================================"
    Write-Host "✅ Lambda deployed successfully!"
    Write-Host "======================================`n"
    Write-Host "Next steps:"
    Write-Host "1. Wait 10 seconds for Lambda to be ready"
    Write-Host "2. Refresh your browser (Ctrl+Shift+R)"
    Write-Host "3. Test the complete flow"
    Write-Host "4. Check CloudWatch for 'Downloaded audio' message`n"
} else {
    Write-Host "`n❌ Lambda deployment failed"
    Write-Host "Check AWS permissions and function name`n"
}
