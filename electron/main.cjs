const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')

// Migra automaticamente dados salvos de login/listas da versão anterior (iptv-rea) para bat-tv
try {
  const appData = app.getPath('appData')
  const legacyDir = path.join(appData, 'iptv-rea')
  const currentDir = path.join(appData, 'bat-tv')
  if (fs.existsSync(legacyDir) && (!fs.existsSync(currentDir) || fs.readdirSync(currentDir).length === 0)) {
    fs.cpSync(legacyDir, currentDir, { recursive: true, force: false })
  }
} catch {
  // Ignora
}

// Aceleração por GPU (decodificação de vídeo 1080p/4K com baixo uso de CPU).
// Não chamamos app.disableHardwareAcceleration(), então a GPU fica ativa por padrão.
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('enable-accelerated-video-decode')
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,D3D11VideoDecoder')
// Define o AppUserModelId para que o Windows associe a barra de tarefas e atalhos com o ícone oficial
if (process.platform === 'win32') {
  app.setAppUserModelId('com.thiago.battv')
}

function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, '../public/icon.ico'))
    ? path.join(__dirname, '../public/icon.ico')
    : path.join(__dirname, '../public/icon.png')

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    fullscreenable: true,
    title: 'BAT TV',
    icon: iconPath,
    webPreferences: {
      // webSecurity desativado para permitir chamadas à API Xtream (CORS) e streams HLS de qualquer servidor
      webSecurity: false,
      allowRunningInsecureContent: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  // Limpa cookies residuais de IPTV para garantir que requisições sejam 100% sem estado e sem travas de sessão PHP
  win.webContents.session.clearStorageData({ storages: ['cookies'] }).catch(() => {})

  // Configura cabeçalhos de requisição: YouTube embed e streams/APIs de IPTV
  win.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const headers = details.requestHeaders || {}
      const url = details.url || ''

      if (url.includes('youtube.com') || url.includes('youtube-nocookie.com')) {
        const isNocookie = url.includes('youtube-nocookie.com')
        const targetOrigin = isNocookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com'
        headers['Referer'] = targetOrigin
        headers['Origin'] = targetOrigin
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        // Para chamadas à API Xtream e streams de vídeo (m3u8, ts, mp4, mkv),
        // envia User-Agent padrão de player IPTV para evitar bloqueios de servidores restritivos que rejeitam Electron
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTVSmarters/1.0.0'
        // Remove cookies para impedir que servidores PHP-FPM criem bloqueios de sessão persistentes
        delete headers['Cookie']
        delete headers['cookie']
      }

      callback({ cancel: false, requestHeaders: headers })
    },
  )

  // Remove políticas restritivas de CORS/CORP e remove set-cookie de servidores IPTV
  win.webContents.session.webRequest.onHeadersReceived(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const responseHeaders = Object.assign({}, details.responseHeaders)
      delete responseHeaders['cross-origin-resource-policy']
      delete responseHeaders['Cross-Origin-Resource-Policy']
      if (details.url && !details.url.includes('youtube.com')) {
        delete responseHeaders['set-cookie']
        delete responseHeaders['Set-Cookie']
      }
      callback({ responseHeaders })
    },
  )

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.setMenuBarVisibility(false)

  // F11 alterna o modo Tela Cheia nativo da janela
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      event.preventDefault()
    }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) win.loadURL(devUrl)
  else win.loadFile(path.join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null) // remove a barra de menu nativa
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ==========================================
// GERENCIADOR DE DOWNLOADS OFFLINE (PC/ELECTRON)
// ==========================================
const downloadsDir = path.join(app.getPath('userData'), 'downloads')
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true })
}

const activeDownloads = new Map()

function getDiskSpace() {
  try {
    const stats = fs.statfsSync(downloadsDir)
    return {
      freeBytes: stats.bfree * stats.bsize,
      totalBytes: stats.blocks * stats.bsize,
    }
  } catch {
    return { freeBytes: 50 * 1024 * 1024 * 1024, totalBytes: 100 * 1024 * 1024 * 1024 }
  }
}

ipcMain.handle('download:getDiskSpace', async () => getDiskSpace())

