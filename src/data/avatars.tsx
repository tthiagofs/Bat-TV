import { useState } from 'react'
import { CLUBS } from './teams'

export interface AvatarDef {
  id: string
  label: string
  imageUrl: string
  fallbackUrl?: string
  isClub?: boolean
  c1?: string
  c2?: string
}

export interface AvatarCategory {
  id: string
  label: string
  avatars: AvatarDef[]
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: 'clubs',
    label: 'Times de Futebol',
    avatars: CLUBS.map((c) => ({
      id: `club:${c.key}`,
      label: c.name,
      imageUrl: c.badge,
      fallbackUrl: c.badge,
      isClub: true,
      c1: c.c1,
      c2: c.c2,
    })),
  },
  {
    id: 'naruto',
    label: 'Naruto',
    avatars: [
      {
        id: 'naruto:naruto',
        label: 'Naruto Uzumaki',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png',
        fallbackUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300',
        c1: '#f97316',
        c2: '#1e3a8a',
      },
      {
        id: 'naruto:sasuke',
        label: 'Sasuke Uchiha',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b13-SISLEw1oAD7a.png',
        fallbackUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300',
        c1: '#312e81',
        c2: '#0f172a',
      },
      {
        id: 'naruto:kakashi',
        label: 'Kakashi Hatake',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b85-mkVBh2yjxjmx.png',
        fallbackUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300',
        c1: '#64748b',
        c2: '#0f172a',
      },
      {
        id: 'naruto:itachi',
        label: 'Itachi Uchiha',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b14-9Kb1E5oel1ke.png',
        fallbackUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300',
        c1: '#991b1b',
        c2: '#0a0a0a',
      },
      {
        id: 'naruto:sakura',
        label: 'Sakura Haruno',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b145-IorfpI8arxeX.png',
        fallbackUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300',
        c1: '#f472b6',
        c2: '#be185d',
      },
      {
        id: 'naruto:minato',
        label: 'Minato Namikaze',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b2535-Xq9WKNPJQEt3.png',
        fallbackUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300',
        c1: '#eab308',
        c2: '#1d4ed8',
      },
      {
        id: 'naruto:jiraiya',
        label: 'Jiraiya',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b2423-RO5MyoXSA9OL.png',
        fallbackUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300',
        c1: '#dc2626',
        c2: '#475569',
      },
      {
        id: 'naruto:hinata',
        label: 'Hinata Hyuuga',
        imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b1555-Q41GLTV3FvYF.png',
        fallbackUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
        c1: '#a78bfa',
        c2: '#4c1d95',
      },
    ],
  },
  {
    id: 'himym',
    label: 'How I Met Your Mother',
    avatars: [
      {
        id: 'himym:ted',
        label: 'Ted Mosby',
        imageUrl: 'https://image.tmdb.org/t/p/w500/rHx4D70iRUkka5kl9064kOvmSQs.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
        c1: '#2563eb',
        c2: '#1e3a8a',
      },
      {
        id: 'himym:barney',
        label: 'Barney Stinson',
        imageUrl: 'https://image.tmdb.org/t/p/w500/r2twLWLwDpKJ7JyhWsD1YsL7rJV.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300',
        c1: '#374151',
        c2: '#030712',
      },
      {
        id: 'himym:robin',
        label: 'Robin Scherbatsky',
        imageUrl: 'https://image.tmdb.org/t/p/w500/1b0mYokcGsfFRge4bjXlS5ihtek.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
        c1: '#dc2626',
        c2: '#7f1d1d',
      },
      {
        id: 'himym:marshall',
        label: 'Marshall Eriksen',
        imageUrl: 'https://image.tmdb.org/t/p/w500/aG6tVNSbl1YEjN65G3luFYnWbUM.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300',
        c1: '#16a34a',
        c2: '#14532d',
      },
      {
        id: 'himym:lily',
        label: 'Lily Aldrin',
        imageUrl: 'https://image.tmdb.org/t/p/w500/bO16z8rAzZWdjCga8dcbJ2AFAh2.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300',
        c1: '#ec4899',
        c2: '#7c3aed',
      },
    ],
  },
  {
    id: 'hp',
    label: 'Harry Potter',
    avatars: [
      {
        id: 'hp:harry',
        label: 'Harry Potter',
        imageUrl: 'https://image.tmdb.org/t/p/w500/uUFfo8RANo7tuckB6AZAnESne55.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300',
        c1: '#b91c1c',
        c2: '#d97706',
      },
      {
        id: 'hp:hermione',
        label: 'Hermione Granger',
        imageUrl: 'https://image.tmdb.org/t/p/w500/mf0OANvWYSzU1d8yggrhyw8IbIz.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300',
        c1: '#b91c1c',
        c2: '#78350f',
      },
      {
        id: 'hp:rony',
        label: 'Ron Weasley',
        imageUrl: 'https://image.tmdb.org/t/p/w500/iFlkpTaOF6fGLqxz8b0PhI0i0zN.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300',
        c1: '#ea580c',
        c2: '#7c2d12',
      },
      {
        id: 'hp:dumbledore',
        label: 'Alvo Dumbledore',
        imageUrl: 'https://image.tmdb.org/t/p/w500/3jdWkDKf4IODbG4JKTeaC7AzxZH.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300',
        c1: '#7c3aed',
        c2: '#312e81',
      },
      {
        id: 'hp:snape',
        label: 'Severo Snape',
        imageUrl: 'https://image.tmdb.org/t/p/w500/1EearzPgXkmYFKvECfWNrctIFT9.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300',
        c1: '#166534',
        c2: '#020617',
      },
    ],
  },
  {
    id: 'others',
    label: 'Cinema & Séries',
    avatars: [
      {
        id: 'other:shelby',
        label: 'Thomas Shelby',
        imageUrl: 'https://image.tmdb.org/t/p/w500/2lKs67r7FI4bPu0AXxMUJZxmUXn.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300',
        c1: '#1e293b',
        c2: '#020617',
      },
      {
        id: 'other:walter',
        label: 'Walter White',
        imageUrl: 'https://image.tmdb.org/t/p/w500/7Jahy5LZX2Fo8fGJltMreAI49hC.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300',
        c1: '#ca8a04',
        c2: '#052e16',
      },
      {
        id: 'other:eleven',
        label: 'Eleven',
        imageUrl: 'https://image.tmdb.org/t/p/w500/8qasWpPYwiBgPw5Sn54YzN7q5uI.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300',
        c1: '#e11d48',
        c2: '#1e1b4b',
      },
      {
        id: 'other:joker',
        label: 'Coringa (Joker)',
        imageUrl: 'https://image.tmdb.org/t/p/w500/AdWKVqyWpkYSfKE5Gb2qn8JzHni.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=300',
        c1: '#7e22ce',
        c2: '#14532d',
      },
      {
        id: 'other:tony',
        label: 'Tony Stark',
        imageUrl: 'https://image.tmdb.org/t/p/w500/5qHNjhtjMD4YWH3UP0rm4tKwxCL.jpg',
        fallbackUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300',
        c1: '#dc2626',
        c2: '#eab308',
      },
    ],
  },
]

