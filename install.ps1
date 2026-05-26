$MIN_NODE = 18
$nodeVer = 0
try { $nodeVer = [int](node -e "console.log(process.versions.node.split('.')[0])" 2>$null) } catch {}

if ($nodeVer -lt $MIN_NODE) {
    Write-Error "mcp-ipm requires Node.js >= $MIN_NODE. Install at https://nodejs.org"
    exit 1
}

$localInstaller = $null
if ($MyInvocation.MyCommand.Path) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $localInstaller = Join-Path $scriptDir "bin\install.js"
}

if ($localInstaller -and (Test-Path $localInstaller)) {
    node $localInstaller @args
} else {
    npx -y "github:neto-developer/mcp-ipm" @args
}
