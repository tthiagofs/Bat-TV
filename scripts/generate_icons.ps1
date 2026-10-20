Add-Type -AssemblyName System.Drawing

$srcLogoPath = Join-Path $PSScriptRoot "..\src\assets\logo.png"
if (-not (Test-Path $srcLogoPath)) {
    $srcLogoPath = Join-Path $PSScriptRoot "..\logo transparente.png"
}

Write-Host "Usando logo fonte: $srcLogoPath"
$sourceImg = [System.Drawing.Image]::FromFile((Resolve-Path $srcLogoPath).Path)

function Resize-ImageCentered {
    param(
        [System.Drawing.Image]$img,
        [int]$targetW,
        [int]$targetH,
        [System.Drawing.Color]$bgColor,
        [float]$paddingRatio = 0.15,
        [bool]$isRound = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($bgColor -ne [System.Drawing.Color]::Transparent) {
        if ($isRound) {
            $g.Clear([System.Drawing.Color]::Transparent)
            $brush = New-Object System.Drawing.SolidBrush($bgColor)
            $g.FillEllipse($brush, 0, 0, $targetW, $targetH)
            $brush.Dispose()
        } else {
            $g.Clear($bgColor)
        }
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    # Calcula proporção do logo com padding
    $availW = $targetW * (1.0 - ($paddingRatio * 2))
    $availH = $targetH * (1.0 - ($paddingRatio * 2))

    $scale = [Math]::Min($availW / $img.Width, $availH / $img.Height)
    $drawW = [int]($img.Width * $scale)
    $drawH = [int]($img.Height * $scale)
    $destX = [int](($targetW - $drawW) / 2)
    $destY = [int](($targetH - $drawH) / 2)

    $g.DrawImage($img, $destX, $destY, $drawW, $drawH)
    $g.Dispose()

    return $bmp
}

$resBase = Join-Path $PSScriptRoot "..\android\app\src\main\res"

# 1. Banners Leanback 16:9
$bannerSizes = @{
    "drawable"          = @{ W = 320; H = 180 }
    "drawable-mdpi"     = @{ W = 320; H = 180 }
    "drawable-hdpi"     = @{ W = 480; H = 270 }
    "drawable-xhdpi"    = @{ W = 640; H = 360 }
    "drawable-xxhdpi"   = @{ W = 960; H = 540 }
    "drawable-xxxhdpi"  = @{ W = 1280; H = 720 }
}

$darkBg = [System.Drawing.Color]::FromArgb(255, 10, 10, 12)

foreach ($entry in $bannerSizes.GetEnumerator()) {
    $dir = Join-Path $resBase $entry.Key
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $outPath = Join-Path $dir "banner.png"

    $bannerBmp = Resize-ImageCentered -img $sourceImg -targetW $entry.Value.W -targetH $entry.Value.H -bgColor $darkBg -paddingRatio 0.12 -isRound $false
    $bannerBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bannerBmp.Dispose()
    Write-Host "Banner gerado: $outPath ($($entry.Value.W)x$($entry.Value.H))"
}

# 2. Ícones de Launcher (ic_launcher, ic_launcher_round, ic_launcher_foreground)
$mipmapSizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($entry in $mipmapSizes.GetEnumerator()) {
    $dir = Join-Path $resBase $entry.Key
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $sz = $entry.Value

    # ic_launcher (quadrado com cantos/fundo escuro premium)
    $iconBmp = Resize-ImageCentered -img $sourceImg -targetW $sz -targetH $sz -bgColor $darkBg -paddingRatio 0.10 -isRound $false
    $iconPath = Join-Path $dir "ic_launcher.png"
    $iconBmp.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBmp.Dispose()

    # ic_launcher_round (círculo)
    $roundBmp = Resize-ImageCentered -img $sourceImg -targetW $sz -targetH $sz -bgColor $darkBg -paddingRatio 0.12 -isRound $true
    $roundPath = Join-Path $dir "ic_launcher_round.png"
    $roundBmp.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $roundBmp.Dispose()

    # ic_launcher_foreground (transparente)
    $fgBmp = Resize-ImageCentered -img $sourceImg -targetW $sz -targetH $sz -bgColor ([System.Drawing.Color]::Transparent) -paddingRatio 0.12 -isRound $false
    $fgPath = Join-Path $dir "ic_launcher_foreground.png"
    $fgBmp.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fgBmp.Dispose()

    Write-Host "Mipmap gerado: $dir (${sz}x${sz})"
}

$sourceImg.Dispose()
Write-Host "Todos os icones e banners do Fire TV foram gerados com sucesso!"