const ALL = AVATAR_CATEGORIES.flatMap((c) => c.avatars)
export const DEFAULT_AVATAR = 'naruto:naruto'
export const avatarById = (id: string) => ALL.find((a) => a.id === id)

interface AvatarProps {
  id?: string | null
  size?: number
  className?: string
}

export function Avatar({ id, size = 96, className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const [useFallback, setUseFallback] = useState(false)

  const style = { width: size, height: size }
  const safeId = (typeof id === 'string' && id.trim()) ? id : DEFAULT_AVATAR

  // Imagem enviada pelo usuário (data: base64 ou URL customizada)
  if (safeId.startsWith('data:') || safeId.startsWith('http://') || safeId.startsWith('https://')) {
    return (
      <img
        src={safeId}
        alt="Avatar"
        referrerPolicy="no-referrer"
        style={style}
        className={`rounded-2xl object-cover border border-zinc-800 shadow-md ${className}`}
        onError={(e) => {
          ;(e.target as HTMLImageElement).src = avatarById(DEFAULT_AVATAR)?.imageUrl || ''
        }}
      />
    )
  }

  const def = avatarById(safeId) ?? avatarById(DEFAULT_AVATAR) ?? {
    id: DEFAULT_AVATAR,
    label: 'Usuário',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b17-phjcWCkRuIhu.png',
    c1: '#f97316',
    c2: '#1e3a8a',
  }

  if (def.isClub) {
    return (
      <div
        style={{
          ...style,
          background: `radial-gradient(circle at center, ${def.c2 || '#27272a'} 0%, #09090b 100%)`,
        }}
        className={`rounded-2xl flex items-center justify-center p-2.5 border border-zinc-800/80 shadow-md ${className}`}
      >
        <img
          src={def.imageUrl}
          alt={def.label}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
        />
      </div>
    )
  }

  // Se todas as imagens falharem, exibe avatar estilizado elegante com gradiente e iniciais
  if (imgError) {
    return (
      <div
        style={{
          ...style,
          background: `linear-gradient(135deg, ${def.c1 || '#e11d48'}, ${def.c2 || '#18181b'})`,
        }}
        className={`rounded-2xl flex items-center justify-center font-bold text-white shadow-md border border-zinc-700 ${className}`}
      >
        <span style={{ fontSize: size * 0.4 }}>{def.label.charAt(0)}</span>
      </div>
    )
  }

  const currentSrc = useFallback ? def.fallbackUrl || def.imageUrl : def.imageUrl

  return (
    <div
      style={style}
      className={`rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-md flex items-center justify-center ${className}`}
    >
      <img
        src={currentSrc}
        alt={def.label}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover object-top"
        onError={() => {
          if (!useFallback && def.fallbackUrl) {
            setUseFallback(true)
          } else {
            setImgError(true)
          }
        }}
      />
    </div>
  )
}
