import { memo, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface Props {
  title: string
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
}

/** Cabeçalho padrão de fileira: título à esquerda e "Veja mais >" à direita. */
function SectionHeaderBase({ title, icon, actionLabel = 'Veja mais', onAction }: Props) {
  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h2>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-semibold text-zinc-400 hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded px-1 flex items-center gap-1 transition cursor-pointer"
        >
          <span>{actionLabel}</span>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}

export default memo(SectionHeaderBase)
