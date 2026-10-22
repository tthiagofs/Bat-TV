import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './services/tvModeService'
import App from './App'


// Gerenciamento dinâmico de performance realizado por ./services/tvModeService

// Registro do Service Worker para PWA (sem loops de reload)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

