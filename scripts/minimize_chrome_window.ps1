param(
  [Parameter(Mandatory = $true)]
  [int]$Port
)

$signature = @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public static class Win32ShowWindow {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  public static IntPtr[] GetVisibleWindowsForProcess(int processId) {
    var handles = new List<IntPtr>();
    EnumWindows((hWnd, lParam) => {
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      if (pid == processId && IsWindowVisible(hWnd)) {
        handles.Add(hWnd);
      }
      return true;
    }, IntPtr.Zero);
    return handles.ToArray();
  }
}
"@

Add-Type -TypeDefinition $signature -ErrorAction SilentlyContinue | Out-Null

$SW_MINIMIZE = 6

function Get-DebugChromeProcessIds {
  param([int]$DebugPort)

  $results = @()

  try {
    $matches = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" |
      Where-Object { $_.CommandLine -match "(^|\\s)--remote-debugging-port=$DebugPort(\\s|$)" }
    foreach ($match in $matches) {
      $results += [int]$match.ProcessId
    }
  } catch {
  }

  if (-not $results) {
    try {
      $listeners = Get-NetTCPConnection -State Listen -LocalPort $DebugPort -ErrorAction Stop |
        Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pid in $listeners) {
        $results += [int]$pid
      }
    } catch {
    }
  }

  if (-not $results) {
    try {
      $netstat = netstat -ano -p tcp
      foreach ($line in $netstat) {
        $trimmed = ($line -replace '^\s+', '') -replace '\s+', ' '
        $parts = $trimmed.Split(' ')
        if ($parts.Length -lt 5) {
          continue
        }
        $localAddress = $parts[1]
        $state = $parts[3]
        $pidText = $parts[4]
        if ($state -eq 'LISTENING' -and $localAddress -match "[:\.]$DebugPort$" -and $pidText -match '^\d+$') {
          $results += [int]$pidText
        }
      }
    } catch {
    }
  }

  $results | Sort-Object -Unique
}

function Try-MinimizeProcessWindow {
  param([int]$ProcessId)

  try {
    $handles = [Win32ShowWindow]::GetVisibleWindowsForProcess($ProcessId)
    if ($handles.Count -gt 0) {
      foreach ($handle in $handles) {
        [void][Win32ShowWindow]::ShowWindowAsync($handle, $SW_MINIMIZE)
      }
      return [pscustomobject]@{
        pid = $ProcessId
        minimized = $true
        handles = @($handles | ForEach-Object { $_.ToInt64() })
      }
    }
  } catch {
  }

  return $null
}

$pids = @(Get-DebugChromeProcessIds -DebugPort $Port)
$attempts = @()

foreach ($debugPid in $pids) {
  $result = Try-MinimizeProcessWindow -ProcessId $debugPid
  if ($result) {
    $attempts += $result
  }
}

$output = [pscustomobject]@{
  ok = $true
  port = $Port
  matchedPids = $pids
  minimized = $attempts
}

$output | ConvertTo-Json -Depth 4
