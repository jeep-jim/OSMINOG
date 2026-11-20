# Run in the same Windows account as Chrome. No credentials are written to the project.
param([string]$TunnelId)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22+ first.' }
if (-not (Get-Command tunnel-client -ErrorAction SilentlyContinue)) {
    throw 'Install the official OpenAI tunnel-client from Platform tunnel settings, then run this script again.'
}
if (-not $TunnelId) { $TunnelId = Read-Host 'Tunnel ID from OpenAI Platform (not an API key)' }
if ($TunnelId -notmatch '^tunnel_[A-Za-z0-9]+$') { throw 'Invalid tunnel ID.' }
$previousKey = $env:CONTROL_PLANE_API_KEY
$secret = Read-Host 'Runtime API key for tunnel-client (hidden; do not paste into chat)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $env:CONTROL_PLANE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $server = (Join-Path $PSScriptRoot 'server.mjs').Replace('\','/')
    $command = 'node "' + $server + '"'
    & tunnel-client init --sample sample_mcp_stdio_local --profile osminog --tunnel-id $TunnelId --mcp-command $command
    if ($LASTEXITCODE -ne 0) { throw 'Tunnel initialization failed. Check tunnel permissions and configuration.' }
    & tunnel-client doctor --profile osminog --explain
    if ($LASTEXITCODE -ne 0) { throw 'Tunnel diagnostics failed. Do not continue until they pass.' }
    Write-Host 'Keep this window open. In OSMINOG > Access > MCP, select %LOCALAPPDATA%\OSMINOG\mcp-pairing.json after the bridge starts.'
    & tunnel-client run --profile osminog
    if ($LASTEXITCODE -ne 0) { throw 'Tunnel client stopped with an error.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $env:CONTROL_PLANE_API_KEY = $previousKey
    $secret.Dispose()
}
