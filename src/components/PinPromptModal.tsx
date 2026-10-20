import { useState, useEffect, useRef } from 'react'
import { Lock, X, Delete } from 'lucide-react'

interface Props {
  profileName: string
  onSubmit: (pin: string) => Promise<boolean>
  onClose: () => void
}

export default function PinPromptModal({ profileName, onSubmit, onClose }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (/^[0-9]$/.test(e.key)) {
        setPin((p) => (p.length < 4 ? p + e.key : p))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    if (pin.length === 4) {
      setLoading(true)
      setError(false)
      onSubmit(pin).then((ok) => {
        setLoading(false)
        if (!ok) {
          setError(true)
          setPin('')
        }
      })
    }
  }, [pin, onSubmit])

  const pressDigit = (d: string) => {
    if (pin.length < 4) setPin((p) => p + d)
  }

  return (
    <div data-tv-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 fade-up select-none">
      <div ref={containerRef} className={`bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-sm p-6 flex flex-col items-center shadow-2xl relative ${error ? 'shake' : ''}`}>
        <button
          type="button"
          tabIndex={0}
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
        >
          <X size={20} />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3">
          <Lock size={26} />
        </div>

        <h2 className="text-lg font-bold text-zinc-100">Perfil Protegido</h2>
        <p className="text-xs text-zinc-400 mt-1 mb-6 text-center">
          Digite o PIN de 4 dígitos para acessar <strong className="text-zinc-200">{profileName}</strong>
        </p>

        {/* 4 Pontos de PIN */}
        <div className="flex gap-4 mb-6">
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  filled ? 'bg-rose-500 border-rose-500 scale-110 shadow-lg shadow-rose-900/50' : 'border-zinc-700 bg-zinc-800'
                }`}
              />
            )
          })}
        </div>

        {error && <p className="text-xs text-rose-400 font-semibold mb-4">PIN incorreto. Tente novamente.</p>}

        {/* Teclado numérico */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              type="button"
              tabIndex={0}
              key={digit}
              disabled={loading}
              onClick={() => pressDigit(digit)}
              className="h-12 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 font-bold text-lg text-zinc-100 transition active:scale-95 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none disabled:opacity-50 cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <div />
          <button
            type="button"
            tabIndex={0}
            disabled={loading}
            onClick={() => pressDigit('0')}
            className="h-12 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 font-bold text-lg text-zinc-100 transition active:scale-95 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            tabIndex={0}
            disabled={loading || pin.length === 0}
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="h-12 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition active:scale-95 focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none disabled:opacity-30 cursor-pointer"
          >
            <Delete size={20} />
          </button>
        </div>
      </div>
    </div>

  )
}
