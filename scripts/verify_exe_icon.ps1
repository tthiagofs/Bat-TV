Add-Type -AssemblyName System.Drawing
$exePath = (Resolve-Path "release\win-unpacked\BAT TV.exe").Path
$setupPath = (Resolve-Path "release\BAT-TV-Setup-0.1.0.exe").Path

$ico = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
$bmp = $ico.ToBitmap()
$outPng = Join-Path $PSScriptRoot "extracted_exe_icon.png"
$bmp.Save($outPng)
Write-Host "BAT TV.exe -> Ícone extraído com sucesso! Tamanho: $($bmp.Width)x$($bmp.Height)"
$bmp.Dispose()
$ico.Dispose()

$icoSetup = [System.Drawing.Icon]::ExtractAssociatedIcon($setupPath)
$bmpSetup = $icoSetup.ToBitmap()
$outSetupPng = Join-Path $PSScriptRoot "extracted_setup_icon.png"
$bmpSetup.Save($outSetupPng)
Write-Host "BAT-TV-Setup-0.1.0.exe -> Ícone extraído com sucesso! Tamanho: $($bmpSetup.Width)x$($bmpSetup.Height)"
$bmpSetup.Dispose()
$icoSetup.Dispose()
