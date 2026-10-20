Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot '..\src\assets\stadiums'
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]72)
foreach ($name in 'stadium1', 'stadium2', 'stadium3') {
  $src = Join-Path $dir "$name.jpg"
  $tmp = Join-Path $dir "$name.tmp.jpg"
  $img = [System.Drawing.Image]::FromFile($src)
  $w = [Math]::Min(1280, $img.Width)
  $h = [int]($img.Height * $w / $img.Width)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose(); $img.Dispose()
  $bmp.Save($tmp, $codec, $params)
  $bmp.Dispose()
  Move-Item -Force $tmp $src
  '{0}: {1} KB' -f $name, [int]((Get-Item $src).Length / 1KB)
}
