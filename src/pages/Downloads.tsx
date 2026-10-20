import { useState, useMemo } from 'react'
import {
  Download,
  Trash2,
  Play,
  Film,
  Tv,
  HardDrive,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  Loader2,
  WifiOff,
  ArrowLeft,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { useDownloads } from '../hooks/useDownloads'
import { usePlayback } from '../context/PlaybackContext'
import type { DownloadedMedia } from '../services/downloadDb'
import type { Section } from '../types'

interface Props {
  onNavigate?: (section: Section) => void
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 * 1024)
  return `${Math.round(mb)} MB`
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

export default function Downloads({ onNavigate }: Props) {
  const { downloads, storage, loading, cancel, remove } = useDownloads()
  const { playLocalMedia } = usePlayback()

  const [selectedSeriesName, setSelectedSeriesName] = useState<string | null>(null)
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<number | 'all'>('all')

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

  const activeDownloads = useMemo(() => {
    return downloads.filter((d) => d.status === 'downloading' || d.status === 'queued')
  }, [downloads])

  const completedDownloads = useMemo(() => {
    return downloads.filter((d) => d.status === 'completed')
  }, [downloads])

  const movies = useMemo(() => {
    return completedDownloads.filter((d) => d.mediaType === 'movie')
  }, [completedDownloads])

  const seriesEpisodes = useMemo(() => {
    return completedDownloads.filter((d) => d.mediaType === 'series')
  }, [completedDownloads])

  // Agrupa episódios por nome da série
  const seriesGrouped = useMemo(() => {
    const groups: Record<string, DownloadedMedia[]> = {}
    seriesEpisodes.forEach((ep) => {
      const name = ep.seriesName || ep.title
      if (!groups[name]) groups[name] = []
      groups[name].push(ep)
    })
    return groups
  }, [seriesEpisodes])

  // Se a série aberta não tiver mais episódios, volta para a tela principal
  const currentSeriesEpisodes = useMemo(() => {
    if (!selectedSeriesName) return []
    return seriesGrouped[selectedSeriesName] || []
  }, [selectedSeriesName, seriesGrouped])

  // Se todos os episódios da série aberta foram apagados, fecha a visualização da série
  if (selectedSeriesName && currentSeriesEpisodes.length === 0) {
    setSelectedSeriesName(null)
  }

  // Agrupa episódios da série selecionada por Temporada
  const seasonsOfSelectedSeries = useMemo(() => {
    const seasonsMap: Record<number, DownloadedMedia[]> = {}
    currentSeriesEpisodes.forEach((ep) => {
      const sNum = ep.seasonNumber || 1
      if (!seasonsMap[sNum]) seasonsMap[sNum] = []
      seasonsMap[sNum].push(ep)
    })
    // Ordena episódios dentro de cada temporada
    Object.keys(seasonsMap).forEach((sKey) => {
      seasonsMap[Number(sKey)].sort((a, b) => (a.episodeNumber || 1) - (b.episodeNumber || 1))
    })
    return seasonsMap
  }, [currentSeriesEpisodes])

  const availableSeasonNumbers = useMemo(() => {
    return Object.keys(seasonsOfSelectedSeries).map(Number).sort((a, b) => a - b)
  }, [seasonsOfSelectedSeries])

  const handlePlay = (item: DownloadedMedia) => {
    if (!item.playUrl) return
    playLocalMedia({
      id: item.id,
      title: item.subtitle ? `${item.seriesName || item.title} - ${item.subtitle}` : item.title,
      url: item.playUrl,
      poster: item.posterUrl,
    })
  }

  const handleDeleteAllSeriesEpisodes = async (seriesName: string) => {
    const eps = seriesGrouped[seriesName] || []
    if (confirm(`Deseja excluir todos os ${eps.length} episódios baixados de "${seriesName}"?`)) {
      for (const ep of eps) {
        await remove(ep.id)
      }
      setSelectedSeriesName(null)
    }
  }

  const freeGb = storage.freeBytes / (1024 * 1024 * 1024)
  const isStorageLow = freeGb < 2.0 && storage.totalBytes > 0

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full space-y-8 select-none">
      {/* Banner de Status Offline */}
      {isOffline && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-300">
          <WifiOff size={22} className="shrink-0 text-amber-400" />
          <div className="text-xs">
            <p className="font-bold">Modo Offline Ativo</p>
            <p className="text-amber-200/80">
              Você está desconectado da internet. Seus títulos baixados estão 100% disponíveis para assistir agora.
            </p>
          </div>
        </div>
      )}

      {/* Topo: Título e Gerenciador de Armazenamento */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/60 border border-white/5 rounded-3xl p-5 sm:p-6 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-600/20 text-rose-500 border border-rose-500/30">
              <Download size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                Downloads Offline
              </h1>
              <p className="text-xs text-zinc-400">
                Assista seus filmes e episódios favoritos sem precisar de internet
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Armazenamento do Aparelho */}
        <div className="bg-zinc-950/70 border border-white/10 rounded-2xl p-4 min-w-[280px] sm:min-w-[340px] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
              <HardDrive size={14} className="text-rose-400" />
              Armazenamento
            </span>
            <span className="text-zinc-300 font-bold">
              {formatBytes(storage.freeBytes)} livres
            </span>
          </div>

          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
            <div
              style={{
                width: `${Math.min(
                  100,
                  storage.totalBytes > 0
                    ? (storage.usedByAppBytes / storage.totalBytes) * 100
                    : 5
                )}%`,
              }}
              className="bg-rose-500 transition-all duration-500"
              title="Espaço ocupado pelo BAT TV"
            />
            <div
              style={{
                width: `${Math.max(
                  0,
                  storage.totalBytes > 0
                    ? ((storage.totalBytes - storage.freeBytes - storage.usedByAppBytes) / storage.totalBytes) * 100
                    : 20
                )}%`,
              }}
              className="bg-zinc-700"
              title="Outros apps do aparelho"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500">
            <span>Usado pelo BAT TV: {formatBytes(storage.usedByAppBytes)}</span>
            <span>Total: {formatBytes(storage.totalBytes)}</span>
          </div>

          {isStorageLow && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 pt-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>Pouco espaço livre. Exclua títulos após assistir.</span>
            </div>
          )}
        </div>
      </div>

      {/* Downloads em Andamento (Fila Ativa) */}
      {activeDownloads.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <Loader2 size={15} className="animate-spin text-rose-500" />
            Baixando Agora ({activeDownloads.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeDownloads.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-zinc-900/80 border border-rose-500/30 rounded-2xl p-3 relative overflow-hidden"
              >
                <div className="w-14 h-20 bg-zinc-800 rounded-xl overflow-hidden shrink-0 relative">
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      {item.mediaType === 'movie' ? <Film size={18} /> : <Tv size={18} />}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-xs font-bold text-white truncate">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-[11px] text-zinc-400 truncate">{item.subtitle}</p>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span>{item.status === 'queued' ? 'Aguardando fila...' : `${item.progress}%`}</span>
                      <span>
                        {item.totalBytes > 0
                          ? `${formatBytes(item.downloadedBytes)} / ${formatBytes(item.totalBytes)}`
                          : ''}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${item.progress}%` }}
                        className="h-full bg-rose-500 transition-all duration-300 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => cancel(item.id)}
                  className="p-2 text-zinc-500 hover:text-rose-400 transition cursor-pointer rounded-full hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  title="Cancelar download"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Estado Vazio: Nenhum download concluído */}
      {completedDownloads.length === 0 && activeDownloads.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
            <Download size={36} />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-lg font-bold text-zinc-200">Nenhum título baixado ainda</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Você pode baixar filmes e episódios de séries para assistir quando estiver sem internet.
              Basta clicar no botão de download na tela de detalhes de qualquer título.
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              tabIndex={0}
              onClick={() => onNavigate('movies')}
              className="mt-2 px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500/50"
            >
              Explorar Catálogo
            </button>
          )}
        </div>
      )}

      {/* CASO A: VISUALIZAÇÃO INTERNA DE UMA SÉRIE SELECIONADA */}
      {selectedSeriesName && (
        <section className="space-y-6 animate-fadeIn">
          {/* Barra Superior da Série: Botão Voltar, Título e Excluir Todos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 border border-white/5 p-4 sm:p-5 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                tabIndex={0}
                onClick={() => setSelectedSeriesName(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold transition cursor-pointer focus:outline-none focus:ring-4 focus:ring-rose-500"
              >
                <ArrowLeft size={16} />
                <span>Voltar para Todos os Downloads</span>
              </button>
              <div className="h-6 w-[1px] bg-white/10" />
              <div>
                <h2 className="text-lg font-black text-white">{selectedSeriesName}</h2>
                <p className="text-xs text-zinc-400">
                  {currentSeriesEpisodes.length} {currentSeriesEpisodes.length === 1 ? 'episódio' : 'episódios'} •{' '}
                  {formatBytes(currentSeriesEpisodes.reduce((acc, ep) => acc + (ep.totalBytes || 0), 0))}
                </p>
              </div>
            </div>

            <button
              type="button"
              tabIndex={0}
              onClick={() => handleDeleteAllSeriesEpisodes(selectedSeriesName)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition cursor-pointer self-start sm:self-auto focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <Trash2 size={14} />
              <span>Excluir Série Completa</span>
            </button>
          </div>

          {/* Abas de Temporadas (Se houver mais de uma temporada baixada) */}
          {availableSeasonNumbers.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              <button
                type="button"
                tabIndex={0}
                onClick={() => setSelectedSeasonFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                  selectedSeasonFilter === 'all'
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                Todas as Temporadas ({currentSeriesEpisodes.length})
              </button>
              {availableSeasonNumbers.map((sNum) => {
                const count = seasonsOfSelectedSeries[sNum]?.length || 0
                const isSelected = selectedSeasonFilter === sNum
                return (
                  <button
                    key={sNum}
                    type="button"
                    tabIndex={0}
                    onClick={() => setSelectedSeasonFilter(sNum)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                      isSelected
                        ? 'bg-rose-600 text-white shadow'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10'
                    }`}
                  >
                    Temporada {sNum} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Lista de Episódios Organizados por Temporada */}
          <div className="space-y-6">
            {availableSeasonNumbers
              .filter((sNum) => selectedSeasonFilter === 'all' || selectedSeasonFilter === sNum)
              .map((sNum) => {
                const seasonEps = seasonsOfSelectedSeries[sNum] || []
                return (
                  <div key={sNum} className="space-y-3">
                    <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                      <Layers size={15} className="text-rose-500" />
                      Temporada {sNum} ({seasonEps.length} {seasonEps.length === 1 ? 'episódio' : 'episódios'})
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {seasonEps.map((ep) => (
                        <div
                          key={ep.id}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePlay(ep)
                          }}
                          className="flex items-center justify-between gap-3 bg-zinc-950/60 border border-white/5 rounded-2xl p-3.5 hover:border-rose-500/40 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500 transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => handlePlay(ep)}
                              className="w-9 h-9 rounded-full bg-rose-600/20 text-rose-500 group-hover:bg-rose-600 group-hover:text-white transition flex items-center justify-center shrink-0 cursor-pointer shadow"
                            >
                              <Play size={14} className="ml-0.5 fill-current" />
                            </button>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-200 truncate group-hover:text-rose-400 transition">
                                {ep.subtitle || `Episódio ${ep.episodeNumber || 1}`}
                              </p>
                              <p className="text-[10px] text-zinc-500 pt-0.5">
                                {ep.duration > 0 && `${formatDuration(ep.duration)} • `}
                                {formatBytes(ep.totalBytes)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              tabIndex={0}
                              onClick={() => handlePlay(ep)}
                              className="text-xs font-bold text-rose-500 hover:text-rose-400 px-2 py-1 rounded hover:bg-white/5 transition cursor-pointer"
                            >
                              Assistir
                            </button>
                            <button
                              type="button"
                              tabIndex={0}
                              onClick={() => remove(ep.id)}
                              className="text-zinc-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500"
                              title="Excluir episódio"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      )}

      {/* CASO B: VISUALIZAÇÃO PRINCIPAL (FILMES + SÉRIES AGRUPADAS EM CARDS) */}
      {!selectedSeriesName && (
        <>
          {/* Seção 1: Filmes Baixados */}
          {movies.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Film size={18} className="text-rose-500" />
                  Filmes Baixados ({movies.length})
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {movies.map((item) => (
                  <div
                    key={item.id}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePlay(item)
                    }}
                    className="group relative bg-zinc-900/70 border border-white/5 rounded-2xl overflow-hidden hover:border-rose-500/50 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/50 transition cursor-pointer flex flex-col"
                  >
                    <div className="aspect-[2/3] w-full bg-zinc-800 relative overflow-hidden">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          <Film size={32} />
                        </div>
                      )}

                      <div
                        onClick={() => handlePlay(item)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition flex items-center justify-center"
                      >
                        <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition">
                          <Play size={20} className="ml-1 fill-white" />
                        </div>
                      </div>

                      <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center gap-1 text-[10px] text-emerald-400 font-bold border border-emerald-500/30">
                        <CheckCircle2 size={10} />
                        Offline
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h3 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-rose-400 transition">
                          {item.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 pt-0.5">
                          {item.duration > 0 && <span>{formatDuration(item.duration)}</span>}
                          <span>•</span>
                          <span>{formatBytes(item.totalBytes)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <button
                          type="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePlay(item)
                          }}
                          className="text-xs font-bold text-rose-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer focus:outline-none focus:underline"
                        >
                          <Play size={12} className="fill-current" />
                          Assistir
                        </button>

                        <button
                          type="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            remove(item.id)
                          }}
                          className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500"
                          title="Excluir arquivo do aparelho"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Seção 2: Séries Baixadas (Agrupadas por Série em Cards Elegantes) */}
          {Object.keys(seriesGrouped).length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Tv size={18} className="text-rose-500" />
                  Séries Baixadas ({Object.keys(seriesGrouped).length} {Object.keys(seriesGrouped).length === 1 ? 'série' : 'séries'})
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Object.entries(seriesGrouped).map(([seriesName, episodes]) => {
                  const firstEp = episodes[0]
                  const totalSeriesBytes = episodes.reduce((acc, ep) => acc + (ep.totalBytes || 0), 0)

                  return (
                    <div
                      key={seriesName}
                      tabIndex={0}
                      onClick={() => setSelectedSeriesName(seriesName)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setSelectedSeriesName(seriesName)
                      }}
                      className="group relative bg-zinc-900/70 border border-white/5 rounded-2xl overflow-hidden hover:border-rose-500/50 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/50 transition cursor-pointer flex flex-col"
                    >
                      {/* Pôster da Série com Badge de Contagem */}
                      <div className="aspect-[2/3] w-full bg-zinc-800 relative overflow-hidden">
                        {firstEp.posterUrl ? (
                          <img
                            src={firstEp.posterUrl}
                            alt={seriesName}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                            <Tv size={32} />
                          </div>
                        )}

                        {/* Overlay no hover/focus */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition flex items-center justify-center">
                          <div className="px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center gap-1 shadow-xl">
                            <span>Ver Episódios</span>
                            <ChevronRight size={14} />
                          </div>
                        </div>

                        {/* Badge de Quantidade de Episódios Baixados */}
                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md rounded-full px-2 py-0.5 flex items-center gap-1 text-[10px] text-white font-bold border border-white/20">
                          <Layers size={10} className="text-rose-400" />
                          <span>{episodes.length} {episodes.length === 1 ? 'ep' : 'eps'}</span>
                        </div>
                      </div>

                      {/* Informações da Série */}
                      <div className="p-3 flex-1 flex flex-col justify-between space-y-1">
                        <div>
                          <h3 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-rose-400 transition">
                            {seriesName}
                          </h3>
                          <p className="text-[10px] text-zinc-400 pt-0.5">
                            {episodes.length} {episodes.length === 1 ? 'episódio baixado' : 'episódios baixados'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-zinc-500">
                          <span>{formatBytes(totalSeriesBytes)}</span>
                          <span className="text-rose-500 font-bold group-hover:underline flex items-center gap-0.5">
                            Abrir <ChevronRight size={10} />
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
