Add-Type -AssemblyName System.Drawing

$srcLogoPath = Join-Path $PSScriptRoot "..\src\assets\logo.png"
if (-not (Test-Path $srcLogoPath)) {
    $srcLogoPath = Join-Path $PSScriptRoot "..\public\logo.png"
}

Write-Host "Usando logo fonte: $srcLogoPath"
$sourceImg = [System.Drawing.Image]::FromFile((Resolve-Path $srcLogoPath).Path)

$buildDir = Join-Path $PSScriptRoot "..\build"
if (-not (Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
}

function Create-RoundedIconBitmap {
    param(
        [System.Drawing.Image]$img,
        [int]$size
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $g.Clear([System.Drawing.Color]::Transparent)

    # Raio do squircle (arredondamento moderno estilo Windows 11 / macOS / iOS)
    $radius = [int]($size * 0.22)
    $diameter = $radius * 2
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath

    # Cria retângulo com cantos arredondados
    $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $path.AddArc($size - $diameter, 0, $diameter, $diameter, 270, 90)
    $path.AddArc($size - $diameter, $size - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc(0, $size - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    # Preenchimento elegante de fundo escuro (#0c0d12 até #06070a)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 18, 20, 28),
        [System.Drawing.Color]::FromArgb(255, 6, 7, 10),
        90.0
    )
    $g.FillPath($brush, $path)
    $brush.Dispose()

    # Borda sutil de destaque (1px para dar profundidade e acabamento premium)
    if ($size -ge 32) {
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 255, 255, 255), 1.0)
        $g.DrawPath($pen, $path)
        $pen.Dispose()
    }

    $path.Dispose()

    # Desenha o logo centralizado mantendo proporção
    $paddingRatio = 0.12
    $availW = $size * (1.0 - ($paddingRatio * 2))
    $availH = $size * (1.0 - ($paddingRatio * 2))

    $scale = [Math]::Min($availW / $img.Width, $availH / $img.Height)
    $drawW = [int]($img.Width * $scale)
    $drawH = [int]($img.Height * $scale)
    $destX = [int](($size - $drawW) / 2)
    $destY = [int](($size - $drawH) / 2)

    $g.DrawImage($img, $destX, $destY, $drawW, $drawH)
    $g.Dispose()

    return $bmp
}

# Gera PNGs para os múltiplos tamanhos necessários no Windows ICO
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$tempPngFiles = @()

foreach ($sz in $sizes) {
    $iconBmp = Create-RoundedIconBitmap -img $sourceImg -size $sz
    $tempPng = Join-Path $buildDir "icon_${sz}.png"
    $iconBmp.Save($tempPng, [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBmp.Dispose()
    $tempPngFiles += $tempPng
    Write-Host "Gerado frame: ${sz}x${sz}"
}

# Gera também o icon.png em 512x512 para o instalador e alta resolução
$highResBmp = Create-RoundedIconBitmap -img $sourceImg -size 512
$highResPath = Join-Path $buildDir "icon.png"
$highResBmp.Save($highResPath, [System.Drawing.Imaging.ImageFormat]::Png)
$highResBmp.Dispose()
Write-Host "Gerado alta resolução: $highResPath"

$sourceImg.Dispose()
Write-Host "Frames gerados com sucesso no diretório build!"
