# deploy-lambdas.ps1
# Automates the deployment of updated AI Influencer Lambdas to AWS.

param (
    [string]$Region = "us-east-1"
)

$Lambdas = @("okvevo-ai-prep", "okvevo-lipsync-submit", "okvevo-renderer", "okvevo-noop")
$RootDir = Get-Location

foreach ($Lambda in $Lambdas) {
    echo "📦 Preparing to deploy $Lambda..."
    
    $LambdaDir = "$RootDir\$Lambda"
    $ZipPath = "$RootDir\$Lambda.zip"

    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath
    }

    # Zip the contents of the lambda directory
    echo "  > Zipping contents of $LambdaDir..."
    Compress-Archive -Path "$LambdaDir\*" -DestinationPath $ZipPath -Force

    # Deploy to AWS
    echo "  > Uploading to AWS Lambda: $Lambda..."
    aws lambda update-function-code --function-name $Lambda --zip-file "fileb://$ZipPath" --region $Region

    if ($LASTEXITCODE -eq 0) {
        echo "✅ Successfully deployed $Lambda"
    } else {
        echo "❌ Failed to deploy $Lambda"
    }

    # Cleanup zip
    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath
    }
}

echo "`n🚀 All deployments finished."
