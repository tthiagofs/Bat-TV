import { useEffect, useState, useMemo } from 'react'
import { Star, Clock, Film, Clapperboard, Tv } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfiles } from '../context/ProfileContext'
import { useFavorites } from '../context/FavoritesContext'
import { usePlayback } from '../context/PlaybackContext'
import { getPreviewItems, getRecommendedItems, getPersonalizedItems } from '../services/catalog'
import type { MediaItem, Section } from '../types'
import MediaCard, { type CardBadge } from '../components/MediaCard'
import HeroCarousel from '../components/HeroCarousel'
import TopStreamingSection from '../components/TopStreamingSection'
import CarouselContainer from '../components/CarouselContainer'
import MediaDetailsModal from '../components/MediaDetailsModal'
import SectionHeader from '../components/SectionHeader'
import { useMediaDetails } from '../hooks/useMediaDetails'
import { Sparkles } from 'lucide-react'

interface Props {
  onNavigate: (section: Section) => void
  onScrollChange?: (scrolled: boolean) => void
  isActive?: boolean
}

const BADGES_SEQUENCE: CardBadge[] = ['EM ALTA', 'NOVOS NO CATÁLOGO', 'MAIS CURTIDO', 'TOP 10']
const CARD_WRAP = 'shrink-0 w-[240px] sm:w-[280px]'
const ICON = 'text-rose-500'

