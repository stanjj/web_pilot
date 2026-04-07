param(
  [Parameter(Mandatory = $true)]
  [int]$Port,

  [Parameter(Mandatory = $true)]
  [string]$ProfileDir,

  [string]$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe",

  [string]$Urls = "",

  [switch]$Show
)

if (-not (Test-Path $ChromePath)) {
  throw "Chrome not found: $ChromePath"
}

New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

$args = @(
  "--remote-debugging-port=$Port"
  "--user-data-dir=$ProfileDir"
  "--no-first-run"
  "--no-default-browser-check"
  "--new-window"
  "--disable-session-crashed-bubble"
  "--disable-features=Translate,AutomationControlled"
)

if (-not $Show) {
  $args += "--start-minimized"
}

if ($Urls) {
  $parsedUrls = $Urls.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  if ($parsedUrls.Count -gt 0) {
    $args += $parsedUrls
  } else {
    $args += "about:blank"
  }
} else {
  $args += "about:blank"
}

$proc = Start-Process -FilePath $ChromePath -ArgumentList $args -PassThru

[pscustomobject]@{
  ok = $true
  port = $Port
  profileDir = $ProfileDir
  pid = $proc.Id
  show = [bool]$Show
  urls = if ($Urls) { $parsedUrls } else { @() }
} | ConvertTo-Json -Depth 4
