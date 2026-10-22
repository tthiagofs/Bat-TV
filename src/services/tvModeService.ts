export type TvPerformanceSetting = 'auto' | 'on' | 'off'

declare global {
  interface Window {
    __IS_ANDROID_TV__?: boolean
    __applyTvPerformanceMode?: (isTv?: boolean) => void
  }
}

const STORAGE_KEY = 'iptv-rea:tv-perf-setting'

/**
 * Detecta se o dispositivo atual é uma TV (Fire Stick, TCL Android TV, etc.)
 * ou se foi forçado via URL parameter para testes no PC (?tv_mode=1 ou ?tv_mode=true).
 */
export function isHardwareTvDetected(): boolean {
  if (typeof window === 'undefined') return false

  const search = window.location.search.toLowerCase()
  if (search.includes('tv_mode=0') || search.includes('tv_mode=false')) {
    return false
  }
  if (search.includes('tv_mode=1') || search.includes('tv_mode=true') || search.includes('perf=tv')) {
    return true
  }

  // Injetado pelo Android nativo (MainActivity.java via UiModeManager / Leanback)
  if (window.__IS_ANDROID_TV__ === true) return true

  // UserAgent de TVs conhecidas (Amazon Fire TV, TCL, AndroidTV, etc.)
  const ua = window.navigator.userAgent.toLowerCase()
  const tvKeywords = [
    'aft', // Amazon Fire TV (AFTMM, AFTSS, AFTT, etc.)
    'firetv',
    'androidtv',
    'google tv',
    'smart-tv',
    'smarttv',
    'tcl',
    'bravia',
    'apple tv',
    'webos',
    'tizen',
    'pov_tv',
  ]

  return tvKeywords.some((kw) => ua.includes(kw))
}

export function getTvPerformanceSetting(): TvPerformanceSetting {
  if (typeof window === 'undefined') return 'auto'
  try {
    const val = localStorage.getItem(STORAGE_KEY) as TvPerformanceSetting
    if (val === 'on' || val === 'off' || val === 'auto') return val
  } catch {}
  return 'auto'
}

export function setTvPerformanceSetting(setting: TvPerformanceSetting): void {
  try {
    localStorage.setItem(STORAGE_KEY, setting)
  } catch {}
  applyTvPerformanceMode()
}

export function isTvPerformanceActive(): boolean {
  if (typeof window !== 'undefined') {
    const search = window.location.search.toLowerCase()
    if (search.includes('tv_mode=1') || search.includes('tv_mode=true') || search.includes('perf=tv')) {
      return true
    }
    if (search.includes('tv_mode=0') || search.includes('tv_mode=false')) {
      return false
    }
  }

  const setting = getTvPerformanceSetting()
  if (setting === 'on') return true
  if (setting === 'off') return false
  return isHardwareTvDetected()
}

export function applyTvPerformanceMode(explicitTv?: boolean): void {
  if (typeof document === 'undefined') return

  if (explicitTv !== undefined && typeof window !== 'undefined') {
    window.__IS_ANDROID_TV__ = explicitTv
  }

  const active = isTvPerformanceActive()
  const root = document.documentElement

  if (active) {
    root.classList.add('tv-perf-mode')
    root.classList.add('lite')
  } else {
    root.classList.remove('tv-perf-mode')
    // Se o usuário desativou TV perf mode e não marcou liteMode manualmente
    if (localStorage.getItem('iptv-rea:lite') !== '1') {
      root.classList.remove('lite')
    }
  }

  window.dispatchEvent(new CustomEvent('tvPerfModeChanged', { detail: { active } }))
}

// Inicializa no carregamento do script
if (typeof window !== 'undefined') {
  window.__applyTvPerformanceMode = (isTv?: boolean) => {
    applyTvPerformanceMode(isTv)
  }
  // Aplica imediatamente ao carregar
  setTimeout(() => applyTvPerformanceMode(), 0)
}