ipcMain.handle('download:start', async (event, item) => {
  const { id, url, filename } = item
  const safeFilename = (filename || `${id}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '_')
  const finalPath = path.join(downloadsDir, safeFilename)
  const tempPath = path.join(downloadsDir, `${safeFilename}.part`)

  // Checagem de segurança de espaço (1.5 GB mínimo livre)
  const space = getDiskSpace()
  if (space.freeBytes < 1.5 * 1024 * 1024 * 1024) {
    throw new Error('Espaço em disco insuficiente. Mínimo necessário: 1.5 GB livre.')
  }

  if (activeDownloads.has(id)) {
    return { alreadyActive: true }
  }

  return new Promise((resolve, reject) => {
    let receivedBytes = 0
    let totalBytes = 0
    let lastProgressTime = 0

    if (fs.existsSync(tempPath)) {
      try {
        receivedBytes = fs.statSync(tempPath).size
      } catch {
        receivedBytes = 0
      }
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTVSmarters/1.0.0',
    }
    if (receivedBytes > 0) {
      headers['Range'] = `bytes=${receivedBytes}-`
    }

    const handleReq = (reqUrl) => {
      const clientModule = reqUrl.startsWith('https:') ? https : http
      const req = clientModule.get(reqUrl, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return handleReq(res.headers.location)
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          activeDownloads.delete(id)
          const err = new Error(`Erro HTTP ${res.statusCode} ao baixar vídeo`)
          event.sender.send('download:error', { id, error: err.message })
          return reject(err)
        }

        const isRange = res.statusCode === 206
        const contentLength = parseInt(res.headers['content-length'] || '0', 10)
        totalBytes = isRange ? (receivedBytes + contentLength) : contentLength

        const fileStream = fs.createWriteStream(tempPath, { flags: isRange ? 'a' : 'w' })
        activeDownloads.set(id, { req, fileStream, tempPath, finalPath })

        res.on('data', (chunk) => {
          receivedBytes += chunk.length
          fileStream.write(chunk)

          const now = Date.now()
          if (now - lastProgressTime > 250) {
            lastProgressTime = now
            const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0
            event.sender.send('download:progress', {
              id,
              receivedBytes,
              totalBytes,
              percent,
            })
          }
        })

        res.on('end', () => {
          fileStream.end(() => {
            activeDownloads.delete(id)
            try {
              if (fs.existsSync(finalPath)) {
                fs.unlinkSync(finalPath)
              }
              fs.renameSync(tempPath, finalPath)
              const fileUrl = 'file:///' + finalPath.replace(/\\/g, '/')
              event.sender.send('download:completed', {
                id,
                localPath: finalPath,
                playUrl: fileUrl,
                totalBytes: receivedBytes,
              })
              resolve({ success: true, localPath: finalPath, playUrl: fileUrl })
            } catch (err) {
              event.sender.send('download:error', { id, error: err.message })
              reject(err)
            }
          })
        })

        res.on('error', (err) => {
          fileStream.end()
          activeDownloads.delete(id)
          event.sender.send('download:error', { id, error: err.message })
          reject(err)
        })
      })

      req.on('error', (err) => {
        activeDownloads.delete(id)
        event.sender.send('download:error', { id, error: err.message })
        reject(err)
      })
    }

    handleReq(url)
  })
})

ipcMain.handle('download:cancel', async (_event, id) => {
  const active = activeDownloads.get(id)
  if (active) {
    active.req?.destroy()
    active.fileStream?.end()
    activeDownloads.delete(id)
    try {
      if (fs.existsSync(active.tempPath)) fs.unlinkSync(active.tempPath)
    } catch {}
  }
  return { success: true }
})

ipcMain.handle('download:delete', async (_event, { id, localPath, filename }) => {
  const active = activeDownloads.get(id)
  if (active) {
    active.req?.destroy()
    active.fileStream?.end()
    activeDownloads.delete(id)
  }
  const safeFilename = (filename || `${id}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '_')
  const targetPath = localPath || path.join(downloadsDir, safeFilename)
  const tempPath = path.join(downloadsDir, `${safeFilename}.part`)

  try {
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath)
  } catch {}
  try {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  } catch {}
  return { success: true }
})

