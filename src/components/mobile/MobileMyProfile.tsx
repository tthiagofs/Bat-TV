import { useState } from 'react'
import { Download, Heart, ChevronRight, Settings, Users, LogOut, Film, Tv, Play, Globe, X, Check } from 'lucide-react'
import { useProfiles } from '../../context/ProfileContext'
import { useAuth } from '../../context/AuthContext'
import { useDownloads } from '../../hooks/useDownloads'
import { useFavorites } from '../../context/FavoritesContext'
import { usePlayback } from '../../context/PlaybackContext'
import { Avatar, DEFAULT_AVATAR } from '../../data/avatars'
import { getCustomProxy, setCustomProxy } from '../../services/proxyConfig'
import type { Section, MediaItem } from '../../types'

interface Props {
  onNavigate: (s: Section) => void
  onOpenEditProfile: () => void
}

export default function MobileMyProfile({
  onNavigate,
  onOpenEditProfile,
}: Props) {
  const { active: profile, leave } = useProfiles()
  const { logout, openManager } = useAuth()
  const { downloads } = useDownloads()
  const { favorites } = useFavorites()
  const { play } = usePlayback()

  const [showProxyModal, setShowProxyModal] = useState(false)
  const [proxyInput, setProxyInput] = useState(getCustomProxy())
  const [proxySavedToast, setProxySavedToast] = useState(false)

  const completedDownloads = downloads.filter((d) => d.status === 'completed')

  const handleSaveProxy = (newUrl: string) => {
    setCustomProxy(newUrl)
    setProxyInput(newUrl.trim())
    setProxySavedToast(true)
    setTimeout(() => {
      setProxySavedToast(false)
      setShowProxyModal(false)
    }, 1200)
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-28 pt-4 px-4 space-y-6 bg-black text-white">
      {/* 1. Header do Perfil estilo "My Netflix" */}
      <div className="flex flex-col items-center justify-center pt-4 pb-2">
        <button
          onClick={leave}
          className="relative group active:scale-95 transition cursor-pointer touch-manipulation"
        >
          <div className="w-20 h-20 rounded-2xl overflow-hidden ring-2 ring-rose-500 shadow-xl bg-zinc-800 flex items-center justify-center">
            <Avatar id={profile?.avatar || DEFAULT_AVATAR} size={80} className="w-full h-full rounded-2xl" />
          </div>
          <span className="absolute -bottom-2 -right-2 bg-zinc-900 border border-white/20 rounded-full p-1 text-xs">
            ⇄
          </span>
        </button>

        <button
          onClick={leave}
          className="mt-3 flex items-center gap-1.5 font-black text-xl text-white active:opacity-80"
        >
          <span>{profile?.name || 'Meu Perfil'}</span>
          <ChevronRight size={18} className="text-zinc-400" />
        </button>
      </div>

      {/* 2. Atalhos Rápidos estilo Netflix (Downloads & Notificações) */}
      <div className="space-y-2">
        {/* Downloads */}
        <button
          onClick={() => onNavigate('downloads')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 active:bg-zinc-800 transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Download size={20} />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-white">Vídeos Baixados (Offline)</p>
              <p className="text-xs text-zinc-400">
                {completedDownloads.length > 0
                  ? `${completedDownloads.length} item(s) prontos para assistir offline`
                  : 'Nenhum vídeo baixado ainda'}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-400" />
        </button>

        {/* Minha Lista */}
        <button
          onClick={() => onNavigate('favorites')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 active:bg-zinc-800 transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Heart size={20} />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-white">Minha Lista de Favoritos</p>
              <p className="text-xs text-zinc-400">
                {favorites.length > 0
                  ? `${favorites.length} filme(s) e série(s) salvos`
                  : 'Sua lista está vazia'}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-400" />
        </button>
      </div>

      {/* 3. Carrossel de Favoritos (Minha Lista Visual) */}
      {favorites.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-white">Minha Lista</h2>
            <button
              onClick={() => onNavigate('favorites')}
              className="text-xs text-rose-400 font-semibold"
            >
              Ver todos ({favorites.length})
            </button>
          </div>

          <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
            {favorites.slice(0, 8).map((item) => (
              <div
                key={item.id}
                onClick={() => play(item)}
                className="shrink-0 w-28 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 relative group cursor-pointer active:scale-95 transition"
              >
                <div className="aspect-[2/3] w-full bg-zinc-800 relative">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <Film size={24} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Play size={24} className="fill-white text-white" />
                  </div>
                </div>
                <div className="p-1.5">
                  <p className="text-[11px] font-bold text-white truncate">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Gerenciamento e Configurações */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-1">
          Configurações da Conta
        </h3>

        <button
          onClick={onOpenEditProfile}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900 active:bg-zinc-800 transition text-sm text-zinc-200"
        >
          <div className="flex items-center gap-3">
            <Settings size={18} className="text-zinc-400" />
            <span>Editar Nome e Avatar do Perfil</span>
          </div>
          <ChevronRight size={16} className="text-zinc-500" />
        </button>

        {/* Configurações de Conexão e Proxy */}
        <button
          onClick={() => {
            setProxyInput(getCustomProxy())
            setShowProxyModal(true)
          }}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900 active:bg-zinc-800 transition text-sm text-zinc-200 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Globe size={18} className="text-sky-400" />
            <div className="text-left">
              <span className="block font-medium">Configurações de Proxy / Conexão</span>
              <p className="text-[11px] text-zinc-400">
                {getCustomProxy() ? 'Cloudflare Worker Ativo' : 'Proxy Vercel (Padrão Ativo)'}
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-500" />
        </button>

        <button
          onClick={leave}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900 active:bg-zinc-800 transition text-sm text-zinc-200"
        >
          <div className="flex items-center gap-3">
            <Users size={18} className="text-zinc-400" />
            <span>Trocar de Perfil</span>
          </div>
          <ChevronRight size={16} className="text-zinc-500" />
        </button>

        <button
          onClick={openManager}
          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900 active:bg-zinc-800 transition text-sm text-zinc-200"
        >
          <div className="flex items-center gap-3">
            <Tv size={18} className="text-zinc-400" />
            <span>Gerenciar Listas IPTV / Trocar Servidor</span>
          </div>
          <ChevronRight size={16} className="text-zinc-500" />
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-rose-950/30 active:bg-rose-950/50 transition text-sm text-rose-400 font-semibold"
        >
          <LogOut size={18} />
          <span>Sair da Conta</span>
        </button>
      </div>

      {/* Modal de Configuração de Proxy / Servidor de Vídeo */}
      {showProxyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe size={20} className="text-sky-400" />
                <h3 className="font-bold text-base text-white">Proxy de Streaming e Conexão</h3>
              </div>
              <button
                onClick={() => setShowProxyModal(false)}
                className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
                <p className="text-xs font-semibold text-zinc-200">
                  Status Atual: {getCustomProxy() ? (
                    <span className="text-sky-400 font-bold">Cloudflare Worker Externo</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">Servidor Vercel (Padrão)</span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Por padrão, as transmissões utilizam o proxy seguro da Vercel. Caso possua um Cloudflare Worker com tráfego ilimitado configurado, insira o link abaixo.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  URL do Cloudflare Worker (Opcional):
                </label>
                <input
                  type="url"
                  value={proxyInput}
                  onChange={(e) => setProxyInput(e.target.value)}
                  placeholder="https://meu-worker.workers.dev"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              {proxySavedToast && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">
                  <Check size={16} /> Configurações salvas com sucesso!
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => handleSaveProxy('')}
                className="text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
              >
                Restaurar Padrão Vercel
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowProxyModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveProxy(proxyInput)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
