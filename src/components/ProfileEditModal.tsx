import { useState } from 'react'
import { X, Lock, Unlock, Trash2, Search, History, Trophy, Camera, Check, Sparkles, Zap } from 'lucide-react'
import { useProfiles } from '../context/ProfileContext'
import type { Profile } from '../services/profileDb'
import { Avatar } from '../data/avatars'
import { clubByKey } from '../data/teams'
import AvatarPickerModal from './AvatarPickerModal'
import TeamSelectorModal from './TeamSelectorModal'
import GenrePreferencesModal from './GenrePreferencesModal'

interface Props {
  profile: Profile
  onClose: () => void
}

export default function ProfileEditModal({ profile, onClose }: Props) {
  const { update, setPin, remove, clearHistory, clearSearchHistory, profiles } = useProfiles()

  const [name, setName] = useState(profile.name)
  const [avatar, setAvatar] = useState(profile.avatar)
  const [teamKey, setTeamKey] = useState<string | null>(profile.teamKey || null)
  const [preferredGenres, setPreferredGenres] = useState<string[]>(profile.preferredGenres || [])
  const [pin, setPinInput] = useState('')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showTeamSelector, setShowTeamSelector] = useState(false)
  const [showGenreSelector, setShowGenreSelector] = useState(false)
  const [isLiteMode, setIsLiteMode] = useState(() => profile.liteMode ?? (localStorage.getItem('iptv-rea:lite') === '1'))
  const [msg, setMsg] = useState('')

  const toggleLiteMode = () => {
    const next = !isLiteMode
    setIsLiteMode(next)
    if (next) {
      document.documentElement.classList.add('lite')
      localStorage.setItem('iptv-rea:lite', '1')
    } else {
      document.documentElement.classList.remove('lite')
      localStorage.setItem('iptv-rea:lite', '0')
    }
  }

  const handleSave = async () => {
    update(profile.id, {
      name,
      avatar,
      teamKey: teamKey ?? null,
      preferredGenres,
      liteMode: isLiteMode,
    })
    if (pin.length === 4) {
      await setPin(profile.id, pin)
    }
    onClose()
  }

  const handleRemovePin = async () => {
    await setPin(profile.id, null)
    setPinInput('')
    setMsg('PIN de proteção removido com sucesso!')
    setTimeout(() => setMsg(''), 3000)
  }

  const handleClearWatchHistory = () => {
    if (confirm('Tem certeza que deseja apagar o histórico de assistidos deste perfil?')) {
      clearHistory()
      setMsg('Histórico de assistidos limpo!')
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const handleClearSearchHistory = () => {
    clearSearchHistory()
    setMsg('Histórico de pesquisas limpo!')
    setTimeout(() => setMsg(''), 3000)
  }

  const handleDeleteProfile = () => {
    if (profiles.length <= 1) {
      alert('Não é possível excluir o único perfil do aplicativo.')
      return
    }
    if (confirm(`Tem certeza que deseja apagar o perfil "${profile.name}"? Todos os favoritos e histórico serão perdidos.`)) {
      remove(profile.id)
      onClose()
    }
  }

  const club = clubByKey(teamKey || undefined)

  return (
    <>
      <div data-tv-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-up select-none">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-100">Configurações do Perfil</h2>
            <button
              type="button"
              tabIndex={0}
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {msg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <Check size={16} /> {msg}
              </div>
            )}

            {/* Avatar & Nome */}
            <div className="flex items-center gap-5">
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowAvatarPicker(true)}
                className="relative group cursor-pointer focus:ring-4 focus:ring-rose-500 rounded-2xl focus:outline-none p-1"
              >
                <Avatar id={avatar} size={84} />
                <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 group-focus:opacity-100 flex flex-col items-center justify-center text-white transition text-xs font-semibold gap-1">
                  <Camera size={18} />
                  <span>Mudar</span>
                </div>
              </button>
              <div className="flex-1">
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Nome do Perfil</label>
                <input
                  type="text"
                  tabIndex={0}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 font-medium focus:outline-none focus:ring-4 focus:ring-rose-500 focus:border-rose-500 transition"
                  placeholder="Nome do perfil"
                />
              </div>
            </div>


            {/* Time de Coração */}
            <div className="p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Trophy size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Time de Coração</p>
                  <p className="text-xs text-zinc-400">{club ? club.name : 'Nenhum selecionado'}</p>
                </div>
              </div>
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowTeamSelector(true)}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
              >
                {club ? 'Alterar' : 'Escolher'}
              </button>
            </div>

            {/* Preferências de Conteúdo (Doramas, Animes, Ação...) */}
            <div className="p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Gêneros Favoritos</p>
                  <p className="text-xs text-zinc-400">
                    {preferredGenres.length > 0
                      ? `${preferredGenres.length} selecionado${preferredGenres.length > 1 ? 's' : ''} (Doramas, etc.)`
                      : 'Nenhum gênero configurado'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowGenreSelector(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-semibold text-rose-300 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
              >
                {preferredGenres.length > 0 ? 'Alterar' : 'Configurar'}
              </button>
            </div>

            {/* Versão Lite (Desempenho Fire Stick e PC) */}
            <div className="p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border transition ${isLiteMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                    <span>Versão Lite</span>
                    <span className="text-[10px] uppercase font-extrabold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      {isLiteMode ? 'Ativada' : 'Desativada'}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-400">
                    Desativa reprodução automática de trailers e desfoques pesados para máxima fluidez
                  </p>
                </div>
              </div>
              <button
                type="button"
                tabIndex={0}
                onClick={toggleLiteMode}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition focus:ring-4 focus:ring-amber-400 focus:outline-none cursor-pointer ${
                  isLiteMode
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                }`}
              >
                {isLiteMode ? 'Ligada' : 'Desligada'}
              </button>
            </div>

            {/* PIN de Segurança */}
            <div className="p-4 rounded-2xl bg-zinc-950/40 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    {profile.pinHash ? <Lock size={20} /> : <Unlock size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">PIN de 4 Dígitos</p>
                    <p className="text-xs text-zinc-400">
                      {profile.pinHash ? 'Este perfil está protegido com senha' : 'Sem proteção de acesso'}
                    </p>
                  </div>
                </div>
                {profile.pinHash && (
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={handleRemovePin}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold focus:ring-2 focus:ring-rose-500 rounded p-1 transition cursor-pointer"
                  >
                    Remover PIN
                  </button>
                )}
              </div>
              <div>
                <input
                  type="password"
                  tabIndex={0}
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-4 focus:ring-rose-500 focus:border-rose-500 transition"
                  placeholder={profile.pinHash ? 'Digite um novo PIN de 4 dígitos para alterar' : 'Definir PIN de 4 dígitos (opcional)'}
                />
              </div>
            </div>

            {/* Ações de Histórico */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">Privacidade & Dados</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  tabIndex={0}
                  onClick={handleClearSearchHistory}
                  className="p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-800 flex items-center gap-2.5 text-left text-xs font-medium text-zinc-300 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
                >
                  <Search size={16} className="text-zinc-400" />
                  <span>Limpar Pesquisas</span>
                </button>
                <button
                  type="button"
                  tabIndex={0}
                  onClick={handleClearWatchHistory}
                  className="p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-800 flex items-center gap-2.5 text-left text-xs font-medium text-zinc-300 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
                >
                  <History size={16} className="text-zinc-400" />
                  <span>Limpar Assistidos</span>
                </button>
              </div>
            </div>

            {/* Excluir Perfil */}
            {profiles.length > 1 && (
              <div className="pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  tabIndex={0}
                  onClick={handleDeleteProfile}
                  className="w-full py-2.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold focus:ring-4 focus:ring-rose-500 focus:outline-none transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 size={15} /> Excluir Este Perfil
                </button>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/40">
            <button
              type="button"
              tabIndex={0}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              tabIndex={0}
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-950/40 focus:ring-4 focus:ring-rose-500 focus:outline-none transition cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>

        </div>
      </div>

      {showAvatarPicker && (
        <AvatarPickerModal
          selected={avatar}
          onSelect={(newAvatar) => setAvatar(newAvatar)}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {showTeamSelector && (
        <TeamSelectorModal
          selected={teamKey || undefined}
          onSelect={(club) => setTeamKey(club)}
          onClose={() => setShowTeamSelector(false)}
        />
      )}

      {showGenreSelector && (
        <GenrePreferencesModal
          profileName={name}
          initialSelected={preferredGenres}
          onSave={(genres) => setPreferredGenres(genres)}
          onClose={() => setShowGenreSelector(false)}
        />
      )}
    </>
  )
}
