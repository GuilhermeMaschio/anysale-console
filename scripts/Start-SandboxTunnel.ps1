param(
  [string]$TunnelName = 'anysale-sandbox'
)

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  $windowsInstall = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
  if (Test-Path $windowsInstall) {
    $cloudflaredPath = $windowsInstall
  } else {
    Write-Warning 'Cloudflared não está instalado. O Console continuará apenas em modo local.'
    exit 0
  }
} else {
  $cloudflaredPath = $cloudflared.Source
}

$configPath = Join-Path $env:USERPROFILE '.cloudflared\config.yml'
if (-not (Test-Path $configPath)) {
  Write-Warning "O túnel nomeado não está configurado em $configPath. O Console continuará apenas em modo local."
  exit 0
}

$runningTunnel = Get-CimInstance Win32_Process -Filter "name='cloudflared.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match "tunnel\s+run\s+$TunnelName" }

if ($runningTunnel) {
  Write-Host "Túnel $TunnelName já está em execução."
  exit 0
}

$process = Start-Process -FilePath $cloudflaredPath -ArgumentList @('tunnel', 'run', $TunnelName) -WindowStyle Hidden -PassThru
Write-Host "Túnel $TunnelName iniciado (processo $($process.Id))."
