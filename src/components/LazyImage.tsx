import { memo, useEffect, useRef, useState } from 'react'

/**
 * Reduz o tamanho de imagens TMDB (muito usadas em listas Xtream) para a largura necessária.
 * Ex.: .../t/p/w600_and_h900_bestv2/x.jpg -> .../t/p/w342/x.jpg
 */
export function optimizeImage(url: string | undefined, width: number): string {
  if (!url) return ''
  const sizes = [92, 154, 185, 342, 500, 780]
  const w = sizes.find((s) => s >= width) ?? 780
  return url.replace(/(image\.tmdb\.org\/t\/p\/)(?:w\d+(?:_and_h\d+_\w+)?|original)\//, `$1w${w}/`)
}

interface Props {
  src?: string
  alt: string
  /** largura de exibição aproximada (px) — define o tamanho baixado */
  width?: number
  fit?: 'cover' | 'contain'
  className?: string
  /** carrega imediatamente (banners acima da dobra) */
  eager?: boolean
}

/** Imagem com lazy-loading real (IntersectionObserver), decodificação assíncrona e fade-in. */
function LazyImageBase({ src, alt, width = 342, fit = 'cover', className = '', eager = false }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(eager)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (visible || !ref.current) return
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect() } },
      { rootMargin: '300px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [visible])

  const url = optimizeImage(src, width)

  return (
    <div ref={ref} className={`relative w-full h-full bg-zinc-800 overflow-hidden ${className}`}>
      {visible && url && !failed && (
        <img
          src={url}
          alt={alt}
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full transition-opacity duration-300 ${fit === 'cover' ? 'object-cover' : 'object-contain'} ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {(failed || !url) && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-2xl font-bold select-none">
          {alt.trim().charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  )
}

export default memo(LazyImageBase)
