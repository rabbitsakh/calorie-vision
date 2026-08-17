# Create GitHub repo and push project
# Run: powershell -ExecutionPolicy Bypass -File scripts/push-to-github.ps1

$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$git = "C:\Program Files\Git\cmd\git.exe"
$env:PATH = "C:\Program Files\Git\cmd;" + $env:PATH
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Set-Location $root
Write-Host "Working directory: $root"

if (-not (Test-Path (Join-Path $root ".git"))) {
    throw "Git repository not found in $root"
}

& $gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "Login to GitHub first:"
    & $gh auth login -h github.com -p https -w
}

$repoName = "calorie-vision"
$user = & $gh api user -q .login

$prevErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $gh repo view "$user/$repoName" 2>$null | Out-Null
$repoExists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevErrorAction

if ($repoExists) {
    Write-Host "Repo $repoName already exists, setting remote and pushing..."
    & $git remote remove origin 2>$null
    & $git remote add origin "https://github.com/$user/$repoName.git"
} else {
    Write-Host "Creating repo $repoName..."
    & $gh repo create $repoName --public --source=. --remote=origin --description "Calorie Vision - Next.js, GigaChat, MySQL"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create repository" }
}

& $git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "Failed to push to GitHub" }

$url = "https://github.com/$user/$repoName"
Write-Host "Done! $url"
