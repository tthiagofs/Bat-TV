import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Modo Leve (sem blur de fundo): ligado por padrão; desligue com localStorage['iptv-rea:lite']='0'
if (localStorage.getItem('iptv-rea:lite') !== '0') document.documentElement.classList.add('lite')

// Registro do Service Worker para PWA e funcionamento offline no iPhone, Android e PC
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('ServiceWorker registration error:', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

