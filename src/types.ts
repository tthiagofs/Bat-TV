export type MediaType = 'live' | 'movies' | 'series'
export type Section = 'home' | 'movies' | 'series' | 'sports' | 'live' | 'favorites' | 'downloads'

export interface MediaItem {
  key: string // `${type}:${id}`
  type: MediaType
  id: number
  name: string
  image: string
  ext?: string
  rating?: string
}

export const makeKey = (type: MediaType, id: number) => `${type}:${id}`
