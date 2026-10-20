const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  startDownload: (item) => ipcRenderer.invoke('download:start', item),
  pauseDownload: (id) => ipcRenderer.invoke('download:pause', id),
  resumeDownload: (id) => ipcRenderer.invoke('download:resume', id),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  deleteDownload: (id) => ipcRenderer.invoke('download:delete', id),
  getDiskSpace: () => ipcRenderer.invoke('download:getDiskSpace'),
  onDownloadProgress: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('download:progress', listener)
    return () => ipcRenderer.removeListener('download:progress', listener)
  },
  onDownloadCompleted: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('download:completed', listener)
    return () => ipcRenderer.removeListener('download:completed', listener)
  },
  onDownloadError: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('download:error', listener)
    return () => ipcRenderer.removeListener('download:error', listener)
  },
})
