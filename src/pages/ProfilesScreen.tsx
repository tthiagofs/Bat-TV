import { useState } from 'react'
import { Plus, Pencil, Lock, Trophy, ArrowRight, UserPlus, X } from 'lucide-react'
import { useProfiles } from '../context/ProfileContext'
import type { Profile } from '../services/profileDb'
import { Avatar, DEFAULT_AVATAR } from '../data/avatars'
import { clubByKey } from '../data/teams'
import PinPromptModal from '../components/PinPromptModal'
import ProfileEditModal from '../components/ProfileEditModal'
import AvatarPickerModal from '../components/AvatarPickerModal'
import TeamSelectorModal from '../components/TeamSelectorModal'
import GenrePreferencesModal, { AVAILABLE_GENRES } from '../components/GenrePreferencesModal'
import { Sparkles } from 'lucide-react'
import batLogo from '../assets/logo.png'

export default function ProfilesScreen() {
  const { profiles, canCreate, select, verifyPin, create } = useProfiles()

  const [managing, setManaging] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [pinPromptProfile, setPinPromptProfile] = useState<Profile | null>(null)

  // Estado de criação de novo perfil
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAvatar, setNewAvatar] = useState(DEFAULT_AVATAR)
  const [newTeam, setNewTeam] = useState<string | null>(null)
  const [newPin, setNewPin] = useState('')
  const [newGenres, setNewGenres] = useState<string[]>([])
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showTeamSelector, setShowTeamSelector] = useState(false)
  const [showGenreSelector, setShowGenreSelector] = useState(false)
  const [createError, setCreateError] = useState('')

  const handleProfileClick = (p: Profile) => {
    if (managing) {
      setEditingProfile(p)
      return
    }
    if (p.pinHash) {
      setPinPromptProfile(p)
      return
    }
    select(p.id)
  }

  const handlePinSubmit = async (pin: string): Promise<boolean> => {
    if (!pinPromptProfile) return false
    const valid = await verifyPin(pinPromptProfile.id, pin)
    if (valid) {
      select(pinPromptProfile.id)
      setPinPromptProfile(null)
      return true
    }
    return false
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!newName.trim()) {
      setCreateError('Informe o nome do perfil.')
      return
    }
    if (newPin && newPin.length !== 4) {
      setCreateError('O PIN deve conter exatamente 4 dígitos.')
      return
    }

    const created = await create({
      name: newName,
      avatar: newAvatar,
      teamKey: newTeam ?? undefined,
      pin: newPin || undefined,
      preferredGenres: newGenres.length > 0 ? newGenres : undefined,
    })

    if (created) {
      setIsCreating(false)
      setNewName('')
      setNewAvatar(DEFAULT_AVATAR)
      setNewTeam(null)
      setNewPin('')
      setNewGenres([])
      select(created.id)
    }
  }

  const selectedClub = clubByKey(newTeam || undefined)

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-zinc-950 via-zinc-900 to-black flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 pt-12 sm:pt-6 select-none overflow-y-auto min-h-[100dvh]">
      {/* Background glow suave */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-rose-600/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center my-auto">
        {/* Logo Oficial BAT TV */}
        <div className="mb-4 sm:mb-6 flex flex-col items-center">
          <img
            src={batLogo}
            alt="BAT TV"
            className="h-16 sm:h-20 w-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform"
          />
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-100 mb-2 text-center">
          {managing ? 'Gerenciar Perfis' : 'Quem está assistindo?'}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mb-6 sm:mb-10 text-center max-w-xs sm:max-w-md">
          {managing ? 'Selecione um perfil para alterar foto, nome, PIN ou time' : 'Escolha seu perfil para acessar seus favoritos, histórico e recomendações'}
        </p>

        {/* Grade de Perfis */}
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 max-w-3xl mb-8 sm:mb-12">
          {profiles.map((p, idx) => {
            return (
              <button
                type="button"
                tabIndex={0}
                autoFocus={idx === 0}
                key={p.id}
                onClick={() => handleProfileClick(p)}
                className="group flex flex-col items-center gap-2.5 sm:gap-3 cursor-pointer transition-transform active:scale-95 hover:-translate-y-1.5 focus:-translate-y-2 focus:scale-105 focus:outline-none touch-manipulation"
              >
                <div className="relative">
                  <div className={`p-1 rounded-2xl transition border-2 ${
                    managing 
                      ? 'border-amber-400 group-hover:border-amber-300 group-focus:border-amber-300 group-focus:ring-4 group-focus:ring-amber-400/80' 
                      : 'border-transparent group-hover:border-rose-500 group-hover:shadow-xl group-hover:shadow-rose-950/40 group-focus:border-white group-focus:ring-4 group-focus:ring-rose-500 group-focus:shadow-[0_0_30px_rgba(244,63,94,0.7)]'
                  }`}>
                    <Avatar id={p.avatar} size={110} className="shadow-lg" />
                  </div>

                  {/* Badges de PIN ou Modo Gerenciar */}
                  {managing ? (
                    <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center text-white">
                      <div className="p-2.5 rounded-full bg-zinc-900/80 border border-zinc-700 shadow-md">
                        <Pencil size={20} className="text-amber-400" />
                      </div>
                    </div>
                  ) : (
                    p.pinHash && (
                      <div className="absolute bottom-1 right-1 p-1.5 rounded-full bg-zinc-950/90 border border-zinc-700 text-rose-400 shadow">
                        <Lock size={13} />
                      </div>
                    )
                  )}
                </div>

                <div className="text-center">
                  <span className="text-sm sm:text-base font-semibold text-zinc-300 group-hover:text-zinc-100 group-focus:text-rose-400 transition block truncate max-w-[120px]">
                    {p.name}
                  </span>
                  {p.teamKey && (
                    <span className="text-[11px] text-zinc-500 flex items-center justify-center gap-1 mt-0.5">
                      <Trophy size={11} className="text-amber-400" /> {clubByKey(p.teamKey)?.short}
                    </span>
                  )}
                </div>
              </button>
            )
          })}

          {/* Botão Adicionar Perfil (Até 6) */}
          {canCreate && !managing && (
            <button
              type="button"
              tabIndex={0}
              onClick={() => setIsCreating(true)}
              className="group flex flex-col items-center gap-3 cursor-pointer transition-transform hover:-translate-y-1.5 focus:-translate-y-2 focus:scale-105 focus:outline-none"
            >
              <div className="w-[118px] h-[118px] rounded-2xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 group-focus:border-white group-focus:ring-4 group-focus:ring-rose-500 bg-zinc-900/40 hover:bg-zinc-800/40 flex items-center justify-center text-zinc-500 group-hover:text-zinc-300 group-focus:text-white transition">
                <Plus size={36} />
              </div>
              <span className="text-sm font-semibold text-zinc-400 group-hover:text-zinc-200 group-focus:text-rose-400 transition">
                Adicionar Perfil
              </span>
            </button>
          )}
        </div>

        {/* Botão de Modo Gerenciar */}
        {profiles.length > 0 && (
          <button
            type="button"
            tabIndex={0}
            onClick={() => setManaging(!managing)}
            className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide uppercase transition border focus:scale-105 focus:ring-4 focus:ring-rose-500 focus:outline-none cursor-pointer ${
              managing
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-950/40'
                : 'border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 bg-zinc-900/60'
            }`}
          >
            {managing ? 'Concluído' : 'Gerenciar Perfis'}
          </button>

        )}
      </div>

      {/* Modal Prompt de PIN */}
      {pinPromptProfile && (
        <PinPromptModal
          profileName={pinPromptProfile.name}
          onSubmit={handlePinSubmit}
          onClose={() => setPinPromptProfile(null)}
        />
      )}

      {/* Modal de Edição de Perfil */}
      {editingProfile && (
        <ProfileEditModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
        />
      )}

      {/* Modal de Criação de Perfil */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 fade-up">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 flex flex-col shadow-2xl relative">
            <button
              onClick={() => setIsCreating(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-2xl bg-rose-600/20 text-rose-500 border border-rose-500/30">
                <UserPlus size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-100">Criar Novo Perfil</h2>
                <p className="text-xs text-zinc-400">Personalize seu avatar, preferências e segurança</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {createError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-semibold">
                  {createError}
                </div>
              )}

              {/* Avatar e Nome */}
              <div className="flex items-center gap-4">
                <div
                  className="cursor-pointer group relative shrink-0"
                  onClick={() => setShowAvatarPicker(true)}
                  title="Mudar Avatar"
                >
                  <Avatar id={newAvatar} size={72} />
                  <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                    Mudar
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">Nome</label>
                  <input
                    type="text"
                    required
                    maxLength={24}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Thiago, Família, Kids"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Time de Coração */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Trophy size={18} className="text-amber-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">Time de Coração</span>
                    <span className="text-[11px] text-zinc-400">
                      {selectedClub ? selectedClub.name : 'Nenhum (Opcional)'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTeamSelector(true)}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200"
                >
                  {selectedClub ? 'Alterar' : 'Escolher'}
                </button>
              </div>

              {/* Preferências de Gêneros (Doramas, Animes, etc.) */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/40 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={18} className="text-rose-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">Preferências de Conteúdo</span>
                    <span className="text-[11px] text-zinc-400">
                      {newGenres.length > 0
                        ? `${newGenres.length} gênero${newGenres.length > 1 ? 's' : ''} (Doramas, etc.)`
                        : 'Personalizar recomendações (Doramas, Ação...)'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGenreSelector(true)}
                  className="px-3 py-1 rounded-lg bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/30 text-xs font-semibold text-rose-300"
                >
                  {newGenres.length > 0 ? 'Editar' : 'Escolher'}
                </button>
              </div>

              {/* PIN de Segurança (Opcional) */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  PIN de Segurança de 4 dígitos (Opcional)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Deixe em branco para acesso livre"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-lg shadow-rose-950/40 flex items-center gap-1.5"
                >
                  <span>Criar Perfil</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAvatarPicker && (
        <AvatarPickerModal
          selected={newAvatar}
          onSelect={(av) => setNewAvatar(av)}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {showTeamSelector && (
        <TeamSelectorModal
          selected={newTeam || undefined}
          onSelect={(club) => setNewTeam(club)}
          onClose={() => setShowTeamSelector(false)}
        />
      )}

      {showGenreSelector && (
        <GenrePreferencesModal
          profileName={newName || 'Novo Perfil'}
          initialSelected={newGenres}
          onSave={(genres) => setNewGenres(genres)}
          onClose={() => setShowGenreSelector(false)}
        />
      )}
    </div>
  )
}
