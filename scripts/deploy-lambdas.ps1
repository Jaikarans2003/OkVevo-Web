# deploy-lambdas.ps1
# Automates the deployment of updated AI Influencer Lambdas to AWS.

param (
    [string]$Region = "us-east-1"
)

$Lambdas = @("okvevo-ai-prep", "okvevo-lipsync-submit", "okvevo-renderer", "okvevo-noop")
$RootDir = Get-Location

foreach ($Lambda in $Lambdas) {
    Write-Host "Preparing to deploy $Lambda..."
    
    $LambdaDir = "$RootDir\$Lambda"
    $ZipPath = "$RootDir\$Lambda.zip"

    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath
    }

    # Zip the contents of the lambda directory
    Write-Host "  - Zipping contents of $LambdaDir..."
    Compress-Archive -Path "$LambdaDir\*" -DestinationPath $ZipPath -Force

    # Deploy to AWS
    Write-Host "  - Uploading to AWS Lambda: $Lambda..."
    aws lambda update-function-code --function-name $Lambda --zip-file "fileb://$ZipPath" --region $Region

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully deployed $Lambda"
    } else {
        Write-Host "Failed to deploy $Lambda"
    }

    # Cleanup zip
    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath
    }
}

Write-Host "`nAll deployments finished."
