import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Modo Leve (sem blur de fundo): ligado por padrão; desligue com localStorage['iptv-rea:lite']='0'
if (localStorage.getItem('iptv-rea:lite') !== '0') document.documentElement.classList.add('lite')

// Detecta dispositivos Apple (iPhone, iPad, iPod)
const isAppleDevice = typeof window !== 'undefined' && (
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
)

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (isAppleDevice) {
    // No iOS (iPhone/iPad), o daemon de mídia mediaserverd da Apple possui um bug crítico
    // no WebKit que trava requisições de streaming de vídeo em carregamento infinito
    // caso haja um Service Worker registrado na origem (especialmente na Tela de Início / PWA).
    // Para garantir streaming nativo e instantâneo, desregistramos qualquer Service Worker existente no iOS
    // e limpamos os caches legados.
    navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      let hadWorker = false
      for (const reg of registrations) {
        await reg.unregister()
        hadWorker = true
      }
      if ('caches' in window) {
        try {
          const keys = await caches.keys()
          for (const key of keys) {
            if (key.startsWith('bat-tv-pwa-')) {
              await caches.delete(key)
            }
          }
        } catch {}
      }
      if (hadWorker && navigator.serviceWorker.controller) {
        window.location.reload()
      }
    }).catch(() => {})
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update().catch(() => {})
        })
        .catch((err) => {
          console.warn('ServiceWorker registration error:', err)
        })
    })

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

