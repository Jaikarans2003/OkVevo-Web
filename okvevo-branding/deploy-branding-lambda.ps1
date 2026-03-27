# deploy-branding-lambda.ps1
$ErrorActionPreference = "Continue" # Don't stop on non-zero exit codes from aws cli for checks

$lambdaDir    = "c:\Users\hrudh\OneDrive\Desktop\OkvevoProd\OKVEVO\okvevo-branding"
$finalZipPath = "$lambdaDir\okvevo-branding.zip"
$tmpZipPath   = "$env:TEMP\okvevo-branding-deploy.zip"
$envFile      = "$env:TEMP\okvevo-branding-env.json"
$functionName = "okvevo-branding"
$roleArn      = "arn:aws:iam::315974965935:role/okvevo-lambda-role"
$layerArn     = "arn:aws:lambda:us-east-1:315974965935:layer:ffmpeg-brick2brick:1"
$region       = "us-east-1"

Write-Host "Step 1: Reading env vars from okvevo-renderer..." -ForegroundColor Cyan
$rawJson = aws lambda get-function-configuration --function-name okvevo-renderer --region $region --output json
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to get renderer config"; exit 1 }
$rendererConfig = $rawJson | ConvertFrom-Json
$fbKey    = $rendererConfig.Environment.Variables.FB_SERVICE_ACCOUNT_KEY
$fbBucket = $rendererConfig.Environment.Variables.FIREBASE_STORAGE_BUCKET
if (-not $fbBucket) { $fbBucket = "text2video-16cbf.firebasestorage.app" }

# Write environment JSON file to avoid CLI length limits
$envData = @{
    Variables = @{
        FB_SERVICE_ACCOUNT_KEY = $fbKey
        FIREBASE_STORAGE_BUCKET = $fbBucket
    }
}
$envData | ConvertTo-Json -Depth 10 | Set-Content -Path $envFile
Write-Host "   Created env.json file at $envFile" -ForegroundColor Gray

Write-Host "Step 2: Zipping Lambda directory..." -ForegroundColor Cyan
if (Test-Path $tmpZipPath) { Remove-Item $tmpZipPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
# We use a temp directory to build the zip to avoid including extra files
$tmpBuildDir = "$env:TEMP\okvevo-branding-build"
if (Test-Path $tmpBuildDir) { Remove-Item $tmpBuildDir -Recurse -Force }
New-Item -ItemType Directory -Path $tmpBuildDir | Out-Null
Copy-Item "$lambdaDir\index.js", "$lambdaDir\package.json" -Destination $tmpBuildDir
Copy-Item "$lambdaDir\node_modules" -Destination $tmpBuildDir -Recurse

[System.IO.Compression.ZipFile]::CreateFromDirectory($tmpBuildDir, $tmpZipPath)
Remove-Item $tmpBuildDir -Recurse -Force

if (Test-Path $finalZipPath) { Remove-Item $finalZipPath -Force }
Move-Item $tmpZipPath $finalZipPath
$sizeMB = [math]::Round((Get-Item $finalZipPath).Length / 1MB, 1)
Write-Host "   Zip created: $sizeMB MB" -ForegroundColor Gray

Write-Host "Step 3: Checking if Lambda already exists..." -ForegroundColor Cyan
$exists = $false
$null = aws lambda get-function --function-name $functionName --region $region --output text 2>&1
if ($LASTEXITCODE -eq 0) {
    $exists = $true
    Write-Host "   Function exists - updating" -ForegroundColor Yellow
} else {
    Write-Host "   Function not found - creating" -ForegroundColor Yellow
}

Write-Host "Step 4: Deploying to AWS Lambda..." -ForegroundColor Cyan
if ($exists) {
    aws lambda update-function-code --function-name $functionName --zip-file "fileb://$finalZipPath" --region $region --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Error "Update code failed"; exit 1 }
    Start-Sleep -Seconds 5
    aws lambda update-function-configuration --function-name $functionName --timeout 300 --memory-size 512 --layers $layerArn --environment "file://$envFile" --region $region --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Error "Update config failed"; exit 1 }
} else {
    aws lambda create-function --function-name $functionName --runtime nodejs18.x --role $roleArn --handler index.handler --zip-file "fileb://$finalZipPath" --timeout 300 --memory-size 512 --layers $layerArn --environment "file://$envFile" --region $region --output json | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Error "Create function failed"; exit 1 }
}

Write-Host ""
Write-Host "SUCCESS: okvevo-branding deployed successfully!" -ForegroundColor Green
Remove-Item $envFile -Force
