import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2,
  Star,
  SearchX,
  SlidersHorizontal,
  ArrowDownAZ,
  Calendar,
  Sparkles,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { usePlayback } from '../context/PlaybackContext'
import MediaCard, { type CardBadge } from '../components/MediaCard'
import CategoryFilterModal from '../components/CategoryFilterModal'
import VodHeroBanner from '../components/VodHeroBanner'
import MediaDetailsModal from '../components/MediaDetailsModal'
import CarouselContainer from '../components/CarouselContainer'
import { getItems } from '../services/catalog'
import SectionHeader from '../components/SectionHeader'
import { useMediaDetails } from '../hooks/useMediaDetails'
import { cleanTitle } from '../utils/match'
import type { Category } from '../services/xtreamService'
import type { MediaItem, MediaType, Section } from '../types'

const PAGE = 48
const BADGES_SEQUENCE: CardBadge[] = ['TOP 10', 'NOVOS NO CATÁLOGO', 'MAIS CURTIDO', 'EM ALTA']

type SortOption = 'default' | 'alphabetical' | 'year' | 'rating'

interface Props {
  section: Exclude<Section, 'home' | 'sports'>
  query: string
  isActive?: boolean
  onScrollChange?: (scrolled: boolean) => void
}

function extractYear(name: string): number {
  const match = name.match(/\b(19\d\d|20\d\d)\b/)
  return match ? parseInt(match[1], 10) : 0
}

