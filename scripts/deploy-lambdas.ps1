# deploy-lambdas.ps1
# Automates the deployment of updated AI Influencer Lambdas to AWS.

param (
    [string]$Region = "us-east-1"
)

$Lambdas = @("lambda-ai-prep", "lambda-lipsync-submit")
$RootDir = Get-Location

foreach ($Lambda in $Lambdas) {
    Write-Host "📦 Preparing to deploy $Lambda..." -ForegroundColor Cyan
    
    $LambdaDir = Join-Path $RootDir $Lambda
    $ZipPath = Join-Path $RootDir "$Lambda.zip"

    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath
    }

    # Zip the contents of the lambda directory
    # Note: We include index.js and package.json and node_modules
    Write-Host "  > Zipping contents of $LambdaDir..."
    Compress-Archive -Path "$LambdaDir\*" -DestinationPath $ZipPath

    # Deploy to AWS
    Write-Host "  > Uploading to AWS Lambda: $Lambda..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name $Lambda --zip-file "fileb://$ZipPath" --region $Region

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully deployed $Lambda" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to deploy $Lambda" -ForegroundColor Red
    }

    # Cleanup zip
    Remove-Item $ZipPath
}

Write-Host "`n🚀 All deployments finished." -ForegroundColor Green
