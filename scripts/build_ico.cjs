const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { createIcoFromPngs } = require('./png_to_ico.cjs')

console.log('--- 1. Gerando frames PNG via PowerShell ---')
execSync('powershell -ExecutionPolicy Bypass -File scripts/generate_win_icons.ps1', {
  stdio: 'inherit'
})

console.log('--- 2. Empacotando frames em build/icon.ico ---')
const buildDir = path.resolve('build')
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngBuffers = []

for (const sz of sizes) {
  const p = path.join(buildDir, `icon_${sz}.png`)
  if (fs.existsSync(p)) {
    pngBuffers.push(fs.readFileSync(p))
  } else {
    console.warn(`Frame não encontrado: ${p}`)
  }
}

const icoBuffer = createIcoFromPngs(pngBuffers)
const icoPath = path.join(buildDir, 'icon.ico')
fs.writeFileSync(icoPath, icoBuffer)

console.log(`✅ Arquivo ICO criado com sucesso em: ${icoPath} (${icoBuffer.length} bytes)`)

// Também copia para public/icon.ico e public/icon.png para uso no Electron e web
fs.copyFileSync(icoPath, path.resolve('public/icon.ico'))
fs.copyFileSync(path.join(buildDir, 'icon.png'), path.resolve('public/icon.png'))
console.log('✅ Ícones copiados para pasta public/')
