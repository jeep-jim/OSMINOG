# CI-only real display preparation. Run this file in a new pwsh process for each
# -- preparation and verification invocation. No registry/profile/DPI settings,
# unsafe display modes, virtual displays or application window bounds are changed.
param(
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [switch]$Verify
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$helperPid = $PID
$receipt = [ordered]@{
    schema = 1; version = '6.0.40'; platform = 'win32'; scope = 'session'
    source = 'User32 advertised display modes'; minimum = @{ width = 1440; height = 900 }
    pid = $helperPid; startedAt = [DateTime]::UtcNow.ToString('o'); ok = $false
}

function Write-Receipt {
    $json = ConvertTo-Json -InputObject $script:receipt -Depth 20
    [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), $json + "`n", [Text.UTF8Encoding]::new($false))
}
function Require([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
function Same-Mode($First, $Second) {
    if ($null -eq $First -or $null -eq $Second) { return $false }
    foreach ($field in @('width', 'height', 'bitDepth', 'frequency', 'flags', 'orientation')) {
        if ($null -eq $First.$field -or $null -eq $Second.$field -or $First.$field -ne $Second.$field) { return $false }
    }
    return $true
}
function Sufficient($Actual, $Selected) {
    return (Same-Mode $Actual.mode $Selected) -and $Actual.awareness -eq 2 `
        -and $Actual.logicalBounds.width -ge 1440 -and $Actual.logicalBounds.height -ge 900 `
        -and $Actual.bounds.width -eq $Actual.mode.width -and $Actual.bounds.height -eq $Actual.mode.height
}

try {
    Require ($env:CI -eq 'true') 'Display preparation is restricted to CI=true'
    Require ($IsWindows) 'Native Windows display preparation requires Windows'
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace Mouse637Display {
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct MONITORINFOEX {
        public uint cbSize; public RECT monitor, work; public uint flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string device;
    }
    // DEVMODEW's display union occupies the same 16 bytes as its printer union.
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct DEVMODE {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmDeviceName;
        public ushort dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
        public uint dmFields; public int dmPositionX, dmPositionY;
        public uint dmDisplayOrientation, dmDisplayFixedOutput;
        public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string dmFormName;
        public ushort dmLogPixels;
        public uint dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
        public uint dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
    }
    public sealed class Bounds {
        public double x, y, width, height;
        internal Bounds(RECT r, double scale) { x=r.left/scale; y=r.top/scale; width=(r.right-r.left)/scale; height=(r.bottom-r.top)/scale; }
    }
    public sealed class Mode {
        public int index; public uint width, height, bitDepth, frequency, flags, orientation;
        public double logicalWidth, logicalHeight;
        internal DEVMODE native;
        internal Mode(DEVMODE m, int i, double scale) {
            native=m; index=i; width=m.dmPelsWidth; height=m.dmPelsHeight; bitDepth=m.dmBitsPerPel;
            frequency=m.dmDisplayFrequency; flags=m.dmDisplayFlags; orientation=m.dmDisplayOrientation;
            logicalWidth=width/scale; logicalHeight=height/scale;
        }
    }
    public sealed class Snapshot {
        public string device; public Mode mode; public Bounds bounds, workArea, logicalBounds, logicalWorkArea;
        public uint dpi; public int monitorScalePercent, awareness; public double scaleFactor;
        public string dpiSource="GetDpiForSystem and GetScaleFactorForMonitor agree for the primary display";
    }
    public static class Native {
        [DllImport("user32.dll", ExactSpelling=true, SetLastError=true)] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll", ExactSpelling=true)] static extern IntPtr GetThreadDpiAwarenessContext();
        [DllImport("user32.dll", ExactSpelling=true)] static extern int GetAwarenessFromDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll", ExactSpelling=true)] static extern IntPtr MonitorFromPoint(POINT point, uint flags);
        [DllImport("user32.dll", ExactSpelling=true, CharSet=CharSet.Unicode, SetLastError=true)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool GetMonitorInfoW(IntPtr monitor, ref MONITORINFOEX info);
        [DllImport("user32.dll", ExactSpelling=true)] static extern uint GetDpiForSystem();
        [DllImport("shcore.dll", ExactSpelling=true)] static extern int GetScaleFactorForMonitor(IntPtr monitor, out int scale);
        [DllImport("user32.dll", ExactSpelling=true, CharSet=CharSet.Unicode)]
        [return: MarshalAs(UnmanagedType.Bool)] static extern bool EnumDisplaySettingsW(string device, int index, ref DEVMODE mode);
        [DllImport("user32.dll", ExactSpelling=true, CharSet=CharSet.Unicode)]
        static extern int ChangeDisplaySettingsExW(string device, ref DEVMODE mode, IntPtr window, uint flags, IntPtr parameter);

        static DEVMODE EmptyMode() {
            if (Marshal.SizeOf(typeof(DEVMODE))!=220) throw new InvalidOperationException("Unexpected DEVMODEW ABI size");
            return new DEVMODE { dmDeviceName=String.Empty, dmFormName=String.Empty, dmSize=220, dmDriverExtra=0 };
        }
        public static Snapshot Read() {
            IntPtr previous=SetThreadDpiAwarenessContext(new IntPtr(-4));
            if (previous==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot establish physical-pixel display coordinates");
            try {
                int awareness=GetAwarenessFromDpiAwarenessContext(GetThreadDpiAwarenessContext());
                if (awareness!=2) throw new InvalidOperationException("The display-reading thread is not per-monitor DPI aware");
                IntPtr monitor=MonitorFromPoint(new POINT { x=0, y=0 }, 1);
                var info=new MONITORINFOEX { cbSize=(uint)Marshal.SizeOf(typeof(MONITORINFOEX)), device=String.Empty };
                if (monitor==IntPtr.Zero || !GetMonitorInfoW(monitor, ref info)) throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot read the primary display");
                if ((info.flags&1)==0) throw new InvalidOperationException("Display preparation must target the real primary monitor");
                uint dpi=GetDpiForSystem(); int scalePercent;
                int scaleResult=GetScaleFactorForMonitor(monitor, out scalePercent);
                if (scaleResult!=0 || dpi==0 || scalePercent<=0) throw new InvalidOperationException("Cannot read the actual primary display DPI and scale: "+scaleResult);
                if ((long)dpi*100!=(long)scalePercent*96) throw new InvalidOperationException("Primary display DPI and monitor scale disagree; cannot prove logical bounds: dpi="+dpi+" scale="+scalePercent);
                double scale=dpi/96.0;
                var mode=EmptyMode();
                if (!EnumDisplaySettingsW(info.device, -1, ref mode)) throw new InvalidOperationException("Cannot read the actual current display mode");
                return new Snapshot { device=info.device, mode=new Mode(mode,-1,scale), bounds=new Bounds(info.monitor,1),
                    workArea=new Bounds(info.work,1), logicalBounds=new Bounds(info.monitor,scale), logicalWorkArea=new Bounds(info.work,scale),
                    dpi=dpi, monitorScalePercent=scalePercent, awareness=awareness, scaleFactor=scale };
            } finally { SetThreadDpiAwarenessContext(previous); }
        }
        public static Mode[] Modes(string device, double scale) {
            var result=new List<Mode>();
            for (int index=0; index<10000; index++) {
                var mode=EmptyMode();
                if (!EnumDisplaySettingsW(device,index,ref mode)) return result.ToArray();
                result.Add(new Mode(mode,index,scale));
            }
            throw new InvalidOperationException("Display mode enumeration did not terminate");
        }
        public static int Change(string device, Mode selected, bool testOnly) {
            var mode=selected.native;
            // Use the driver's returned DEVMODE unchanged. CDS_TEST tests it;
            // flags=0 applies dynamically, without CDS_UPDATEREGISTRY/GLOBAL.
            return ChangeDisplaySettingsExW(device,ref mode,IntPtr.Zero,testOnly?2u:0u,IntPtr.Zero);
        }
    }
}
'@
    if ($Verify) {
        $receipt = Get-Content -LiteralPath $OutputPath -Raw | ConvertFrom-Json -AsHashtable
        Require ($receipt.schema -eq 1 -and $receipt.version -eq '6.0.40' -and $receipt.platform -eq 'win32' -and $receipt.scope -eq 'session' -and $receipt.ok -eq $true) 'Display preparation did not produce a successful Windows session receipt'
        Require ($receipt.minimum.width -eq 1440 -and $receipt.minimum.height -eq 900) 'The logical 1440x900 minimum must remain unchanged'
        Require ($receipt.pid -gt 0 -and $receipt.pid -ne $helperPid) 'Persistence must be verified in a new process after preparation exits'
        Require (@($receipt.advertisedModes | Where-Object { Same-Mode $_ $receipt.selected }).Count -gt 0) 'Selected mode was not advertised by Windows'
        $actual = [Mouse637Display.Native]::Read()
        $receipt.persistence = @{ pid = $helperPid; checkedAt = [DateTime]::UtcNow.ToString('o'); actual = $actual }
        Require ($actual.device -eq $receipt.device -and (Sufficient $actual $receipt.selected)) 'The selected logical 1440x900 display mode did not persist after helper exit'
        $receipt.processExitVerified = $true
        Write-Receipt
        Write-Output 'MOUSE_637_WINDOWS_DISPLAY_PERSISTENCE_PASS'
    } else {
        $before = [Mouse637Display.Native]::Read()
        $receipt.device = $before.device; $receipt.before = $before
        $modes = @([Mouse637Display.Native]::Modes($before.device, $before.scaleFactor))
        $receipt.advertisedModes = $modes
        $candidates = @($modes | Where-Object {
            $_.logicalWidth -ge 1440 -and $_.logicalHeight -ge 900 -and $_.bitDepth -eq $before.mode.bitDepth -and $_.orientation -eq $before.mode.orientation
        } | Sort-Object @{ Expression = { [long]$_.width * [long]$_.height } }, @{ Expression = { if ($_.frequency -eq $before.mode.frequency) { 0 } else { 1 } } }, frequency)
        Require ($candidates.Count -gt 0) 'The actual Windows display advertises no mode with logical size at least 1440x900 at its current DPI; native verification cannot continue'
        $selected = $candidates | Where-Object { Same-Mode $_ $before.mode } | Select-Object -First 1
        if ($null -eq $selected) { $selected = $candidates[0] }
        $receipt.selected = $selected; $receipt.changed = -not (Same-Mode $before.mode $selected)
        if ($receipt.changed) {
            $tested = [Mouse637Display.Native]::Change($before.device, $selected, $true)
            $receipt.configuration = @{ test = $tested; flags = 0; registryUpdated = $false }
            Require ($tested -eq 0) "Windows rejected its advertised display mode during CDS_TEST: $tested"
            $applied = [Mouse637Display.Native]::Change($before.device, $selected, $false)
            $receipt.configuration.applied = $applied
            Require ($applied -eq 0) "Windows could not apply the dynamic display mode without restart: $applied"
        }
        $deadline = [DateTime]::UtcNow.AddSeconds(5)
        $actual = [Mouse637Display.Native]::Read()
        while (-not (Sufficient $actual $selected) -and [DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Milliseconds 100
            $actual = [Mouse637Display.Native]::Read()
        }
        $receipt.after = $actual
        Require ($actual.device -eq $before.device -and (Sufficient $actual $selected)) 'Actual Windows mode and DPI-aware logical bounds do not meet 1440x900 after configuration'
        $receipt.ok = $true
        Write-Receipt
        Write-Output 'MOUSE_637_WINDOWS_DISPLAY_PREPARED'
    }
} catch {
    $receipt.ok = $false; $receipt.error = $_.Exception.Message
    try { Write-Receipt } catch { [Console]::Error.WriteLine("Cannot save display failure receipt: " + $_.Exception.Message) }
    [Console]::Error.WriteLine("MOUSE_637_WINDOWS_DISPLAY_FAILED " + $receipt.error)
    exit 1
}
