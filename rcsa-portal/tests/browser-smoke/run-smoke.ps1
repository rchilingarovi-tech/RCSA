# Launch a headless Chromium browser with a FRESH, throw-away profile, run
# smoke.mjs against an already-running app URL, then close the browser and
# delete the profile. Windows PowerShell 5.1+.
#
#   .\run-smoke.ps1 -Url http://localhost:5173/ -Out C:\temp\smoke-dev
#
# Requires `node` (Node 22+, for built-in WebSocket) on PATH, and Microsoft Edge
# or Google Chrome. The app must already be served (npm run dev / npm run preview).
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Port = 9333,
  [string]$BrowserPath = ''
)
$ErrorActionPreference = 'Stop'

if (-not $BrowserPath) {
  $candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
  )
  $BrowserPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $BrowserPath) { throw 'No Edge/Chrome found. Pass -BrowserPath.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node is not on PATH (see docs/testing.md - fnm).' }

$profileDir = Join-Path $env:TEMP ('rcsa-smoke-profile-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
Start-Process -FilePath $BrowserPath -ArgumentList '--headless=new', "--remote-debugging-port=$Port", "--user-data-dir=$profileDir", '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank' | Out-Null
try {
  $up = $false
  for ($i = 0; $i -lt 40; $i++) {
    try { Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/json/version" -TimeoutSec 2 | Out-Null; $up = $true; break } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $up) { throw "Browser did not open the DevTools port $Port." }
  & node (Join-Path $PSScriptRoot 'smoke.mjs') $Port $Url $Out
  $code = $LASTEXITCODE
} finally {
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" |
    Where-Object { $_.CommandLine -like "*$profileDir*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 800
  Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
}
exit $code
