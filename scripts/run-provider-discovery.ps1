param(
  [ValidateSet("discover", "dry-run", "run")]
  [string]$Mode = "discover",

  [switch]$Headed,
  [switch]$ForceStage
)

$ErrorActionPreference = "Stop"

function Read-RequiredValue {
  param(
    [string]$Prompt,
    [switch]$Secret
  )

  do {
    if ($Secret) {
      $value = Read-Host -Prompt $Prompt -AsSecureString
      $plain = [System.Net.NetworkCredential]::new("", $value).Password
    } else {
      $plain = Read-Host -Prompt $Prompt
    }

    if ([string]::IsNullOrWhiteSpace($plain)) {
      Write-Host "This value is required." -ForegroundColor Yellow
    }
  } while ([string]::IsNullOrWhiteSpace($plain))

  return $plain
}

Write-Host ""
Write-Host "Navigate Wealth Provider Portal Worker" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Cyan
Write-Host ""
Write-Host "Nothing entered here is written to disk by this script." -ForegroundColor Yellow
Write-Host "The values are only set for this worker process." -ForegroundColor Yellow
Write-Host ""

$adminToken = Read-RequiredValue -Prompt "Paste your Navigate Wealth admin session token" -Secret
$jobId = Read-RequiredValue -Prompt "Paste the Portal Job ID from Portal Automation"
$providerUsername = Read-RequiredValue -Prompt "Enter Allan Gray username"
$providerPassword = Read-RequiredValue -Prompt "Enter Allan Gray password" -Secret

$env:NW_API_AUTH_TOKEN = $adminToken
$env:NW_PORTAL_JOB_ID = $jobId
$env:NW_PROVIDER_ALLAN_GRAY_USERNAME = $providerUsername
$env:NW_PROVIDER_ALLAN_GRAY_PASSWORD = $providerPassword

if ($Headed) {
  $env:NW_PLAYWRIGHT_HEADED = "1"
}

if ($ForceStage) {
  $env:NW_PORTAL_FORCE_STAGE = "1"
}

try {
  npm.cmd run provider:sync -- --mode $Mode
  if ($LASTEXITCODE -ne 0) {
    throw "Provider worker exited with code $LASTEXITCODE"
  }
} finally {
  Remove-Item Env:\NW_API_AUTH_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:\NW_PORTAL_JOB_ID -ErrorAction SilentlyContinue
  Remove-Item Env:\NW_PROVIDER_ALLAN_GRAY_USERNAME -ErrorAction SilentlyContinue
  Remove-Item Env:\NW_PROVIDER_ALLAN_GRAY_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:\NW_PLAYWRIGHT_HEADED -ErrorAction SilentlyContinue
  Remove-Item Env:\NW_PORTAL_FORCE_STAGE -ErrorAction SilentlyContinue
}
