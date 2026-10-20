import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  children: ReactNode
  className?: string
  scrollAmount?: number
}

export default function CarouselContainer({ children, className = '', scrollAmount = 550 }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="relative group/carousel select-none">
      {/* Seta Lateral Esquerda estilo Netflix / Prime Video (Apenas Mouse / Desktop) */}
      <button
        type="button"
        tabIndex={-1}
        data-tv-ignore="true"
        aria-hidden="true"
        onClick={() => handleScroll(-scrollAmount)}
        aria-label="Voltar carrossel"
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-full w-14 bg-gradient-to-r from-black/95 via-black/50 to-transparent flex items-center justify-start pl-1 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 cursor-pointer pointer-events-none group-hover/carousel:pointer-events-auto"
      >
        <div className="p-2.5 rounded-full bg-zinc-950/85 hover:bg-black text-white border border-zinc-700/80 shadow-2xl backdrop-blur-md hover:scale-110 active:scale-95 transition-all">
          <ChevronLeft size={22} />
        </div>
      </button>

      {/* Conteúdo com Scroll Horizontal Suave e Espaço para Minitela Expandida sem Cortes */}
      <div
        ref={scrollRef}
        className={`flex gap-4 overflow-x-auto py-8 -my-8 px-3 -mx-3 no-scrollbar scroll-smooth ${className}`}
      >
        {children}
      </div>

      {/* Seta Lateral Direita estilo Netflix / Prime Video (Apenas Mouse / Desktop) */}
      <button
        type="button"
        tabIndex={-1}
        data-tv-ignore="true"
        aria-hidden="true"
        onClick={() => handleScroll(scrollAmount)}
        aria-label="Avançar carrossel"
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-full w-14 bg-gradient-to-l from-black/95 via-black/50 to-transparent flex items-center justify-end pr-1 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 cursor-pointer pointer-events-none group-hover/carousel:pointer-events-auto"
      >
        <div className="p-2.5 rounded-full bg-zinc-950/85 hover:bg-black text-white border border-zinc-700/80 shadow-2xl backdrop-blur-md hover:scale-110 active:scale-95 transition-all">
          <ChevronRight size={22} />
        </div>
      </button>
    </div>
  )
}

