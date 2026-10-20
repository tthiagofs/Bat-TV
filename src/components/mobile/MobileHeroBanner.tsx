import { useState, useEffect, useRef } from 'react'
import { Play, Plus, Check, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import { TMDB_IMAGE_ORIGINAL, TMDB_IMAGE_W500, type TmdbItem } from '../../services/tmdbService'
import { useFavorites } from '../../context/FavoritesContext'

interface Props {
  items: TmdbItem[]
  onOpenDetails: (item: TmdbItem) => void
  onPlay: (item: TmdbItem) => void
}

export default function MobileHeroBanner({ items, onOpenDetails, onPlay }: Props) {
  const [index, setIndex] = useState(0)
  const { isFavorite, toggle } = useFavorites()

  // Controle de Swipe por Toque na Tela (Mobile Touch)
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)

  const current = items[index] || items[0]

  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length)
    }, 9000)
    return () => clearInterval(timer)
  }, [items.length])

  if (!current) return null

  const posterUrl = current.posterPath
    ? `${TMDB_IMAGE_W500}${current.posterPath}`
    : current.backdropPath
    ? `${TMDB_IMAGE_ORIGINAL}${current.backdropPath}`
    : ''

  const isFav = current.mediaItem ? isFavorite(current.mediaItem.key) : false

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
    touchEndX.current = null
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return
    const diff = touchStartX.current - touchEndX.current
    if (diff > 45) {
      // Arrastou para a esquerda -> próximo
      setIndex((prev) => (prev + 1) % items.length)
    } else if (diff < -45) {
      // Arrastou para a direita -> anterior
      setIndex((prev) => (prev - 1 + items.length) % items.length)
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full aspect-[3/4] max-h-[72vh] overflow-hidden select-none bg-zinc-950 touch-pan-y"
    >
      {/* Imagem do Poster Vertical de Alta Resolução com transição suave */}
      {posterUrl && (
        <img
          key={current.id}
          src={posterUrl}
          alt={current.title}
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-95 fade-up"
        />
      )}

      {/* Gradientes de Fusão Superior e Inferior estilo Netflix Mobile */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/60 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none" />

      {/* Botões Laterais Translúcidos de Navegação (Toque Fácil) */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIndex((prev) => (prev - 1 + items.length) % items.length)
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 text-white/80 active:scale-90 transition backdrop-blur-sm cursor-pointer touch-manipulation"
            aria-label="Banner anterior"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIndex((prev) => (prev + 1) % items.length)
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 text-white/80 active:scale-90 transition backdrop-blur-sm cursor-pointer touch-manipulation"
            aria-label="Próximo banner"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Conteúdo e Ações no Rodapé do Banner */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 flex flex-col items-center text-center z-10 space-y-3">
        {/* Selo Top 10 / Destaque */}
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-rose-600/90 text-white text-[10px] font-black uppercase tracking-wider">
            {current.mediaType === 'tv' ? 'Série' : 'Filme'}
          </span>
          <span className="text-[11px] font-bold text-zinc-300">
            Top 10 no Brasil
          </span>
        </div>

        {/* Título do Filme / Série */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase line-clamp-2 drop-shadow-md">
          {current.title}
        </h1>

        {/* Gêneros / Metadados */}
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-zinc-300">
          <span>{current.releaseDate ? current.releaseDate.slice(0, 4) : '2024'}</span>
          <span>•</span>
          <span>Nota {(current.voteAverage || 8.0).toFixed(1)}</span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">HD</span>
        </div>

        {/* Botões de Ação estilo Netflix Mobile */}
        <div className="flex items-center justify-center gap-3 w-full max-w-xs pt-1">
          {/* Botão Assistir */}
          <button
            onClick={() => onPlay(current)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white text-zinc-950 font-black text-sm active:scale-95 transition shadow-lg cursor-pointer touch-manipulation"
          >
            <Play size={18} className="fill-zinc-950" />
            <span>Assistir</span>
          </button>

          {/* Botão Minha Lista */}
          <button
            onClick={() => {
              if (current.mediaItem) toggle(current.mediaItem)
              else onOpenDetails(current)
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-800/90 text-white border border-white/20 font-bold text-sm active:scale-95 transition cursor-pointer touch-manipulation"
          >
            {isFav ? <Check size={18} className="text-emerald-400" /> : <Plus size={18} />}
            <span>Minha Lista</span>
          </button>

          {/* Botão Saiba Mais */}
          <button
            onClick={() => onOpenDetails(current)}
            className="p-2.5 rounded-xl bg-zinc-800/90 text-white border border-white/20 active:scale-95 transition cursor-pointer touch-manipulation"
            aria-label="Mais informações"
          >
            <Info size={18} />
          </button>
        </div>

        {/* Indicador de Bolinhas do Banner (Clicáveis) */}
        <div className="flex items-center gap-1.5 pt-1">
          {items.slice(0, 8).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer touch-manipulation ${
                i === index ? 'w-4 bg-rose-500' : 'w-1.5 bg-zinc-600'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
