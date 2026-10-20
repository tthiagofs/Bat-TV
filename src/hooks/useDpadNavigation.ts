import { useEffect } from 'react'

/**
 * useDpadNavigation
 * Motor de Navegação Espacial 2D Padrão Streaming (Netflix / Android TV).
 * - Isola modais ativos (Focus Trap) para o cursor nunca vazar para o fundo da página.
 * - Navegação direcional inteligente: Esquerda/Direita fixa na mesma linha/carrossel.
 * - Cima/Baixo salta entre trilhas/seções mantendo alinhamento lógico.
 * - Suporta teclas de voltar de Smart TVs e Android (Escape, Back, KeyCodes 27, 4, 10009).
 */

interface DpadOptions {
  /** Seletor CSS dos elementos navegáveis */
  selector?: string
  /** Contêiner de busca (padrão: document) */
  container?: HTMLElement | null
  /** Se o D-pad está habilitado neste momento */
  enabled?: boolean
  /** Callback quando o usuário pressiona "Voltar" (Back / Esc) */
  onBack?: () => void
}

export function useDpadNavigation({
  selector = 'button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"])',
  container,
  enabled = true,
  onBack,
}: DpadOptions = {}) {
  useEffect(() => {
    if (!enabled) return

    // Encontra o container ativo: se houver modal visível no topo, foca estritamente nele
    const getActiveRoot = (): HTMLElement => {
      if (container) return container
      const modals = Array.from(document.querySelectorAll<HTMLElement>('[data-tv-modal="true"]'))
      for (let i = modals.length - 1; i >= 0; i--) {
        const m = modals[i]
        const rect = m.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(m).display !== 'none') {
          return m
        }
      }
      return document.body
    }

    const getFocusables = (root: HTMLElement): HTMLElement[] => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>(selector))
      return elements.filter((el) => {
        // Ignora elementos marcados como ignorados pelo TV D-pad
        if (el.getAttribute('data-tv-ignore') === 'true' || el.getAttribute('tabindex') === '-1') return false
        const rect = el.getBoundingClientRect()
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          window.getComputedStyle(el).visibility !== 'hidden' &&
          window.getComputedStyle(el).display !== 'none'
        )
      })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Se o Player de vídeo dedicado estiver ativo na tela, ele gerencia seus próprios atalhos e botões
      if (document.querySelector('[data-tv-player="true"]')) {
        return
      }

      // Teclas de Voltar / Back do Android TV, Fire TV, Tizen e Web
      const isBackKey =
        e.key === 'Escape' ||
        e.key === 'GoBack' ||
        e.keyCode === 27 ||
        e.keyCode === 4 ||
        e.keyCode === 10009
      if (isBackKey) {
        if (onBack) {
          e.preventDefault()
          e.stopPropagation()
          onBack()
          return
        }
      }

      // Se estiver digitando em input de texto, setas horizontais movem o cursor do texto
      const activeEl = document.activeElement
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement
      if (isInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return
      }

      const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      if (!isArrow) return

      const root = getActiveRoot()
      const focusables = getFocusables(root)
      if (focusables.length === 0) return

      const current = activeEl as HTMLElement | null

      // Se nada está focado ou o elemento focado está fora do modal ativo, foca no primeiro do modal
      if (!current || !focusables.includes(current)) {
        e.preventDefault()
        focusables[0].focus()
        focusables[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        return
      }

      // 1. Caso especial: Se o elemento atual for o próprio BANNER HERO
      const isCurrentBanner = current.getAttribute('data-tv-banner') === 'true'
      if (isCurrentBanner) {
        // Setas esquerda/direita são tratadas pelo próprio banner para trocar slides
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          return
        }
        // Seta para baixo: desce para os botões de ação ("Assistir Agora")
        if (e.key === 'ArrowDown') {
          const actionBtn = current.querySelector<HTMLElement>('button:not([tabindex="-1"]):not([disabled])')
          if (actionBtn) {
            e.preventDefault()
            actionBtn.focus()
            actionBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
            return
          }
        }
      }

      // 2. Caso especial: Se estiver nos botões dentro do banner e apertar para CIMA -> volta o foco para o banner
      const parentBanner = current.closest<HTMLElement>('[data-tv-banner="true"]')
      if (parentBanner && current !== parentBanner && e.key === 'ArrowUp') {
        e.preventDefault()
        parentBanner.focus()
        parentBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        return
      }

      const currentRect = current.getBoundingClientRect()
      const currentCenterX = currentRect.left + currentRect.width / 2
      const currentCenterY = currentRect.top + currentRect.height / 2

      let bestCandidate: HTMLElement | null = null
      let minDistance = Infinity

      const isHorizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight'

      for (const el of focusables) {
        if (el === current) continue

        // Se viemos de fora do banner (ex: do cabeçalho) e estamos descendo,
        // não pulamos direto para os botões internos do banner; focamos no próprio banner
        if (!parentBanner && !isCurrentBanner && e.key === 'ArrowDown') {
          const elParentBanner = el.closest<HTMLElement>('[data-tv-banner="true"]')
          if (elParentBanner && el !== elParentBanner) {
            // Ignora o botão interno e deixa o container do banner ser o candidato
            continue
          }
        }

        const rect = el.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2

        const dx = centerX - currentCenterX
        const dy = centerY - currentCenterY

        if (isHorizontal) {
          // Movimento horizontal (esquerda / direita)
          if (e.key === 'ArrowLeft' && dx >= -5) continue
          if (e.key === 'ArrowRight' && dx <= 5) continue

          // Exige sobreposição vertical real: não permite mudar de linha com seta para o lado!
          // Isso impede que navegar pelas categorias pule para "Nota TMDB" ou para cards abaixo
          const hasVerticalOverlap = rect.top < currentRect.bottom - 4 && rect.bottom > currentRect.top + 4
          if (!hasVerticalOverlap) continue

          const distance = Math.abs(dx) + Math.abs(dy) * 2

          if (distance < minDistance) {
            minDistance = distance
            bestCandidate = el
          }
        } else {
          // Movimento vertical (cima / baixo)
          if (e.key === 'ArrowUp' && dy >= -5) continue
          if (e.key === 'ArrowDown' && dy <= 5) continue

          const isHeaderEl = !!el.closest('header')
          const isBanner = el.getAttribute('data-tv-banner') === 'true'

          // Descobre se o container de scroll do elemento atual está rolado para baixo
          let scrollParent: HTMLElement | null = current.parentElement
          while (scrollParent && scrollParent !== document.body) {
            const style = window.getComputedStyle(scrollParent)
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') break
            scrollParent = scrollParent.parentElement
          }
          const isScrolledDown = scrollParent ? scrollParent.scrollTop > 30 : window.scrollY > 30

          // Se estivermos subindo:
          // JAMAIS permite ir para o cabeçalho se a página ou lista estiver rolada para baixo!
          // O usuário deve subir linha por linha até chegar no banner ou topo da lista.
          if (isHeaderEl && e.key === 'ArrowUp') {
            if (isScrolledDown || (!isCurrentBanner && currentRect.top >= 130)) {
              continue
            }
          }

          // Para elementos grandes como Banner, a borda inferior/superior é o referencial mais natural
          const effDy = isBanner && e.key === 'ArrowDown'
            ? Math.max(1, rect.top - currentRect.bottom)
            : Math.abs(dy)

          // Distância: prioriza fortemente a linha mais próxima verticalmente
          const headerPenalty = isHeaderEl ? 1000 : 0
          const distance = effDy * 2.5 + Math.abs(dx) * 1.0 + headerPenalty

          if (distance < minDistance) {
            minDistance = distance
            bestCandidate = el
          }
        }
      }

      if (bestCandidate) {
        e.preventDefault()
        bestCandidate.focus()
        bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [selector, container, enabled, onBack])
}

