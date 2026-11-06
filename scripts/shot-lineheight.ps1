# 截主窗口编辑区与便签小窗，确认行高变化
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class LH {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "src-tauri\target\debug\note.exe"

Get-Process -Name note -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 700
Start-Process -FilePath $exe -ArgumentList "--pin-test" | Out-Null
Start-Sleep -Seconds 9

$proc = Get-Process -Name note -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Output "NOT_RUNNING"; exit 1 }

$targetPid = $proc.Id
$script:main = [IntPtr]::Zero
$script:card = [IntPtr]::Zero
$cb = [LH+EnumProc] {
  param($h, $p)
  $owner = 0
  [void][LH]::GetWindowThreadProcessId($h, [ref]$owner)
  if ($owner -eq $targetPid) {
    $sb = New-Object System.Text.StringBuilder 256
    [void][LH]::GetClassName($h, $sb, 256)
    if ($sb.ToString() -eq "Tauri Window") {
      $r = New-Object LH+RECT
      [void][LH]::GetWindowRect($h, [ref]$r)
      if (($r.Right - $r.Left) -gt 600) { $script:main = $h } else { $script:card = $h }
    }
  }
  return $true
}
[void][LH]::EnumWindows($cb, [IntPtr]::Zero)

# 主窗口编辑区
if ($script:main -ne [IntPtr]::Zero) {
  $r = New-Object LH+RECT
  [void][LH]::GetWindowRect($script:main, [ref]$r)
  $w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
  $bmp.Save((Join-Path $root "lh-main.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "MAIN shot ${w}x${h}"
}

# 便签小窗（hover 让工具条显示）
if ($script:card -ne [IntPtr]::Zero) {
  $r = New-Object LH+RECT
  [void][LH]::GetWindowRect($script:card, [ref]$r)
  [void][LH]::SetCursorPos(($r.Left + 120), ($r.Top + 60))
  Start-Sleep -Milliseconds 600
  $w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
  $bmp.Save((Join-Path $root "lh-note.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "NOTE shot ${w}x${h}"
}
