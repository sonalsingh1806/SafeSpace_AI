param(
    [string]$FunctionName = "safespace-ai",
    [string]$RepositoryName = "safespace-ai",
    [string]$Region = "",
    [string]$EnvFile = "server/.env",
    [string]$RoleName = "safespace-ai-lambda-role"
)

$ErrorActionPreference = "Stop"

function Get-EnvMap {
    param([string]$Path)

    $envMap = @{}
    if (-not (Test-Path $Path)) {
        throw "Missing env file: $Path"
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $parts = $line -split "=", 2
        if ($parts.Length -eq 2) {
            $envMap[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
        }
    }

    return $envMap
}

if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    throw "AWS CLI is not installed or is not on PATH."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is not installed or is not on PATH. Install Docker Desktop, then rerun this script."
}

if (-not $Region) {
    $Region = aws configure get region
}

if (-not $Region) {
    throw "No AWS region configured. Pass -Region us-east-1 or run aws configure set region us-east-1."
}

$envMap = Get-EnvMap $EnvFile
foreach ($required in @("OPENAI_API_KEY", "GEMINI_API_KEY")) {
    if (-not $envMap.ContainsKey($required) -or -not $envMap[$required]) {
        throw "Missing $required in $EnvFile."
    }
}

$envMap["PORT"] = "8080"
if (-not $envMap.ContainsKey("FRONTEND_ORIGIN") -or -not $envMap["FRONTEND_ORIGIN"]) {
    $envMap["FRONTEND_ORIGIN"] = "*"
}

$accountId = aws sts get-caller-identity --query Account --output text
$repoUri = "${accountId}.dkr.ecr.${Region}.amazonaws.com/${RepositoryName}"
$imageTag = "latest"
$imageUri = "${repoUri}:${imageTag}"

aws ecr describe-repositories --repository-names $RepositoryName --region $Region *> $null
if ($LASTEXITCODE -ne 0) {
    aws ecr create-repository --repository-name $RepositoryName --region $Region | Out-Null
}

aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "${accountId}.dkr.ecr.${Region}.amazonaws.com"
docker build --platform linux/amd64 -t $imageUri .
docker push $imageUri

$roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text 2>$null
if ($LASTEXITCODE -ne 0 -or -not $roleArn) {
    $trustPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{ Service = "lambda.amazonaws.com" }
                Action = "sts:AssumeRole"
            }
        )
    } | ConvertTo-Json -Depth 10 -Compress

    $trustPolicyFile = New-TemporaryFile
    Set-Content -Path $trustPolicyFile -Value $trustPolicy -NoNewline
    $roleArn = aws iam create-role --role-name $RoleName --assume-role-policy-document "file://$trustPolicyFile" --query "Role.Arn" --output text
    Remove-Item $trustPolicyFile -Force
    aws iam attach-role-policy --role-name $RoleName --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    Start-Sleep -Seconds 10
}

$environment = "Variables={OPENAI_API_KEY=`"$($envMap["OPENAI_API_KEY"])`",GEMINI_API_KEY=`"$($envMap["GEMINI_API_KEY"])`",PORT=`"8080`",FRONTEND_ORIGIN=`"$($envMap["FRONTEND_ORIGIN"])`"}"

aws lambda get-function --function-name $FunctionName --region $Region *> $null
if ($LASTEXITCODE -eq 0) {
    aws lambda update-function-code --function-name $FunctionName --image-uri $imageUri --region $Region | Out-Null
    aws lambda wait function-updated --function-name $FunctionName --region $Region
    aws lambda update-function-configuration --function-name $FunctionName --timeout 60 --memory-size 2048 --environment $environment --region $Region | Out-Null
} else {
    aws lambda create-function `
        --function-name $FunctionName `
        --package-type Image `
        --code ImageUri=$imageUri `
        --role $roleArn `
        --timeout 60 `
        --memory-size 2048 `
        --environment $environment `
        --region $Region | Out-Null
}

aws lambda wait function-active --function-name $FunctionName --region $Region

$functionUrl = aws lambda get-function-url-config --function-name $FunctionName --region $Region --query "FunctionUrl" --output text 2>$null
if ($LASTEXITCODE -ne 0 -or -not $functionUrl) {
    $functionUrl = aws lambda create-function-url-config --function-name $FunctionName --auth-type NONE --region $Region --query "FunctionUrl" --output text
    aws lambda add-permission `
        --function-name $FunctionName `
        --statement-id FunctionURLAllowPublicAccess `
        --action lambda:InvokeFunctionUrl `
        --principal "*" `
        --function-url-auth-type NONE `
        --region $Region | Out-Null
}

Write-Host "Deployed SafeSpaceAI to AWS Lambda:"
Write-Host $functionUrl
