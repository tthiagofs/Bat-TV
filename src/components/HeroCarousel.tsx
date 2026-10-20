import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getTrendingHero, searchTmdbItem, type TmdbItem } from '../services/tmdbService'
import type { MediaItem } from '../types'
import CatalogHeroBanner from './CatalogHeroBanner'
import MediaDetailsModal from './MediaDetailsModal'

interface Props {
  isActive?: boolean
  catalogItems?: MediaItem[]
}

/** Banner principal da Home: destaques principais. */
export default function HeroCarousel({ isActive = true, catalogItems }: Props) {
  const [items, setItems] = useState<TmdbItem[]>([])
  const [selected, setSelected] = useState<TmdbItem | null>(null)

  useEffect(() => {
    let isCurrent = true

    getTrendingHero(8).then((res) => {
      if (isCurrent && res.length > 0) setItems(res)
    })

    return () => {
      isCurrent = false
    }
  }, [])

  if (items.length === 0) {
    return (
      <div className="w-full h-[460px] sm:h-[540px] bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-500" size={36} />
      </div>
    )
  }

  return (
    <>
      <CatalogHeroBanner
        items={items}
        badgeLabel="Destaque Nº 1 no Brasil"
        onOpenDetails={setSelected}
        isActive={isActive}
      />
      {selected && <MediaDetailsModal item={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
