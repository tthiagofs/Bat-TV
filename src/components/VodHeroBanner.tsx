import { useState, useEffect } from 'react'
import { getTrendingMovies, getTrendingSeries, searchTmdbItem, type TmdbItem } from '../services/tmdbService'
import type { MediaItem } from '../types'
import CatalogHeroBanner from './CatalogHeroBanner'
import MobileHeroBanner from './mobile/MobileHeroBanner'
import { useIsMobile } from '../hooks/useIsMobile'
import { usePlayback } from '../context/PlaybackContext'

interface Props {
  type: 'movies' | 'series'
  onOpenDetails: (item: TmdbItem) => void
  isActive?: boolean
  catalogItems?: MediaItem[]
}

const FALLBACK_MOVIES: TmdbItem[] = [
  {
    id: 533535,
    title: 'Deadpool & Wolverine',
    overview: 'Wolverine está se recuperando de seus ferimentos quando cruza seu caminho com o mercenário tagarela Deadpool. Juntos, eles formam uma aliança inesperada para enfrentar um inimigo em comum.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/yDHYTjA3R0jFYba16jBB1ef8oIt.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    voteAverage: 7.7,
    mediaType: 'movie',
    releaseDate: '2024-07-24',
  },
  {
    id: 519182,
    title: 'Meu Malvado Favorito 4',
    overview: 'Gru e sua família enfrentam uma nova ameaça quando Maxime Le Mal escapa da prisão e busca vingança.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/lgkFt6tc89tq24qkG7tTWpTV2d.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/3w843xsHbbtY0EkRYxCS8LoWZrP.jpg',
    voteAverage: 7.2,
    mediaType: 'movie',
    releaseDate: '2024-06-20',
  },
  {
    id: 1022789,
    title: 'Divertida Mente 2',
    overview: 'A mente da jovem Riley passa por uma reforma súbita para dar espaço a novas emoções inesperadas.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/stKGOmbuwhL48wnRmp2eDGiQ9f9.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg',
    voteAverage: 7.6,
    mediaType: 'movie',
    releaseDate: '2024-06-14',
  },
  {
    id: 693134,
    title: 'Duna: Parte 2',
    overview: 'Paul Atreides se une a Chani e aos Fremen enquanto busca vingança contra os conspiradores que destruíram sua família.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5200bm.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/5aUVtdqaVp9hC6L4o6tSfc8Qk34.jpg',
    voteAverage: 8.2,
    mediaType: 'movie',
    releaseDate: '2024-02-27',
  },
  {
    id: 653346,
    title: 'Planeta dos Macacos: O Reinado',
    overview: 'Muitos anos após o reinado de César, um jovem macaco empreende uma jornada que o levará a questionar tudo o que lhe foi ensinado.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/fqv8v6AycXKsivp1TddutaLIx0J.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/dzDK2TMXzsioUW8apKJePaFM8Yn.jpg',
    voteAverage: 7.1,
    mediaType: 'movie',
    releaseDate: '2024-05-08',
  },
]

const FALLBACK_SERIES: TmdbItem[] = [
  {
    id: 94997,
    title: 'A Casa do Dragão',
    overview: 'A história da família Targaryen quase 200 anos antes dos eventos de Game of Thrones.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/etj5CuMuamjhECUdPVVOJJ0v4sm.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/1X4h40fcB4WWUmIBK0auT4zRBAV.jpg',
    voteAverage: 8.4,
    mediaType: 'tv',
    releaseDate: '2022-08-21',
  },
  {
    id: 76479,
    title: 'The Boys',
    overview: 'Um grupo de vigilantes luta contra super-heróis corruptos que abusam de seus superpoderes.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/nxxCPRgtzx88n9as0F0b5s0Y19b.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/2zmTngn1tYC1AvfnNDBpQI4r1fB.jpg',
    voteAverage: 8.5,
    mediaType: 'tv',
    releaseDate: '2019-07-26',
  },
  {
    id: 126308,
    title: 'Xógum: A Gloriosa Saga do Japão',
    overview: 'No Japão de 1600, Lorde Yoshii Toranaga luta pela sua vida enquanto seus inimigos se unem contra ele.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/2rmK7mnchw9Xr3XdiTFSxTTvYQI.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WNzG1AgYT.jpg',
    voteAverage: 8.5,
    mediaType: 'tv',
    releaseDate: '2024-02-27',
  },
  {
    id: 106379,
    title: 'Fallout',
    overview: 'Em um futuro pós-apocalíptico, os habitantes de luxuosos abrigos subterrâneos são forçados a retornar à superfície.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/7eHk77q07Q20gK6h834P7U19a6C.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/22RW5i46654jM80nZp17i6p7N1e.jpg',
    voteAverage: 8.3,
    mediaType: 'tv',
    releaseDate: '2024-04-10',
  },
  {
    id: 1396,
    title: 'Breaking Bad: A Química do Mal',
    overview: 'Um professor de química diagnosticado com câncer inoperável passa a produzir metanfetamina para garantir o futuro da família.',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    posterPath: 'https://image.tmdb.org/t/p/w500/3xnWaLQjelJDDF7LT1WBo6f4BRe.jpg',
    voteAverage: 8.9,
    mediaType: 'tv',
    releaseDate: '2008-01-20',
  },
]

export default function VodHeroBanner({ type, onOpenDetails, isActive = true }: Props) {
  const initialItems = type === 'movies' ? FALLBACK_MOVIES : FALLBACK_SERIES
  const [items, setItems] = useState<TmdbItem[]>(initialItems)

  useEffect(() => {
    let isCurrent = true

    // Sempre carrega os filmes ou séries mais em alta no Brasil no momento (Top 5)
    async function loadTrending() {
      try {
        const trending =
          type === 'movies'
            ? await getTrendingMovies(5)
            : await getTrendingSeries(5)

        if (isCurrent && trending && trending.length > 0) {
          setItems(trending)
        }
      } catch (err) {
        console.warn('Erro ao carregar banners trending TMDB:', err)
      }
    }

    loadTrending()

    return () => {
      isCurrent = false
    }
  }, [type])

  const badgeFn = (_item: TmdbItem, idx: number) => {
    return type === 'movies'
      ? `Top ${idx + 1} em Filmes Mais Assistidos`
      : `Top ${idx + 1} em Séries Mais Assistidas`
  }

  const isMobile = useIsMobile(768)
  const { play } = usePlayback()

  if (isMobile) {
    return (
      <MobileHeroBanner
        key={type}
        items={items}
        onOpenDetails={onOpenDetails}
        onPlay={(hero) => {
          if (hero.mediaItem) {
            play(hero.mediaItem)
          } else {
            onOpenDetails(hero)
          }
        }}
      />
    )
  }

  return (
    <CatalogHeroBanner
      key={type}
      items={items}
      badgeLabel={badgeFn}
      onOpenDetails={onOpenDetails}
      isActive={isActive}
    />
  )
}
