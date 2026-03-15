# setup-lambda-env.ps1
# Configures the necessary environment variables for all 4 AI Influencer Lambdas.

$Region = "us-east-1"

# Extract values from .env
$EnvContent = Get-Content .env -Raw
if ($EnvContent -match "FB_SERVICE_ACCOUNT_KEY=([^\r\n]+)") { $FB_KEY = $Matches[1].Trim() }
if ($EnvContent -match "GEMINI_API_KEY=([^\r\n]+)") { $GEMINI_KEY = $Matches[1].Trim() }
if ($EnvContent -match "FAL_API_IMAGE=([^\r\n]+)") { $FAL_IMAGE = $Matches[1].Trim() }
if ($EnvContent -match "FAL_API_VIDEO=([^\r\n]+)") { $FAL_VIDEO = $Matches[1].Trim() }
if ($EnvContent -match "FAL_API_AUDIO=([^\r\n]+)") { $FAL_AUDIO = $Matches[1].Trim() }
if ($EnvContent -match "NEXT_PUBLIC_BASE_URL=([^\r\n]+)") { $BASE_URL = $Matches[1].Trim() }
if ($EnvContent -match "FIREBASE_STORAGE_BUCKET=([^\r\n]+)") { $STORAGE_BUCKET = $Matches[1].Trim() }

if ($EnvContent -match "FAL_MODE=([^\r\n]+)") { $FAL_MODE = $Matches[1].Trim() }

if (-not $FB_KEY) {
    Write-Error "FB_SERVICE_ACCOUNT_KEY not found in .env"
    exit 1
}

$CommonVars = "FB_SERVICE_ACCOUNT_KEY=$FB_KEY,FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET,FAL_MODE=$FAL_MODE"

# 1. okvevo-ai-prep
Write-Host "🔧 Configuring okvevo-ai-prep..."
$prepVars = "$CommonVars,GEMINI_API_KEY=$GEMINI_KEY,FAL_API_IMAGE=$FAL_IMAGE,FAL_API_AUDIO=$FAL_AUDIO,NEXT_PUBLIC_BASE_URL=$BASE_URL"
aws lambda update-function-configuration --function-name okvevo-ai-prep --region $Region --environment "Variables={$prepVars}"

# 2. okvevo-lipsync-submit
Write-Host "🔧 Configuring okvevo-lipsync-submit..."
$subVars = "$CommonVars,FAL_API_VIDEO=$FAL_VIDEO,NEXT_PUBLIC_BASE_URL=$BASE_URL"
aws lambda update-function-configuration --function-name okvevo-lipsync-submit --region $Region --environment "Variables={$subVars}"

# 3. okvevo-renderer
Write-Host "🔧 Configuring okvevo-renderer..."
aws lambda update-function-configuration --function-name okvevo-renderer --region $Region --environment "Variables={$CommonVars}"

# 4. okvevo-noop
Write-Host "🔧 Configuring okvevo-noop..."
aws lambda update-function-configuration --function-name okvevo-noop --region $Region --environment "Variables={FB_SERVICE_ACCOUNT_KEY=$FB_KEY,FAL_MODE=$FAL_MODE}"

Write-Host "`n✅ All Lambdas configured with environment variables."