export default function Browse({ section, query, isActive = true, onScrollChange }: Props) {
  const { service } = useAuth()
  const { favorites, isFavorite, toggle } = useFavorites()
  const { play, error: playError } = usePlayback()

  const [categories, setCategories] = useState<Category[]>([])
  const [drilldownCat, setDrilldownCat] = useState<string | null>(null)
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('default')
  const [searchTab, setSearchTab] = useState<'all' | 'series' | 'movies' | 'live'>('all')
  const [showCatModal, setShowCatModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reseta o scroll para o topo sempre que entrar em uma categoria ou mudar de seção
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [drilldownCat, section])


  // Armazenamento em lote dos itens por categoria para os carrosséis da Prime Video
  const [categoryRowsData, setCategoryRowsData] = useState<Record<string, MediaItem[]>>({})
  const [loadingRows, setLoadingRows] = useState(() => section === 'movies' || section === 'series')

  // Modal de Detalhes Universal ("Mais Informações")
  const { detailItem, loadingDetail, openDetails: handleOpenDetails, closeDetails, setDetailItem } = useMediaDetails()

  // Categorias ocultadas salvas no localStorage
  const hiddenStorageKey = `iptv_hidden_cats_${section}`
  const [hiddenCatIds, setHiddenCatIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(hiddenStorageKey) || '[]')
    } catch {
      return []
    }
  })

  const isFav = section === 'favorites'
  const isVodSection = section === 'movies' || section === 'series'
  const searching = query.trim().length > 0

  const toggleHiddenCategory = (id: string) => {
    const updated = hiddenCatIds.includes(id)
      ? hiddenCatIds.filter((x) => x !== id)
      : [...hiddenCatIds, id]
    setHiddenCatIds(updated)
    try {
      localStorage.setItem(hiddenStorageKey, JSON.stringify(updated))
    } catch {}
  }

  const resetHiddenCategories = () => {
    setHiddenCatIds([])
    try {
      localStorage.removeItem(hiddenStorageKey)
    } catch {}
  }


  // 2. Carrega lista de categorias da seção
  useEffect(() => {
    setCategories([])
    setDrilldownCat(null)
    setItems([])
    setCategoryRowsData({})
    setLimit(PAGE)
    setError('')
    if (isVodSection) {
      setLoadingRows(true)
    }
    if (!service || isFav) return

    const req =
      section === 'live'
        ? service.getLiveCategories()
        : section === 'movies'
        ? service.getVodCategories()
        : service.getSeriesCategories()

    req
      .then((c) => {
        setCategories(c)
        // Se for canais ao vivo, já seleciona a primeira categoria por padrão
        if (section === 'live') {
          const visibleCats = c.filter((x) => !hiddenCatIds.includes(x.category_id))
          setDrilldownCat(visibleCats[0]?.category_id ?? 'all')
        }
      })
      .catch((e) => setError(e.message))
  }, [service, section, isFav])

  // Categorias visíveis (excluindo as ocultadas)
  const visibleCategories = useMemo(() => {
    return categories.filter((c) => !hiddenCatIds.includes(c.category_id))
  }, [categories, hiddenCatIds])

  // 3. Carrega os itens para as primeiras categorias exibidas em formato de carrossel (Prime Video)
  useEffect(() => {
    if (!service || !isVodSection || searching || drilldownCat !== null || isFav) return
    if (visibleCategories.length === 0) return

    let cancelled = false
    setLoadingRows(true)

    // Carrega as primeiras 8 categorias prioritárias para não saturar a rede do Fire Stick
    const initialCategories = visibleCategories.slice(0, 8)
    let pending = initialCategories.length
    const done = () => {
      pending -= 1
      if (!cancelled && pending <= 0) setLoadingRows(false)
    }

    initialCategories.forEach((cat) => {
      getItems(service, section as MediaType, cat.category_id)
        .then((catItems) => {
          if (cancelled || catItems.length === 0) return
          setCategoryRowsData((prev) => ({ ...prev, [cat.category_id]: catItems.slice(0, 24) }))
          setLoadingRows(false)
        })
        .catch(() => {})
        .finally(done)
    })

    return () => {
      cancelled = true
    }
  }, [service, section, isVodSection, searching, drilldownCat, visibleCategories, isFav])

  // 4. Carrega itens completos quando em modo Drill-down ("Veja mais") ou busca
  useEffect(() => {
    if (isFav || !service) return
    if (!searching && drilldownCat === null && isVodSection) return

    let cancelled = false
    setLoading(true)
    setError('')

    // Se estiver pesquisando, busca em paralelo em Séries, Filmes e TV ao vivo para achar tudo
    if (searching) {
      Promise.all([
        getItems(service, 'series', 'all').catch(() => [] as MediaItem[]),
        getItems(service, 'movies', 'all').catch(() => [] as MediaItem[]),
        getItems(service, 'live', 'all').catch(() => [] as MediaItem[]),
      ])
        .then(([sList, mList, lList]) => {
          if (!cancelled) {
            setItems([...sList, ...mList, ...lList])
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e?.message || 'Erro ao pesquisar')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    const targetCat = drilldownCat || 'all'
    getItems(service, section as MediaType, targetCat)
      .then((l) => {
        if (!cancelled) setItems(l)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [service, section, drilldownCat, searching, isVodSection, isFav])

  useEffect(() => {
    setLimit(PAGE)
  }, [query, drilldownCat, section, sortBy, searchTab])

  // 5. Ordenação e Filtro
  const visible = useMemo(() => {
    let base = isFav ? favorites : items
    const q = query.trim().toLowerCase()
    const cleanQ = cleanTitle(query)

    if (searching && searchTab !== 'all') {
      base = base.filter((i) => i.type === searchTab)
    }

    let filtered = q
      ? base.filter((i) => {
          const n = i.name.toLowerCase()
          return n.includes(q) || cleanTitle(i.name).includes(cleanQ)
        })
      : [...base]

    if (sortBy === 'alphabetical') {
      filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
    } else if (sortBy === 'year') {
      filtered.sort((a, b) => extractYear(b.name) - extractYear(a.name))
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => {
        const rA = parseFloat(a.rating || '0')
        const rB = parseFloat(b.rating || '0')
        return rB - rA
      })
    }

    return filtered
  }, [isFav, favorites, items, query, searchTab, searching, sortBy])

  const onPlay = useCallback(
    (item: MediaItem) => {
      play(item, { playlist: visible })
    },
    [play, visible]
  )

  const shown = visible.slice(0, limit)
  const activeDrilldownCatName =
    categories.find((c) => c.category_id === drilldownCat)?.category_name || 'Categoria'

  const hasHeroBanner = isVodSection && !searching && drilldownCat === null

  return (
    <div
      ref={containerRef}
      onScroll={(e) => onScrollChange?.(e.currentTarget.scrollTop > 10)}
      className={`h-full overflow-y-auto no-scrollbar bg-zinc-950 text-zinc-100 pb-24 ${
        hasHeroBanner ? '' : 'pt-16'
      }`}
    >
      {/* 1. Hero Banner Top 5 no padrão Netflix / Prime Video (Apenas para Filmes e Séries na visão inicial) */}
      {hasHeroBanner && (
        <VodHeroBanner
          type={section === 'movies' ? 'movies' : 'series'}
          onOpenDetails={setDetailItem}
          isActive={isActive}
        />
      )}

      {/* 2. Barra de Filtro Rápido ao Pesquisar */}
      {searching && (
        <div className="border-b border-white/10 shrink-0 bg-zinc-950 px-6 sm:px-10 py-3 flex items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs text-zinc-400 font-bold mr-1">Filtrar:</span>
            {(['all', 'series', 'movies', 'live'] as const).map((tab) => {
              const labels = { all: 'Todos', series: 'Séries', movies: 'Filmes', live: 'TV ao vivo' }
              const isSelected = searchTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  tabIndex={0}
                  onClick={() => setSearchTab(tab)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                      : 'bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>
          <span className="text-xs text-zinc-400 font-medium shrink-0">
            {visible.length} {visible.length === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>
      )}

      {/* 2. Barra de Categorias e Ordenação (Fluxo Natural sem sobreposição aos cards) */}
      {!isFav && !searching && (
        <div className="border-b border-white/10 shrink-0 bg-zinc-950 relative z-10">
          {/* Se estiver no modo Drilldown "Veja mais", exibe botão Voltar */}
          {drilldownCat !== null && isVodSection ? (
            <div className="flex items-center justify-between px-6 sm:px-10 py-3">
              <button
                onClick={() => setDrilldownCat(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-bold text-white transition cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Voltar para todas as categorias</span>
              </button>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                {activeDrilldownCatName}
              </h2>
            </div>
          ) : (
            /* Seletor Rápido de Categorias */
            <div className="flex items-center gap-2 overflow-x-auto px-6 sm:px-10 py-3 no-scrollbar">
              <button
                onClick={() => setShowCatModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10 transition shrink-0 cursor-pointer"
                title="Gerenciar / Ocultar Categorias"
              >
                <SlidersHorizontal size={13} />
                <span>Categorias {hiddenCatIds.length > 0 ? `(${hiddenCatIds.length} ocultas)` : ''}</span>
              </button>

              <div className="h-4 w-[1px] bg-white/10 mx-1 shrink-0" />

              {/* Botão Todas as Categorias para Filmes e Séries */}
              {isVodSection && (
                <button
                  onClick={() => setDrilldownCat(null)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition shrink-0 cursor-pointer ${
                    drilldownCat === null
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40 font-bold scale-[1.02]'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  Destaques Prime
                </button>
              )}

              {visibleCategories.map((c) => (
                <button
                  key={c.category_id}
                  onClick={() => setDrilldownCat(c.category_id)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition shrink-0 cursor-pointer ${
                    drilldownCat === c.category_id
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40 font-bold scale-[1.02]'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {c.category_name}
                </button>
              ))}
            </div>
          )}

          {/* Linha de Ordenação do Catálogo (quando em Drilldown, Busca ou Ao Vivo) */}
          {(drilldownCat !== null || !isVodSection) && (
            <div className="flex items-center justify-between px-6 sm:px-10 py-2 border-t border-white/5 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[11px] text-zinc-500 uppercase tracking-wider">
                  Ordenar por:
                </span>
                <button
                  onClick={() => setSortBy('default')}
                  className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                    sortBy === 'default'
                      ? 'bg-white/15 text-white font-bold'
                      : 'hover:text-white hover:bg-white/5'
                  }`}
                >
                  Padrão
                </button>
                <button
                  onClick={() => setSortBy('alphabetical')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                    sortBy === 'alphabetical'
                      ? 'bg-white/15 text-white font-bold'
                      : 'hover:text-white hover:bg-white/5'
                  }`}
                >
                  <ArrowDownAZ size={13} />
                  <span>Ordem Alfabética</span>
                </button>
                <button
                  onClick={() => setSortBy('year')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                    sortBy === 'year'
                      ? 'bg-white/15 text-white font-bold'
                      : 'hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Calendar size={13} />
                  <span>Por Ano</span>
                </button>
                <button
                  onClick={() => setSortBy('rating')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg transition font-medium cursor-pointer ${
                    sortBy === 'rating'
                      ? 'bg-white/15 text-white font-bold'
                      : 'hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Sparkles size={13} />
                  <span>Nota TMDB</span>
                </button>
              </div>

              <span className="text-[11px] text-zinc-500 font-medium">
                {visible.length} item(ns)
              </span>
            </div>
          )}
        </div>
      )}

      {searching && !isFav && (
        <p className="px-6 sm:px-10 py-3 text-xs font-semibold text-zinc-400 border-b border-white/10 bg-zinc-950/80">
          Buscando em todo o catálogo · {visible.length} resultado(s)
        </p>
      )}

      {/* 3. VISÃO PRIME VIDEO COM CARROSSÉIS POR CATEGORIA (quando em Filmes ou Séries sem drill-down) */}
      {isVodSection && !searching && drilldownCat === null && !isFav ? (
        <div className="px-6 sm:px-10 lg:px-14 space-y-12 pt-8 sm:pt-10">
          {(error || playError) && <p className="text-rose-400 mb-4">{error || playError}</p>}

          {loadingRows ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
              <Loader2 className="animate-spin text-rose-500 mb-3" size={32} />
              <p className="text-xs">Carregando categorias e destaques do catálogo...</p>
            </div>
          ) : (
            visibleCategories.map((cat, catIdx) => {
              const rowItems = categoryRowsData[cat.category_id] || []
              if (rowItems.length === 0) return null

              return (
                <section
                  key={cat.category_id}
                  className="space-y-4"
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 280px' } as React.CSSProperties}
                >
                  <SectionHeader
                    title={cat.category_name}
                    onAction={() => setDrilldownCat(cat.category_id)}
                  />

                  {/* Carrossel Horizontal Poster com Setinhas */}
                  <CarouselContainer className="gap-3 sm:gap-4 pb-2">
                    {rowItems.map((item, idx) => {
                      const badge = BADGES_SEQUENCE[(catIdx + idx) % BADGES_SEQUENCE.length]
                      return (
                        <div key={item.key} className="shrink-0 w-[140px] sm:w-[165px] md:w-[180px]">
                          <MediaCard
                            item={item}
                            fav={isFavorite(item.key)}
                            onPlay={() => play(item, { playlist: rowItems })}
                            onToggleFav={toggle}
                            onInfo={handleOpenDetails}
                            aspectRatio="poster"
                            badge={badge}
                          />
                        </div>
                      )
                    })}
                  </CarouselContainer>
                </section>
              )
            })
          )}
        </div>
      ) : (
        /* 4. VISÃO GRADE COMPLETA (quando em Drill-down "Veja mais", Busca, Favoritos ou Ao Vivo) */
        <div className="flex-1 p-6 sm:px-10 lg:px-14 pt-6 sm:pt-8">
          {(error || playError) && <p className="text-rose-400 mb-4">{error || playError}</p>}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 text-zinc-500">
              <Loader2 className="animate-spin text-rose-500 mb-3" size={32} />
              <p className="text-xs">Carregando catálogo...</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center mt-24 text-zinc-500 gap-3">
              {isFav ? <Star size={40} /> : <SearchX size={40} />}
              <p className="text-sm">
                {isFav && !searching
                  ? 'Você ainda não tem favoritos neste perfil. Clique na estrela ou em "+" de um título.'
                  : 'Nenhum resultado encontrado.'}
              </p>
            </div>
          ) : (
            <>
              <div
                className={
                  section === 'live'
                    ? 'grid gap-3 sm:gap-4 md:gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
                    : 'grid gap-3 sm:gap-4 md:gap-5 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'
                }
              >
                {shown.map((i, idx) => {
                  const badge = BADGES_SEQUENCE[idx % BADGES_SEQUENCE.length]
                  const cardRatio = i.type === 'live' ? 'landscape' : 'poster'
                  return (
                    <MediaCard
                      key={i.key}
                      item={i}
                      fav={isFavorite(i.key)}
                      onPlay={onPlay}
                      onToggleFav={toggle}
                      onInfo={handleOpenDetails}
                      aspectRatio={cardRatio}
                      badge={badge}
                    />
                  )
                })}
              </div>

              {visible.length > limit && (
                <button
                  onClick={() => setLimit((l) => l + PAGE)}
                  className="block mx-auto mt-10 mb-6 px-8 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer"
                >
                  Mostrar mais ({visible.length - limit})
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal de Gerenciamento / Ocultação de Categorias */}
      {showCatModal && (
        <CategoryFilterModal
          categories={categories}
          hiddenIds={hiddenCatIds}
          onToggleCategory={toggleHiddenCategory}
          onReset={resetHiddenCategories}
          onClose={() => setShowCatModal(false)}
        />
      )}

      {/* Modal de Detalhes Completo com Episódios e Recomendados ("Mais Informações") */}
      {detailItem && (
        <MediaDetailsModal
          item={detailItem}
          onClose={closeDetails}
        />
      )}

      {/* Indicador de carregamento de detalhes TMDB se necessário */}
      {loadingDetail && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <Loader2 className="animate-spin text-rose-500" size={36} />
        </div>
      )}
    </div>
  )
}
