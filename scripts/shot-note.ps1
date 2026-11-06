# 截小窗 hover 态 + 验证从标题行顶部仍能拖动窗口
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class SN2 {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, UIntPtr e);
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
$script:card = [IntPtr]::Zero
$cb = [SN2+EnumProc] {
  param($h, $p)
  $owner = 0
  [void][SN2]::GetWindowThreadProcessId($h, [ref]$owner)
  if ($owner -eq $targetPid) {
    $sb = New-Object System.Text.StringBuilder 256
    [void][SN2]::GetClassName($h, $sb, 256)
    if ($sb.ToString() -eq "Tauri Window") {
      $r = New-Object SN2+RECT
      [void][SN2]::GetWindowRect($h, [ref]$r)
      if (($r.Right - $r.Left) -lt 600) { $script:card = $h }
    }
  }
  return $true
}
[void][SN2]::EnumWindows($cb, [IntPtr]::Zero)
if ($script:card -eq [IntPtr]::Zero) { Write-Output "NO_CARD"; exit 1 }

$r = New-Object SN2+RECT
[void][SN2]::GetWindowRect($script:card, [ref]$r)
Write-Output "BEFORE rect=($($r.Left),$($r.Top))"

# hover 截屏
[void][SN2]::SetCursorPos(($r.Left + 120), ($r.Top + 60))
Start-Sleep -Milliseconds 700
$w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
$bmp.Save((Join-Path $root "shot-note.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "SHOT saved"

# 从标题行顶部拖动窗口
$grabX = $r.Left + 200
$grabY = $r.Top + 4
[void][SN2]::SetCursorPos($grabX, $grabY)
Start-Sleep -Milliseconds 250
[SN2]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 120

1..6 | ForEach-Object {
  [void][SN2]::SetCursorPos($grabX - ($_ * 10), $grabY - ($_ * 5))
  Start-Sleep -Milliseconds 70
}
Start-Sleep -Milliseconds 300
[SN2]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 600

$r2 = New-Object SN2+RECT
[void][SN2]::GetWindowRect($script:card, [ref]$r2)
Write-Output "AFTER  rect=($($r2.Left),$($r2.Top))"
if ($r2.Left -ne $r.Left -or $r2.Top -ne $r.Top) {
  Write-Output "DRAG=OK 窗口可拖动"
} else {
  Write-Output "DRAG=FAIL 拖不动"
}
