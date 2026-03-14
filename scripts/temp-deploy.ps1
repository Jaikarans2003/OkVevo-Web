$Lambdas = @("lambda-ai-influencer", "lambda-ai-prep", "lambda-lipsync-submit")
$Region = "us-east-1"
$RootDir = Get-Location

foreach ($Lambda in $Lambdas) {
    if (Test-Path "$Lambda\") {
        echo "📦 Preparing to deploy $Lambda"
        $ZipPath = "$RootDir\$Lambda.zip"
        if (Test-Path $ZipPath) { Remove-Item $ZipPath }
        
        echo "  > Zipping contents..."
        Compress-Archive -Path "$RootDir\$Lambda\*" -DestinationPath $ZipPath -Force
        
        echo "  > Uploading to AWS Lambda..."
        aws lambda update-function-code --function-name $Lambda --zip-file "fileb://$ZipPath" --region $Region | Out-Null
        
        if ($LASTEXITCODE -eq 0 -or $?) {
            echo "✅ Successfully deployed $Lambda"
        } else {
            echo "❌ Failed to deploy $Lambda"
        }
        
        if (Test-Path $ZipPath) { Remove-Item $ZipPath }
    } else {
        echo "⚠️  Folder $Lambda not found, skipping..."
    }
}
