import { useState, useEffect } from 'react'
import { Star, Play, Info, Loader2, Flame } from 'lucide-react'
import { STREAMING_PROVIDERS, getTop10ByProvider, type TmdbItem, type StreamingProvider } from '../services/tmdbService'
import { getProviderLogoComponent } from './StreamingLogos'
import { useAuth } from '../context/AuthContext'
import { usePlayback } from '../context/PlaybackContext'
import { searchTitleInCatalog } from '../services/catalog'
import MediaDetailsModal from './MediaDetailsModal'
import CarouselContainer from './CarouselContainer'

export default function TopStreamingSection() {
  const { service } = useAuth()
  const { play } = usePlayback()

  const [activeProvider, setActiveProvider] = useState<StreamingProvider>(STREAMING_PROVIDERS[0])
  const [items, setItems] = useState<TmdbItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDetails, setSelectedDetails] = useState<TmdbItem | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [failedId, setFailedId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    getTop10ByProvider(activeProvider.id)
      .then((res) => {
        if (active) setItems(res)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [activeProvider])

  const handlePlayTitle = async (item: TmdbItem) => {
    if (!service) return
    setPlayingId(item.id)
    setFailedId(null)

    try {
      const type = item.mediaType === 'movie' ? 'movies' : 'series'
      const found = await searchTitleInCatalog(service, type, item)

      if (found) {
        play(found)
      } else {
        setFailedId(item.id)
        setTimeout(() => setFailedId(null), 3000)
      }
    } catch {
      setFailedId(item.id)
    } finally {
      setPlayingId(null)
    }
  }

  return (
    <>
      <section className="space-y-4 fade-up">
        {/* Cabeçalho com Abas dos Streamings */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600/20 text-rose-500 border border-rose-500/30">
              <Flame size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 leading-tight">Top 10 Mais Assistidos no Brasil</h2>
              <p className="text-xs text-zinc-400">Atualizado diariamente por plataforma de streaming</p>
            </div>
          </div>

          {/* Seletor de Streamings com Logos Oficiais em SVG */}
          <div className="flex gap-2 bg-zinc-950/90 p-1.5 rounded-2xl border border-zinc-800 shadow-lg overflow-x-auto no-scrollbar max-w-full">
            {STREAMING_PROVIDERS.map((prov) => {
              const isSel = prov.id === activeProvider.id
              const LogoComp = getProviderLogoComponent(prov.id)
              return (
                <button
                  key={prov.id}
                  onClick={() => setActiveProvider(prov)}
                  className={`flex items-center justify-center px-4 py-2 rounded-xl transition cursor-pointer ${
                    isSel
                      ? 'bg-zinc-800 text-white shadow-md border border-zinc-700 ring-1 ring-zinc-500 scale-[1.04]'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 hover:scale-[1.02]'
                  }`}
                  title={prov.name}
                >
                  <LogoComp />
                </button>
              )
            })}
          </div>
        </div>

        {/* Grade / Linha Horizontal do Top 10 */}
        {loading ? (
          <div className="h-64 rounded-3xl bg-zinc-950/40 border border-zinc-800/80 flex items-center justify-center">
            <Loader2 className="animate-spin text-rose-500" size={28} />
          </div>
        ) : (
          <CarouselContainer className="gap-6 pt-3 pb-5">
            {items.map((it, idx) => {
              const isPlaying = playingId === it.id
              const isFailed = failedId === it.id

              return (
                <div key={it.id} className="shrink-0 flex items-end group select-none relative">
                  {/* Número Gigante Estilo Netflix (1 ao 10) */}
                  <span
                    className="font-black text-7xl sm:text-8xl leading-none text-zinc-800 select-none -mr-4 z-0 group-hover:text-rose-600/40 transition-colors"
                    style={{
                      WebkitTextStroke: '2px #3f3f46',
                    }}
                  >
                    {idx + 1}
                  </span>

                  {/* Cartão do Pôster com Foco TV */}
                  <div
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalhes de ${it.title}`}
                    onClick={() => setSelectedDetails(it)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedDetails(it)
                      }
                    }}
                    className="relative w-[150px] sm:w-[170px] aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 group-hover:border-rose-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-rose-950/40 focus-visible:border-white focus-visible:scale-105 focus-visible:ring-4 focus-visible:ring-rose-500 focus-visible:outline-none transition duration-200 z-10 cursor-pointer"
                  >
                    {it.posterPath ? (
                      <img
                        src={it.posterPath}
                        alt={it.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs font-semibold text-zinc-500">
                        {it.title}
                      </div>
                    )}

                    {/* Overlay de Ação no Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity p-3 flex flex-col justify-end gap-2 pointer-events-none">
                      <p className="text-xs font-bold text-white line-clamp-2 leading-tight">
                        {it.title}
                      </p>

                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-bold">
                        <Star size={12} className="fill-amber-400" />
                        <span>{it.voteAverage}</span>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          tabIndex={-1}
                          data-tv-ignore="true"
                          disabled={isPlaying}
                          onClick={() => handlePlayTitle(it)}
                          className="flex-1 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow transition cursor-pointer"
                          title="Assistir na Lista IPTV"
                        >
                          {isPlaying ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Play size={12} className="fill-white" />
                          )}
                          <span>Ver</span>
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          data-tv-ignore="true"
                          onClick={() => setSelectedDetails(it)}
                          className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition cursor-pointer"
                          title="Sinopse e Trailer"
                        >
                          <Info size={14} />
                        </button>
                      </div>

                      {isFailed && (
                        <span className="text-[10px] text-rose-400 font-bold text-center">
                          Não encontrado na lista
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </CarouselContainer>
        )}
      </section>

      {selectedDetails && (
        <MediaDetailsModal
          item={selectedDetails}
          onClose={() => setSelectedDetails(null)}
        />
      )}
    </>
  )
}