export default function Home({ onNavigate, onScrollChange, isActive = true }: Props) {
  const { service } = useAuth()
  const { active } = useProfiles()
  const { isFavorite, toggle } = useFavorites()
  const { play } = usePlayback()
  const { detailItem, openDetails, closeDetails } = useMediaDetails()

  const [movies, setMovies] = useState<MediaItem[]>([])
  const [series, setSeries] = useState<MediaItem[]>([])
  const [liveChannels, setLiveChannels] = useState<MediaItem[]>([])
  const [personalizedRow, setPersonalizedRow] = useState<{ title: string; items: MediaItem[] } | null>(null)

  useEffect(() => {
    if (!service) return
    let activeReq = true

    // Coleta nomes dos títulos favoritados/curtidos para afinar as recomendações
    const likedNames = (active?.favorites || []).map((f) => f.name)
    const genres = active?.preferredGenres || []

    Promise.all([
      getRecommendedItems(service, 'movies', genres, likedNames, 24),
      getRecommendedItems(service, 'series', genres, likedNames, 24),
      getPreviewItems(service, 'live', 24),
      genres.length > 0 ? getPersonalizedItems(service, 'series', genres, 20) : Promise.resolve(null),
    ])
      .then(([mList, sList, lList, pRow]) => {
        if (!activeReq) return
        setMovies(mList)
        setSeries(sList)
        setLiveChannels(lList)
        setPersonalizedRow(pRow)
      })
      .catch(() => {})

    return () => {
      activeReq = false
    }
  }, [service, active?.preferredGenres, active?.favorites])

  // Continuar Assistindo (histórico com progresso > 0)
  const continueWatching = useMemo(() => {
    return (active?.history || [])
      .filter((h) => h.duration > 0 && h.position / h.duration > 0.02 && h.position / h.duration < 0.95)
      .slice(0, 10)
  }, [active?.history])

  const profileFavorites = active?.favorites || []

  const heroCandidates = useMemo(() => {
    return [...movies.slice(0, 4), ...series.slice(0, 4)]
  }, [movies, series])

  return (
    <div
      onScroll={(e) => onScrollChange?.(e.currentTarget.scrollTop > 30)}
      className="flex-1 overflow-y-auto no-scrollbar bg-zinc-950 pb-24"
    >
      <HeroCarousel isActive={isActive} />

      <div className="px-6 sm:px-10 lg:px-14 space-y-12 pt-8 sm:pt-10 relative z-10">
        {continueWatching.length > 0 && (
          <section className="space-y-4">
            <SectionHeader title="Continuar assistindo" icon={<Clock size={20} className={ICON} />} />
            <CarouselContainer className="gap-4 pb-2">
              {continueWatching.map((item) => (
                <div key={item.key} className={CARD_WRAP}>
                  <MediaCard
                    item={item}
                    fav={isFavorite(item.key)}
                    onPlay={() => play(item)}
                    onToggleFav={toggle}
                    onInfo={openDetails}
                    progress={item.position / item.duration}
                    aspectRatio="landscape"
                  />
                </div>
              ))}
            </CarouselContainer>
          </section>
        )}

        <TopStreamingSection />
 
        {/* Recomendações Personalizadas pelo Perfil (Doramas, Animes, Ação...) */}
        {personalizedRow && personalizedRow.items.length > 0 && (
          <section className="space-y-4">
            <SectionHeader
              title={personalizedRow.title}
              icon={<Sparkles size={20} className={ICON} />}
              onAction={() => onNavigate('series')}
            />
            <CarouselContainer className="gap-4 pb-2">
              {personalizedRow.items.map((item, idx) => (
                <div key={item.key} className={CARD_WRAP}>
                  <MediaCard
                    item={item}
                    fav={isFavorite(item.key)}
                    onPlay={() => play(item, { playlist: personalizedRow.items })}
                    onToggleFav={toggle}
                    onInfo={openDetails}
                    aspectRatio="landscape"
                    badge={BADGES_SEQUENCE[idx % BADGES_SEQUENCE.length]}
                  />
                </div>
              ))}
            </CarouselContainer>
          </section>
        )}

        {movies.length > 0 && (
          <section className="space-y-4">
            <SectionHeader
              title="Filmes recomendados para você"
              icon={<Film size={20} className={ICON} />}
              onAction={() => onNavigate('movies')}
            />
            <CarouselContainer className="gap-4 pb-2">
              {movies.map((item, idx) => (
                <div key={item.key} className={CARD_WRAP}>
                  <MediaCard
                    item={item}
                    fav={isFavorite(item.key)}
                    onPlay={() => play(item, { playlist: movies })}
                    onToggleFav={toggle}
                    onInfo={openDetails}
                    aspectRatio="landscape"
                    badge={BADGES_SEQUENCE[idx % BADGES_SEQUENCE.length]}
                  />
                </div>
              ))}
            </CarouselContainer>
          </section>
        )}

        {series.length > 0 && (
          <section className="space-y-4">
            <SectionHeader
              title="Séries recomendadas para você"
              icon={<Clapperboard size={20} className={ICON} />}
              onAction={() => onNavigate('series')}
            />
            <CarouselContainer className="gap-4 pb-2">
              {series.map((item, idx) => (
                <div key={item.key} className={CARD_WRAP}>
                  <MediaCard
                    item={item}
                    fav={isFavorite(item.key)}
                    onPlay={() => play(item, { playlist: series })}
                    onToggleFav={toggle}
                    onInfo={openDetails}
                    aspectRatio="landscape"
                    badge={BADGES_SEQUENCE[(idx + 1) % BADGES_SEQUENCE.length]}
                  />
                </div>
              ))}
            </CarouselContainer>
          </section>
        )}

        {liveChannels.length > 0 && (
          <section className="space-y-4">
            <SectionHeader
              title="Canais de TV Ao Vivo"
              icon={<Tv size={20} className={ICON} />}
              actionLabel="Ver todos os canais"
              onAction={() => onNavigate('live')}
            />
            <CarouselContainer className="gap-4 pb-2">
              {liveChannels.map((item) => (
                <div key={item.key} className={CARD_WRAP}>
                  <MediaCard
                    item={item}
                    fav={isFavorite(item.key)}
                    onPlay={() => play(item, { playlist: liveChannels })}
                    onToggleFav={toggle}
                    aspectRatio="landscape"
                  />
                </div>
              ))}
            </CarouselContainer>
          </section>
        )}

        {profileFavorites.length > 0 && (
          <section className="space-y-4">
            <SectionHeader
              title={`Favoritos de ${active?.name ?? ''}`}
              icon={<Star size={20} className="text-amber-400 fill-amber-400" />}
              actionLabel="Ver todos"
              onAction={() => onNavigate('favorites')}
            />
            <CarouselContainer className="gap-4 pb-2">
              {profileFavorites.slice(0, 15).map((item) => (
                <div key={item.key} className={CARD_WRAP}>
                  <MediaCard
                    item={item}
                    fav
                    onPlay={() => play(item)}
                    onToggleFav={toggle}
                    onInfo={openDetails}
                    aspectRatio="landscape"
                  />
                </div>
              ))}
            </CarouselContainer>
          </section>
        )}
      </div>

      {detailItem && <MediaDetailsModal item={detailItem} onClose={closeDetails} />}
    </div>
  )
}
