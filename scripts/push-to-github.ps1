# Создание репозитория на GitHub и загрузка проекта
# Запуск: powershell -ExecutionPolicy Bypass -File scripts/push-to-github.ps1

$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$git = "C:\Program Files\Git\cmd\git.exe"
$root = Split-Path -Parent $PSScriptRoot

Set-Location $root

& $gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "Сначала войдите в GitHub:"
  & $gh auth login -h github.com -p https -w
}

$repoName = "calorie-vision"
$exists = & $gh repo view $repoName 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Репозиторий $repoName уже существует, добавляем remote и пушим..."
    & $git remote remove origin 2>$null
    $user = (& $gh api user -q .login)
    & $git remote add origin "https://github.com/$user/$repoName.git"
} else {
    Write-Host "Создаём репозиторий $repoName..."
    & $gh repo create $repoName --public --source=. --remote=origin --description "Учёт калорий по фото (Next.js, GigaChat, MySQL)"
}

& $git push -u origin main
Write-Host "Готово! URL: https://github.com/$( & $gh api user -q .login )/$repoName"
