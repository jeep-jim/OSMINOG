param([Parameter(Mandatory=$true)][string]$Executable,[string]$AppArgument='')
$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OSMINOGWindow {
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int cmd);
}
'@
function Launch {
 param([string]$Log)
 $p=@{FilePath=$Executable;PassThru=$true;RedirectStandardOutput="$Log.out.log";RedirectStandardError="$Log.err.log"}
 if($AppArgument){$p.ArgumentList=$AppArgument}
 return Start-Process @p
}
$first=Launch 'normal-launch'
try {
 $deadline=(Get-Date).AddSeconds(60)
 do {
  Start-Sleep -Milliseconds 250
  $first.Refresh()
  if($first.HasExited){throw "Normal launch exited: $($first.ExitCode)"}
  $ready=(Test-Path 'normal-launch.err.log') -and (Select-String 'normal-launch.err.log' -Pattern OSMINOG_READY -Quiet)
 } until(($first.MainWindowHandle -ne 0 -and $ready) -or (Get-Date) -ge $deadline)
 $handle=$first.MainWindowHandle
 if(-not $ready -or $handle -eq 0 -or -not [OSMINOGWindow]::IsWindowVisible($handle)){throw 'Normal launch did not expose a ready visible window'}
 [OSMINOGWindow]::ShowWindow($handle,6) | Out-Null
 $second=Launch 'second-launch'
 if(-not $second.WaitForExit(15000)){$second.Kill();throw 'Second instance did not exit'}
 Start-Sleep -Milliseconds 500
 if([OSMINOGWindow]::IsIconic($handle) -or -not [OSMINOGWindow]::IsWindowVisible($handle)){throw 'Second launch did not restore the first window'}
 Write-Output 'NORMAL_LAUNCH_AND_SECOND_INSTANCE_PASS'
} finally {
 if(-not $first.HasExited){$first.CloseMainWindow() | Out-Null;if(-not $first.WaitForExit(10000)){$first.Kill()}}
 Get-Content 'normal-launch.err.log' -ErrorAction SilentlyContinue
}
