Add-Type -AssemblyName System.Drawing

$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

function New-RoundedPath([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r * 2, $r * 2, 180, 90)
  $p.AddArc($x + $w - $r * 2, $y, $r * 2, $r * 2, 270, 90)
  $p.AddArc($x + $w - $r * 2, $y + $h - $r * 2, $r * 2, $r * 2, 0, 90)
  $p.AddArc($x, $y + $h - $r * 2, $r * 2, $r * 2, 90, 90)
  $p.CloseFigure()
  return $p
}

$pad = 52
$w = $size - $pad * 2
$h = $size - $pad * 2
$path = New-RoundedPath $pad $pad $w $h 58

$c1 = [System.Drawing.Color]::FromArgb(255, 255, 248, 197)
$c2 = [System.Drawing.Color]::FromArgb(255, 243, 217, 116)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point $pad, $pad),
  (New-Object System.Drawing.Point ($pad + $w), ($pad + $h)),
  $c1, $c2)
$g.FillPath($brush, $path)

$lineBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120, 96, 80, 48))
for ($i = 0; $i -lt 3; $i++) {
  $ly = 196 + $i * 62
  $lw = $w - 120 - $i * 52
  $g.FillRectangle($lineBrush, $pad + 58, $ly, $lw, 16)
}

$bmp.Save((Join-Path $PSScriptRoot "..\app-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "icon generated"
